import * as THREE from 'three';

import SleekEntity from '../sleek/entity.js';

/*
	Everything in the map that physics moves: mines and whatever else is placed in it (see fromMap()). Each one is its own entity, registered with whatever reacts to it (impact
	sounds, its emitters, Explosives if it's explosive) and unregistered again when it goes. One with a
	"wake_distance" custom property (m) starts asleep, held where it was placed (a mine on a slope stays put), until
	io8 gets that close (see step()). Anything that hits it wakes it sooner, Rapier does that itself
*/
export default class Props {
	props = new Set();

	// The ones still waiting for io8 (see step()), with their bodies
	dormant = new Map();

	// New ones with a wake_distance, put to sleep once the world has stepped with them in it (see step())
	settling = new Map();

	constructor (scene, physics) {
		this.scene = scene;
		this.physics = physics;
	}

	setImpacts (impacts) {
		this.impacts = impacts;
	}

	setEmitters (emitters) {
		this.emitters = emitters;
	}

	setExplosives (explosives) {
		this.explosives = explosives;
	}

	// Takes every _RigidBody in the map that moves (has a mass, or is kinematic) out of it and makes it a prop of
	// its own, so it can be blown up or knocked about on its own. Call before the map becomes an entity, so it's
	// only the ground and walls that are left
	fromMap (map) {
		map.updateWorldMatrix(true, true);

		SleekEntity.findRigidBodies(map).filter(SleekEntity.moves).forEach(obj => {
			// Out of whatever it was in (a collection instance), keeping where it is
			const object3d = new THREE.Group();

			object3d.attach(obj);
			this.add(object3d);
		});
	}

	// object3d holds the _RigidBody
	add (object3d) {
		const entity = new SleekEntity(object3d, this.physics);

		this.scene.add(entity.object3d);
		this.props.add(entity);
		this.emitters?.add(entity.object3d);
		this.explosives?.add(entity);
		this.impacts?.add(entity);

		if (entity.property('wake_distance') !== undefined) {
			this.settling.set(entity, {bodies: Object.values(entity.bodies), since: this.physics.steps});
		}

		return entity;
	}

	// Every frame, after the physics. `focus` is where io8 is (or what's left of him)
	step (focus) {
		// Rapier wakes a sleeping body the moment it first touches anything, the ground too, so one put to sleep
		// straight away woke up again on the first step if it was lying on something. Once that contact exists it
		// stays asleep
		this.settling.forEach(({bodies, since}, entity) => {
			if (this.physics.steps > since) {
				bodies.forEach(body => body.sleep());
				this.settling.delete(entity);
				this.dormant.set(entity, bodies);
			}
		});

		this.dormant.forEach((bodies, entity) => {
			// Already woken by something hitting it
			if (!bodies.every(body => body.isSleeping())) {
				this.dormant.delete(entity);
			}
			else if (entity.position.distanceTo(focus) < Number(entity.property('wake_distance'))) {
				bodies.forEach(body => body.wakeUp());
				this.dormant.delete(entity);
			}
		});
	}

	// Only call between frames, not during a physics step
	remove (entity) {
		this.impacts?.unregister(entity.colliders);
		this.emitters?.remove(entity.object3d);
		this.explosives?.remove(entity);
		this.settling.delete(entity);
		this.dormant.delete(entity);
		entity.destroy();
		this.props.delete(entity);
	}
}
