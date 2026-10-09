import * as THREE from 'three';

import Smoke from './effects/smoke.js';

const position = new THREE.Vector3();

/*
	Shows how hurt io8 is: smoke that thickens and darkens as his health drops, a burst of sparks whenever
	he takes a hit, and the odd crackle of sparks when he's badly hurt. Comes from his emitters (see
	IO8.emitters), driven only by his health, so healing clears it up again by itself
*/
export default class Damage {
	health = null;
	smokeDue = 0;

	constructor (scene, blasts, player, conf = {}) {
		this.blasts = blasts;
		this.player = player;
		this.smoke = new Smoke(scene);
		this.config = Object.assign({
			// Smoke starts below `below` health (0-1) and is `rate` puffs a second at 0
			smoke: {below: 0.7, rate: 14},

			// Crackles start below `below` health, `rate` a second at 0, each a spark burst of `size` (1 = io8 blowing up)
			crackle: {below: 0.4, rate: 1.5, size: 0.06},

			// A hit's burst: `size` per health point lost, at least `min`, at most `max`
			hit: {size: 0.01, min: 0.04, max: 0.4}
		}, conf);
	}

	step (deltaTime) {
		const {player} = this;
		const {smoke, crackle, hit} = this.config;

		// Puffs already in the air finish even after he's blown up
		this.smoke.step(deltaTime);

		// Nothing to show it from (a model without emitters)
		if (player.isExploded || !player.emitters.length) {
			return;
		}

		const level = player.healthLevel;
		const lost = (this.health ?? player.health) - player.health;
		const velocity = player.legs.linvel();

		this.health = player.health;

		if (lost > 0) {
			this.blasts.sparks.spawn(this.emitterPosition(), THREE.MathUtils.clamp(lost * hit.size, hit.min, hit.max));
		}

		// Spread over the frames by time, so it's the same amount of smoke at any frame rate
		const hurt = Math.max(0, 1 - level / smoke.below);

		this.smokeDue += smoke.rate * hurt * deltaTime;

		for (; this.smokeDue >= 1; this.smokeDue--) {
			this.smoke.spawn(this.emitterPosition(), hurt, velocity);
		}

		if (Math.random() < crackle.rate * Math.max(0, 1 - level / crackle.below) * deltaTime) {
			this.blasts.sparks.spawn(this.emitterPosition(), crackle.size);
		}
	}

	// A random one of his emitters, in the world
	emitterPosition () {
		const {emitters} = this.player;

		return emitters[Math.floor(Math.random() * emitters.length)].getWorldPosition(position);
	}
}
