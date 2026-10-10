import * as THREE from 'three';

import SleekLoader from './loader.js';

/*
	The "ears" (a listener on the camera, so sounds pan and fade with distance) and loading sound files.
	Browsers don't let a page make sound until the user has clicked or pressed a key, so the audio is
	started on the first one
*/
export default class SleekAudio {
	// Reused for one-off sounds (impacts etc.), so each one doesn't create a new object. The oldest is cut
	// off if they're all busy
	pool = [];
	poolIndex = 0;
	isPaused = false;

	// Loading or loaded sounds by file, see load()
	buffers = new Map();

	constructor (camera, scene, conf = {}) {
		this.config = Object.assign({poolSize: 16}, conf);
		this.listener = new THREE.AudioListener();
		this.loader = new THREE.AudioLoader(SleekLoader.manager);

		camera.add(this.listener);

		for (let i = 0; i < this.config.poolSize; i++) {
			const sound = new THREE.PositionalAudio(this.listener);

			sound.setRefDistance(8);
			scene.add(sound);
			this.pool.push(sound);
		}

		const start = () => {
			if (!this.isPaused) {
				this.listener.context.resume();
			}

			window.removeEventListener('keydown', start);
			window.removeEventListener('pointerdown', start);
		};

		window.addEventListener('keydown', start);
		window.addEventListener('pointerdown', start);
	}

	// Stops every sound where it is (looping ones included) until resume()
	pause () {
		this.isPaused = true;
		this.listener.context.suspend();
	}

	resume () {
		this.isPaused = false;
		this.listener.context.resume();
	}

	// Play a one-off sound at a point in the world. rate changes the pitch (and speed). offset and duration (s)
	// play a slice of a longer sound, and fadeIn and fadeOut (s) fade it instead of starting and cutting off sharply
	playAt (buffer, position, {volume = 1, rate = 1, offset = 0, duration, fadeIn = 0, fadeOut = 0} = {}) {
		const sound = this.pool[this.poolIndex];

		this.poolIndex = (this.poolIndex + 1) % this.pool.length;

		if (sound.isPlaying) {
			sound.stop();
		}

		sound.position.copy(position);
		sound.updateMatrixWorld();
		sound.setBuffer(buffer);
		sound.setPlaybackRate(rate);

		// Pooled, so all of these are set every time, a slice or fade must not carry over to the next sound
		sound.offset = offset;
		sound.duration = duration;

		const gain = sound.gain.gain;
		const now = sound.context.currentTime;

		gain.cancelScheduledValues(now);
		gain.setValueAtTime(fadeIn > 0 ? 0 : volume, now);

		if (fadeIn > 0 || fadeOut > 0) {
			// How long it's heard for, which the rate speeds up or slows down. Fades longer than that together are
			// shortened to fit, keeping their proportions
			const length = (duration ?? buffer.duration - offset) / rate;
			const fit = Math.min(1, length / (fadeIn + fadeOut));

			gain.linearRampToValueAtTime(volume, now + fadeIn * fit);
			gain.setValueAtTime(volume, now + length - fadeOut * fit);
			gain.linearRampToValueAtTime(0, now + length);
		}

		sound.play();
	}

	// Each file is fetched and decoded once, however many things ask for it. One that fails is forgotten, so
	// asking again tries again
	load (src) {
		if (!this.buffers.has(src)) {
			this.buffers.set(src, this.loader.loadAsync(src).catch(error => {
				this.buffers.delete(src);

				throw error;
			}));
		}

		return this.buffers.get(src);
	}

	// Several takes of the same sound, numbered the way Kenney's packs are: name_000.ogg, name_001.ogg...
	loadVariations (name, count = 5) {
		return Promise.all(Array.from({length: count}, (v, i) => this.load(`${name}_${String(i).padStart(3, '0')}.ogg`)));
	}

	// A sound that comes from an object in the scene (louder the closer the camera, panned left/right)
	positional (buffer, {loop = false, volume = 1, distance = 8} = {}) {
		const sound = new THREE.PositionalAudio(this.listener);

		sound.setBuffer(buffer);
		sound.setLoop(loop);
		sound.setVolume(volume);

		// Full volume up to this distance, then quieter further away
		sound.setRefDistance(distance);

		return sound;
	}
}
