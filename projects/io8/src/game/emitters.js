import * as THREE from 'three';

import {randomItem} from '../sleek/utils.js';

const KINDS = ['smoke', 'sparks'];

const step = new THREE.Vector3();

/*
	Smoke and sparks from empties tagged with an "emit" custom property (`smoke`, `sparks` or a list like
	`smoke, sparks`), in any model add()ed: the map, props, io8, drones. With a `rate` an empty emits that many times a
	second, at random moments, `size` times as big as normal. Without one it shows how hurt its owner is: smoke
	that thickens and darkens as health drops, crackles of sparks once hurt and a burst of sparks on
	every hit (see hit()), so healing clears it up again by itself. Every burst of sparks from an emitter crackles:
	a short random slice of a long recording, faded in and out. One with a rate crackles one slice at a time (an
	electric box sparks many times a second, and overlapping slices would take every sound there is). A `sound`
	custom property names another of config.sounds instead (`sound: fuze`), and one that loops plays all the time
	from the emitter, instead of with each burst
*/
export default class Emitters {
	groups = new Map();

	// Seconds of game time, for when a crackle ends
	time = 0;

	constructor (blasts, audio, conf = {}) {
		this.blasts = blasts;
		this.audio = audio;

		// One smoke for everything, shared with the explosions' clouds
		this.smoke = blasts.smoke;
		this.config = Object.assign({
			// Health smoke starts below `below` health (0-1) and is `rate` puffs a second at 0
			smoke: {below: 0.7, rate: 14},

			// Health crackles start below `below` health and are `rate` a second at 0. `size` is a spark burst at
			// size 1 (1 = io8 blowing up), for the crackles and any sparks with a rate
			crackle: {below: 0.9, rate: 4, size: 0.06},

			// A hit's burst: `size` per health point lost, at least `min`, at most `max`
			hit: {size: 0.01, min: 0.04, max: 0.4},

			// What the sparks sound like, by name (the emitter's `sound`, crackle without one). Each burst plays a
			// random slice `length` (s) long, faded in over `fadeIn` and out over `fadeOut` (s). One that loops
			// plays from the emitter all the time instead, starting anywhere in it
			sounds: {
				crackle: {src: './assets/audio/freesound/871766__harrisonlace__elecarc_sparking-electricity-bed.ogg', volume: 0.3, length: [0.4, 1], fadeIn: 0.1, fadeOut: 0.4},
				fuze: {src: './assets/audio/freesound/45650__elonen__fuse_burning_loop.ogg', volume: 0.3, loop: true}
			}
		}, conf);
	}

	async init () {
		const names = Object.keys(this.config.sounds);
		const buffers = await Promise.all(names.map(name => this.audio.load(this.config.sounds[name].src)));

		this.buffers = Object.fromEntries(names.map((name, i) => [name, buffers[i]]));
	}

	// Every emitter in object3d. An owner ({healthLevel, isExploded}) is what the ones without a rate show
	// the health of, and they all stop when it blows up. Without one, only the ones with a rate do anything
	add (object3d, owner = null) {
		const group = {owner, timed: [], hurt: {smoke: [], sparks: []}, smokeDue: 0, lost: 0, all: []};

		object3d.traverse(obj => {
			if (obj.userData.emit === undefined) {
				return;
			}

			const kinds = String(obj.userData.emit).split(',').map(kind => kind.trim());
			const unknown = kinds.filter(kind => !KINDS.includes(kind));

			if (unknown.length) {
				console.warn(`Emitters: ${obj.name} has emit "${unknown.join(', ')}", only ${KINDS.join(' and ')} exist`);
			}

			const sound = String(obj.userData.sound ?? 'crackle');

			if (!this.config.sounds[sound]) {
				console.warn(`Emitters: ${obj.name} has sound "${sound}", only ${Object.keys(this.config.sounds).join(', ')} exist`);
			}

			const emitter = {object: obj, kinds: kinds.filter(kind => KINDS.includes(kind)), position: obj.getWorldPosition(new THREE.Vector3()), velocity: new THREE.Vector3(), sound: this.config.sounds[sound] ? sound : 'crackle'};
			const rate = Number(obj.userData.rate ?? 0);

			if (rate > 0) {
				Object.assign(emitter, {rate, size: Number(obj.userData.size ?? 1), crackleEnds: 0});
				emitter.due = Emitters.interval(rate);
				group.timed.push(emitter);
			}
			else if (owner) {
				emitter.kinds.forEach(kind => group.hurt[kind].push(emitter));
			}
			else {
				return;
			}

			if (this.config.sounds[emitter.sound].loop) {
				emitter.loop = this.loop(emitter);
			}

			group.all.push(emitter);
		});

		if (group.all.length) {
			this.groups.set(object3d, group);
		}
	}

