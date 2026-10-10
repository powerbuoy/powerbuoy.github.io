import * as THREE from 'three';

const matrix = new THREE.Matrix4();

/*
	A pool of short-lived particles drawn as one InstancedMesh (one draw call however many there are).
	Each layer (fireball, sparks, smoke) extends this: spawn() takes a particle from add() and sets at least its
	position and life, and update() moves, scales and colours each one every frame. t is how far through its life
	it is (0-1). When the pool is full the oldest particle makes way.
	Every particle there can be is made up front and reused, so a burst allocates nothing. The live ones,
	oldest first, are `count` in a row from `first`, wrapping round the end of the pool, so when it's full the
	oldest makes way without everything moving along. A layer that needs more on each one adds it in
	createParticle()
*/
export default class Particles {
	first = 0;
	count = 0;

	constructor (scene, geometry, material, max) {
		this.max = max;
		this.particles = Array.from({length: max}, () => this.createParticle());
		this.mesh = new THREE.InstancedMesh(geometry, material, max);
		this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
		this.mesh.count = 0;

		// Particles fly all over, the mesh's bounds don't cover them
		this.mesh.frustumCulled = false;
		scene.add(this.mesh);
	}

	createParticle () {
		return {
			age: 0,
			life: 0,
			position: new THREE.Vector3(),
			velocity: new THREE.Vector3(),
			quaternion: new THREE.Quaternion(),
			scale: new THREE.Vector3(1, 1, 1),
			color: new THREE.Color(1, 1, 1)
		};
	}

	// A fresh particle for spawn() to fill in. Rotation, scale and colour start out neutral, the rest is whatever
	// it was last time
	add () {
		const {particles, max} = this;
		let particle;

		if (this.count < max) {
			particle = particles[(this.first + this.count) % max];
			this.count++;
		}
		// Full: the oldest one is the newest now, the next one round is the oldest
		else {
			particle = particles[this.first];
			this.first = (this.first + 1) % max;
		}

		particle.age = 0;
		particle.quaternion.identity();
		particle.scale.set(1, 1, 1);
		particle.color.setRGB(1, 1, 1);

		return particle;
	}

	step (deltaTime) {
		// Nothing going on (most of the time), nothing to do
		if (!this.count) {
			this.mesh.count = 0;

			return;
		}

		// The ones still alive close up behind `first`, in the same order, the dead ones end up after them
		const {particles, max, first} = this;
		let count = 0;

		for (let i = 0; i < this.count; i++) {
			const index = (first + i) % max;
			const particle = particles[index];

			if ((particle.age += deltaTime) >= particle.life) {
				continue;
			}

			const to = (first + count) % max;

			particles[index] = particles[to];
			particles[to] = particle;

			this.update(particle, particle.age / particle.life, deltaTime);
			this.mesh.setMatrixAt(count, matrix.compose(particle.position, particle.quaternion, particle.scale));
			this.mesh.setColorAt(count, particle.color);
			count++;
		}

		// Only the live ones are sent to the GPU, not the whole pool
		const {instanceMatrix, instanceColor} = this.mesh;

		this.count = count;
		this.mesh.count = count;
		instanceMatrix.addUpdateRange(0, count * 16);
		instanceColor.addUpdateRange(0, count * 3);
		instanceMatrix.needsUpdate = true;
		instanceColor.needsUpdate = true;
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
