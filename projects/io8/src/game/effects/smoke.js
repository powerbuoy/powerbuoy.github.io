import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

import Particles from './particles.js';

const spin = new THREE.Quaternion();
const euler = new THREE.Euler();

/*
	Puffs that drift up, swell and shrink away. Lit like everything else (so they're grey at noon, dark at night
	and warm at sunset) and a little see-through. They don't hide each other (no depth writes), so where they
	overlap they add up to thicker smoke and a plume reads as one. Not sorted (one instanced mesh), which doesn't
	show as the puffs are all much the same colour
	Spawned in the world, not on whatever's smoking, so they trail behind it
*/
export default class Smoke extends Particles {
	constructor (scene, conf = {}) {
		const material = new THREE.MeshStandardMaterial({roughness: 1, transparent: true, opacity: 0.6, depthWrite: false});

		// 320 triangles, round enough to sit with the Blender models. 96 puffs is still only ~30k triangles in one
		// draw call
		super(scene, Smoke.lumpy(new THREE.IcosahedronGeometry(0.5, 2)), material, 96);

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

	// darkness 0-1 (0 light grey, 1 near black), velocity is the emitter's, size scales the puff
	spawn (position, darkness = 0, velocity = null, size = 1) {
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
			stretch: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.5).addScalar(0.75),
			color: new THREE.Color().setScalar(THREE.MathUtils.lerp(0.7, 0.08, darkness)),
			maxScale: THREE.MathUtils.randFloat(...scale) * (1 + darkness * 0.5) * size,
			life: THREE.MathUtils.randFloat(...life)
		});
	}

	update (particle, t, deltaTime) {
		// Swells quickly, then slowly shrinks to nothing
		const grow = Math.min(1, t * 4);

		particle.scale.copy(particle.stretch).multiplyScalar(particle.maxScale * grow * (1 - t) ** 0.5);
		particle.position.addScaledVector(particle.velocity, deltaTime);

		// Loses the emitter's speed but keeps rising, tumbling slowly
		particle.velocity.x *= 1 - Math.min(1, deltaTime * 2);
		particle.velocity.z *= 1 - Math.min(1, deltaTime * 2);
		particle.quaternion.multiply(spin.setFromEuler(euler.set(particle.spin.x * deltaTime, particle.spin.y * deltaTime, particle.spin.z * deltaTime)));
	}

	// A ball with a few bulges, so the puffs read as smoke rather than bubbles. One shape for all of them, the random
	// turn and stretch of each puff makes them look different. Welded first, so it's shaded smooth (three only gives
	// faceted normals otherwise)
	static lumpy (geometry, lumps = 7, height = 0.35) {
		const welded = mergeVertices(geometry.deleteAttribute('normal').deleteAttribute('uv'));
		const position = welded.getAttribute('position');
		const vertex = new THREE.Vector3();
		const centres = Array.from({length: lumps}, () => new THREE.Vector3().randomDirection());

		for (let i = 0; i < position.count; i++) {
			vertex.fromBufferAttribute(position, i);

			const radius = vertex.length();
			const direction = vertex.divideScalar(radius);

			// Each lump bulges out most at its centre and fades out over a quarter of the ball or so
			const bulge = centres.reduce((sum, centre) => sum + Math.max(0, direction.dot(centre) - 0.5) ** 2 * 4, 0);

			position.setXYZ(i, ...direction.multiplyScalar(radius * (1 + bulge * height)).toArray());
		}

		geometry.dispose();
		welded.computeVertexNormals();

		return welded;
	}
}
