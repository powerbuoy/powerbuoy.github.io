import * as THREE from 'three';

import Particles from './particles.js';

const Z = new THREE.Vector3(0, 0, 1);
const direction = new THREE.Vector3();

const HOT = new THREE.Color(10, 5, 1.2);

/*
	Bright streaks that shoot out, fall with gravity and fade. Stretched along the way they fly,
	longer the faster they go
*/
export default class Sparks extends Particles {
	constructor (scene, conf = {}) {
		const material = new THREE.MeshBasicMaterial({transparent: true, blending: THREE.AdditiveBlending, depthWrite: false});

		super(scene, new THREE.BoxGeometry(0.025, 0.025, 1), material, 256);

		this.config = Object.assign({
			// At size 1: how many, how fast (m/s), how long (s), and how long a streak is per m/s of speed
			count: 36,
			speed: [4, 13],
			life: [0.35, 0.9],
			stretch: 0.025,
			gravity: 9.81
		}, conf);
	}

	spawn (position, size) {
		const {count, speed, life} = this.config;

		for (let i = 0; i < Math.round(count * Math.sqrt(size)); i++) {
			// Mostly outwards and up, some sideways, few straight down
			direction.randomDirection();
			direction.y = Math.abs(direction.y) * 0.8 + 0.2;

			this.add({
				position: new THREE.Vector3().copy(position),
				velocity: direction.clone().normalize().multiplyScalar(THREE.MathUtils.randFloat(speed[0], speed[1]) * Math.sqrt(size)),
				life: THREE.MathUtils.randFloat(life[0], life[1])
			});
		}
	}

	update (particle, t, deltaTime) {
		const {velocity} = particle;

		velocity.y -= this.config.gravity * deltaTime;
		velocity.multiplyScalar(1 - Math.min(1, deltaTime * 1.2));
		particle.position.addScaledVector(velocity, deltaTime);

		particle.quaternion.setFromUnitVectors(Z, direction.copy(velocity).normalize());
		particle.scale.set(1, 1, Math.max(0.02, velocity.length() * this.config.stretch));
		particle.color.copy(HOT).multiplyScalar((1 - t) ** 1.5);
	}
}
