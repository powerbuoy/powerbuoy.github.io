import * as THREE from 'three';

import Particles from './particles.js';

const spin = new THREE.Quaternion();
const euler = new THREE.Euler();

/*
	Low-poly puffs that drift up, swell and shrink away. Solid and lit like everything else (so they're
	grey at noon, dark at night and warm at sunset), which also makes them cheap: no see-through overdraw.
	Spawned in the world, not on whatever's smoking, so they trail behind it
*/
export default class Smoke extends Particles {
	constructor (scene, conf = {}) {
		const material = new THREE.MeshStandardMaterial({roughness: 1});
		const geometry = new THREE.IcosahedronGeometry(0.5, 0);

		// Shaded smooth like everything modelled in Blender. three gives a 20-sided icosahedron one normal per
		// face (faceted, whatever the material says), so point every normal straight out from the middle instead
		const {position, normal} = geometry.attributes;

		for (let i = 0; i < position.count; i++) {
			normal.setXYZ(i, position.getX(i), position.getY(i), position.getZ(i));
		}

		geometry.normalizeNormals();

		super(scene, geometry, material, 96);

		this.config = Object.assign({
			// How big a puff gets (m), how long it lasts (s), how fast it rises (m/s), how far from the emitter it
			// starts (m), and how much of the emitter's own speed it keeps (0-1)
			scale: [0.12, 0.3],
			life: [0.8, 1.6],
			rise: [0.4, 0.9],
			spread: 0.06,
			inherit: 0.2
		}, conf);
	}

	// darkness 0-1 (0 light grey, 1 near black), velocity is the emitter's
	spawn (position, darkness = 0, velocity = null) {
		const {scale, life, rise, spread, inherit} = this.config;
		const rising = new THREE.Vector3(0, THREE.MathUtils.randFloat(...rise), 0);

		if (velocity) {
			rising.addScaledVector(velocity, inherit);
		}

		// Darker smoke is thicker too
		this.add({
			position: Particles.randomInBall(spread).add(position),
			velocity: rising,
			spin: Particles.randomInBall(3),
			quaternion: new THREE.Quaternion().random(),
			color: new THREE.Color().setScalar(THREE.MathUtils.lerp(0.7, 0.08, darkness)),
			maxScale: THREE.MathUtils.randFloat(...scale) * (1 + darkness * 0.5),
			life: THREE.MathUtils.randFloat(...life)
		});
	}

	update (particle, t, deltaTime) {
		// Swells quickly, then slowly shrinks to nothing
		const grow = Math.min(1, t * 4);

		particle.scale.setScalar(particle.maxScale * grow * (1 - t) ** 0.5);
		particle.position.addScaledVector(particle.velocity, deltaTime);

		// Loses the emitter's speed but keeps rising, tumbling slowly
		particle.velocity.x *= 1 - Math.min(1, deltaTime * 2);
		particle.velocity.z *= 1 - Math.min(1, deltaTime * 2);
		particle.quaternion.multiply(spin.setFromEuler(euler.set(particle.spin.x * deltaTime, particle.spin.y * deltaTime, particle.spin.z * deltaTime)));
	}
}
