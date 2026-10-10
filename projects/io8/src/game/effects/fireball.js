import * as THREE from 'three';

import Particles from './particles.js';

const offset = new THREE.Vector3();

// White-hot, orange, deep red, gone. Way past 1 so bloom makes it glow (additive, so black = invisible)
const RAMP = [
	[0, new THREE.Color(4, 3, 1.6)],
	[0.25, new THREE.Color(3, 1.1, 0.2)],
	[0.6, new THREE.Color(1, 0.15, 0.02)],
	[1, new THREE.Color(0, 0, 0)]
];

/*
	A cluster of glowing low-poly puffs that burst out, swell and burn out from white to red
*/
export default class Fireball extends Particles {
	constructor (scene, conf = {}) {
		const material = new THREE.MeshBasicMaterial({transparent: true, blending: THREE.AdditiveBlending, depthWrite: false});

		super(scene, new THREE.IcosahedronGeometry(0.5, 1), material, 96);

		this.config = Object.assign({
			// At size 1: how many puffs, how far apart they start, how big they get (m) and how long they last (s)
			count: 12,
			spread: 0.5,
			scale: [0.7, 1.4],
			life: [0.35, 0.6],
			speed: 2.5
		}, conf);
	}

	spawn (position, size) {
		const {count, spread, scale, life, speed} = this.config;

		for (let i = 0; i < Math.round(count * Math.sqrt(size)); i++) {
			const particle = this.add();

			Particles.randomInBall(spread * size, offset);
			particle.position.copy(offset).add(position);
			particle.velocity.copy(offset).normalize().multiplyScalar(speed * size);
			particle.velocity.y += size;
			particle.maxScale = THREE.MathUtils.randFloat(scale[0], scale[1]) * size;
			particle.life = THREE.MathUtils.randFloat(life[0], life[1]);
		}
	}

	update (particle, t, deltaTime) {
		// Swells fast, then shrinks a little as it burns out
		const grow = 1 - (1 - Math.min(1, t * 3)) ** 3;

		particle.scale.setScalar(particle.maxScale * grow * (1 - t * 0.35));
		particle.position.addScaledVector(particle.velocity, deltaTime);
		particle.velocity.multiplyScalar(1 - Math.min(1, deltaTime * 5));

		for (let i = 1; i < RAMP.length; i++) {
			if (t <= RAMP[i][0]) {
				particle.color.lerpColors(RAMP[i - 1][1], RAMP[i][1], (t - RAMP[i - 1][0]) / (RAMP[i][0] - RAMP[i - 1][0]));
				break;
			}
		}
	}
}