	remove (object3d) {
		this.groups.get(object3d)?.all.forEach(emitter => {
			if (emitter.loop) {
				emitter.loop.stop();
				emitter.loop.removeFromParent();
			}
		});

		this.groups.delete(object3d);
	}

	// The emitter's looping sound, playing from it (and moving with it) until it's remove()d
	loop (emitter) {
		const buffer = this.buffers[emitter.sound];
		const sound = this.audio.positional(buffer, {loop: true, volume: this.config.sounds[emitter.sound].volume});

		// Anywhere in it, so a few of them side by side don't play in step
		sound.offset = Math.random() * buffer.duration;
		emitter.object.add(sound);
		sound.play();

		return sound;
	}

	step (deltaTime) {
		this.time += deltaTime;

		this.groups.forEach((group, object3d) => {
			if (group.owner?.isExploded) {
				this.remove(object3d);

				return;
			}

			group.all.forEach(emitter => Emitters.track(emitter, deltaTime));

			// Random moments, `rate` a second on average: the time to the next one is drawn each time, so it's
			// right at any rate and frame rate
			group.timed.forEach(emitter => {
				for (emitter.due -= deltaTime; emitter.due <= 0; emitter.due += Emitters.interval(emitter.rate)) {
					emitter.kinds.forEach(kind => this.emit(kind, emitter, emitter.size));
				}
			});

			if (group.owner) {
				this.stepHurt(group, deltaTime);
			}
		});
	}

	// The owner of object3d (see add()) lost health in a crash. Can be called from inside a physics step: one crash
	// takes a few of them, and the next frame makes one burst for all of it
	hit (object3d, lost) {
		const group = this.groups.get(object3d);

		if (group) {
			group.lost += lost;
		}
	}

	// Each one from a random one of the group's emitters of that kind
	stepHurt (group, deltaTime) {
		const {smoke, crackle, hit} = this.config;
		const {owner, hurt: {smoke: smokers, sparks: sparkers}} = group;
		const level = owner.healthLevel;

		if (sparkers.length) {
			if (group.lost > 0) {
				const emitter = randomItem(sparkers);

				this.sparks(emitter.position, THREE.MathUtils.clamp(group.lost * hit.size, hit.min, hit.max), emitter);
			}

			if (Math.random() < crackle.rate * Math.max(0, 1 - level / crackle.below) * deltaTime) {
				this.emit('sparks', randomItem(sparkers));
			}
		}

		group.lost = 0;

		if (smokers.length) {
			// Spread over the frames by time, so it's the same amount of smoke at any frame rate
			const darkness = Math.max(0, 1 - level / smoke.below);

			group.smokeDue += smoke.rate * darkness * deltaTime;

			for (; group.smokeDue >= 1; group.smokeDue--) {
				this.emit('smoke', randomItem(smokers), 1, darkness);
			}
		}
	}

	emit (kind, emitter, size = 1, darkness = 0) {
		if (kind === 'smoke') {
			this.smoke.spawn(emitter.position, darkness, emitter.velocity, size);
		}
		else {
			this.sparks(emitter.position, this.config.crackle.size * size, emitter);
		}
	}

	// `emitter` (optional) is the one they come from, for its sound. One with a rate only starts a new crackle once
	// its last one has finished, and one with a loop is already making its sound
	sparks (position, size, emitter = null) {
		this.blasts.sparks.spawn(position, size);

		if (emitter?.loop) {
			return;
		}

		const name = emitter?.sound ?? 'crackle';
		const {volume, length, fadeIn, fadeOut} = this.config.sounds[name];
		const duration = THREE.MathUtils.randFloat(length[0], length[1]);
		const buffer = this.buffers[name];

		if (emitter?.rate) {
			if (this.time < emitter.crackleEnds) {
				return;
			}

			emitter.crackleEnds = this.time + duration;
		}

		this.audio.playAt(buffer, position, {volume, duration, fadeIn, fadeOut, offset: Math.random() * (buffer.duration - duration)});
	}

	// Where it is in the world, and how fast it's going there (smoke keeps some of that)
	static track (emitter, deltaTime) {
		const {object, position, velocity} = emitter;

		step.copy(position);
		object.getWorldPosition(position);

		if (deltaTime > 0) {
			velocity.subVectors(position, step).divideScalar(deltaTime);
		}
	}

	// Seconds to the next one, for random moments `rate` a second on average
	static interval (rate) {
		return -Math.log(1 - Math.random()) / rate;
	}
}
