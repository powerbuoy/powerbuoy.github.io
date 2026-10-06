import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// Scratch objects reused every frame instead of allocating new ones
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const nextPos = new THREE.Vector3();
const nextQuat = new THREE.Quaternion();
const unused = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const parentInverse = new THREE.Matrix4();

export default class SleekPhysics {
	accumulator = 0;

	// By body, and Sets, so adding and removing (whole piles of props at once) is cheap
	links = new Map();
	listeners = new Set();
	contactListeners = [];

	// Rapier is WASM so it has to be initialised once before anything else touches it
	static async load () {
		await RAPIER.init();
	}

	constructor (conf = {}) {
		this.config = Object.assign({
			gravity: {x: 0, y: -9.81, z: 0},
			// Rapier caps how far a body can turn per step (45°), so the step rate caps how fast anything can
			// spin: 60 steps/s is 47 rad/s, which is io8's wheel at 11.7 m/s. 120 steps/s doubles that
			timestep: 1 / 120,
			speed: 1
		}, conf);

		this.world = new RAPIER.World(this.config.gravity);
		this.world.timestep = this.config.timestep;

		// Collects collision events during a step (only from colliders that ask for them, see onContactForce)
		this.events = new RAPIER.EventQueue(true);
	}

	// Keep an Object3D in sync with a rigid body. Fixed bodies never move, so they're left where they are.
	// Rigid bodies don't scale either, so the object's scale is remembered once
	link (object3d, body) {
		if (body.isFixed()) {
			return;
		}

		this.links.set(body, {
			object3d,
			body,
			scale: object3d.getWorldScale(new THREE.Vector3()),
			prevPos: new THREE.Vector3().copy(body.translation()),
			prevQuat: new THREE.Quaternion().copy(body.rotation()),
			isResting: false
		});
	}

	unlink (body) {
		this.links.delete(body);
	}

	// Called before every fixed physics step (forces, motors, balancing etc.)
	onStep (callback) {
		this.listeners.add(callback);
	}

	offStep (callback) {
		this.listeners.delete(callback);
	}

	// Called with (collider1, collider2, force in newtons) whenever two things push on each other harder than
	// the threshold of a collider involved. Colliders have to opt in:
	// collider.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS) and setContactForceEventThreshold()
	onContactForce (callback) {
		this.contactListeners.push(callback);
	}

	// Fixed timestep so the simulation behaves the same at 30 and 144 fps
	step (deltaTime) {
		// Clamp so a backgrounded tab doesn't come back and run hundreds of steps
		this.accumulator += Math.min(deltaTime, 0.1) * this.config.speed;

		while (this.accumulator >= this.world.timestep) {
			// Remember where everything was, so we can draw in between steps (asleep = not moving)
			this.links.forEach(link => {
				if (!link.body.isSleeping()) {
					link.prevPos.copy(link.body.translation());
					link.prevQuat.copy(link.body.rotation());
				}
			});

			this.listeners.forEach(callback => callback(this.world.timestep));
			this.world.step(this.events);

			this.events.drainContactForceEvents(event => {
				const collider1 = this.world.getCollider(event.collider1());
				const collider2 = this.world.getCollider(event.collider2());

				this.contactListeners.forEach(callback => callback(collider1, collider2, event.totalForceMagnitude()));
			});
			this.accumulator -= this.world.timestep;
		}

		this.sync(this.accumulator / this.world.timestep);
	}

	// Rapier gives us world transforms, but objects can be nested, so convert to parent space.
	// Frames rarely line up with physics steps (and a 120 Hz screen draws two frames per step), so
	// drawing the latest step as-is makes moving things judder. Instead draw them "alpha" of the way
	// from the previous step to the latest one, which is smooth at any frame rate (and ~1 step behind)
	sync (alpha = 1) {
		this.links.forEach(link => {
			const {object3d, body, prevPos, prevQuat} = link;

			// Most props are asleep most of the time (Rapier stops simulating things that have settled). Put one
			// exactly where it stopped once, then leave it until it wakes up
			if (body.isSleeping()) {
				if (link.isResting) {
					return;
				}

				link.isResting = true;
				prevPos.copy(body.translation());
				prevQuat.copy(body.rotation());
			}
			else {
				link.isResting = false;
			}

			pos.copy(prevPos).lerp(nextPos.copy(body.translation()), alpha);
			quat.copy(prevQuat).slerp(nextQuat.copy(body.rotation()), alpha);
			matrix.compose(pos, quat, link.scale);

			object3d.parent.updateWorldMatrix(true, false);
			parentInverse.copy(object3d.parent.matrixWorld).invert();
			matrix.premultiply(parentInverse);
			matrix.decompose(object3d.position, object3d.quaternion, unused);
		});
	}
}
