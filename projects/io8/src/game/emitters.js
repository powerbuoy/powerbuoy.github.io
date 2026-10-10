import * as THREE from 'three';

import {randomItem} from '../sleek/utils.js';

import Smoke from './effects/smoke.js';

const KINDS = ['smoke', 'sparks'];

const step = new THREE.Vector3();

/*
	Smoke and sparks from empties tagged with an "emit" custom property (`smoke`, `sparks` or a list like
	`smoke, sparks`), in any model add()ed: the map, props, io8. With a `rate` an empty emits that many times a
	second, at random moments, `size` times as big as normal. Without one it shows how hurt its owner is: smoke
	that thickens and darkens as health drops, crackles of sparks once hurt and a burst of sparks on
	every hit (see hit()), so healing clears it up again by itself. Every burst of sparks from an emitter crackles:
	a short random slice of a long recording, faded in and out
*/
export default class Emitters {
	groups = new Map();

	constructor (scene, blasts, audio, conf = {}) {
		this.blasts = blasts;
		this.audio = audio;
		this.smoke = new Smoke(scene);
		this.config = Object.assign({
			// Health smoke starts below `below` health (0-1) and is `rate` puffs a second at 0
			smoke: {below: 0.7, rate: 14},

			// Health crackles start below `below` health and are `rate` a second at 0. `size` is a spark burst at
			// size 1 (1 = io8 blowing up), for the crackles and any sparks with a rate
			crackle: {below: 0.9, rate: 4, size: 0.06},

			// A hit's burst: `size` per health point lost, at least `min`, at most `max`
			hit: {size: 0.01, min: 0.04, max: 0.4},

			// The crackle with each burst of sparks: a random slice `length` (s) long, faded in over `fadeIn` and out
			// over `fadeOut` (s)
			sound: {src: './assets/audio/freesound/871766__harrisonlace__elecarc_sparking-electricity-bed.ogg', volume: 0.3, length: [0.4, 1], fadeIn: 0.1, fadeOut: 0.4}
		}, conf);
	}

	async init () {
		this.sound = await this.audio.load(this.config.sound.src);
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

			const emitter = {object: obj, kinds: kinds.filter(kind => KINDS.includes(kind)), position: obj.getWorldPosition(new THREE.Vector3()), velocity: new THREE.Vector3()};
			const rate = Number(obj.userData.rate ?? 0);

			if (rate > 0) {
				Object.assign(emitter, {rate, size: Number(obj.userData.size ?? 1)});
				emitter.due = Emitters.interval(rate);
				group.timed.push(emitter);
			}
			else if (owner) {
				emitter.kinds.forEach(kind => group.hurt[kind].push(emitter));
			}
			else {
				return;
			}

			group.all.push(emitter);
		});

		if (group.all.length) {
			this.groups.set(object3d, group);
		}
	}

	remove (object3d) {
		this.groups.delete(object3d);
	}

	step (deltaTime) {
		// Puffs already in the air finish even after what made them is gone
		this.smoke.step(deltaTime);

		this.groups.forEach((group, object3d) => {
			if (group.owner?.isExploded) {
				this.groups.delete(object3d);

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
				this.sparks(randomItem(sparkers).position, THREE.MathUtils.clamp(group.lost * hit.size, hit.min, hit.max));
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
			this.sparks(emitter.position, this.config.crackle.size * size);
		}
	}

	sparks (position, size) {
		const {volume, length, fadeIn, fadeOut} = this.config.sound;
		const duration = THREE.MathUtils.randFloat(length[0], length[1]);

		this.blasts.sparks.spawn(position, size);
		this.audio.playAt(this.sound, position, {volume, duration, fadeIn, fadeOut, offset: Math.random() * (this.sound.duration - duration)});
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
