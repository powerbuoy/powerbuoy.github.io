import * as THREE from 'three';

const matrix = new THREE.Matrix4();

/*
	A pool of short-lived particles drawn as one InstancedMesh (one draw call however many there are).
	Each blast layer (fireball, sparks...) extends this: add() particles with at least {position, life},
	and update() moves, scales and colours each one every frame. t is how far through its life it is (0-1).
	When the pool is full the oldest particle makes way.
*/
export default class Particles {
	particles = [];

	constructor (scene, geometry, material, max) {
		this.max = max;
		this.mesh = new THREE.InstancedMesh(geometry, material, max);
		this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
		this.mesh.count = 0;

		// Particles fly all over, the mesh's bounds don't cover them
		this.mesh.frustumCulled = false;
		scene.add(this.mesh);
	}

	add (particle) {
		if (this.particles.length >= this.max) {
			this.particles.shift();
		}

		this.particles.push(Object.assign({
			age: 0,
			quaternion: new THREE.Quaternion(),
			scale: new THREE.Vector3(1, 1, 1),
			color: new THREE.Color(1, 1, 1)
		}, particle));
	}

	step (deltaTime) {
		this.particles = this.particles.filter(particle => (particle.age += deltaTime) < particle.life);

		this.particles.forEach((particle, i) => {
			this.update(particle, particle.age / particle.life, deltaTime);
			this.mesh.setMatrixAt(i, matrix.compose(particle.position, particle.quaternion, particle.scale));
			this.mesh.setColorAt(i, particle.color);
		});

		this.mesh.count = this.particles.length;
		this.mesh.instanceMatrix.needsUpdate = true;
		this.mesh.instanceColor.needsUpdate = true;
	}

	update (particle, t, deltaTime) {}

	// Random point in a ball of `radius`, handy for spreading particles out
	static randomInBall (radius, target = new THREE.Vector3()) {
		do {
			target.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
		} while (target.lengthSq() > 1);

		return target.multiplyScalar(radius);
	}
}
