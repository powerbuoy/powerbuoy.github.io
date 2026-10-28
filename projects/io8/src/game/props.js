import * as THREE from 'three';

import SleekEntity from '../sleek/entity.js';

/*
	Everything in the map that physics moves: mines and whatever else is placed in it (see fromMap()). Each one is its own entity, registered with whatever reacts to it (impact
	sounds, its emitters, Explosives if it's explosive) and unregistered again when it goes
*/
export default class Props {
	props = new Set();

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

		return entity;
	}

	// Only call between frames, not during a physics step
	remove (entity) {
		this.impacts?.unregister(entity.colliders);
		this.emitters?.remove(entity.object3d);
		this.explosives?.remove(entity);
		entity.destroy();
		this.props.delete(entity);
	}
}
