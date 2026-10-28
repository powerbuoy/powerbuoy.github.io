import * as THREE from 'three';

import Explosion from './explosion.js';

const velocity = new THREE.Vector3();

/*
	Props with an "explosive" custom property (on their _RigidBody) go off when anything that moves touches them
	(io8, debris, a drone), or when a blast reaches them (a bolt, a drone crashing, another one going off). Props
	add()s every prop, the ones that aren't explosive are ignored. Touching is a real contact between their
	colliders (not just being close), read from the physics after each step
*/
export default class Explosives {
	explosives = new Set();

	// What's near an explosive (see toucher())
	near = [];

	// Called with (point, blast config) whenever one goes off, so everything nearby can react (see App.blast())
	onBlast = null;

	constructor (scene, physics, blasts, debris, conf = {}) {
		this.scene = scene;
		this.physics = physics;
		this.blasts = blasts;
		this.debris = debris;
		this.config = Object.assign({
			// Closest (m) anything has to get to count as touching (contacts are reported a little before things meet)
			touch: 0.01,

			// The blast: things within `radius` (m) get up to `impulse` N·s per m² facing it (see
			// Explosion.shockwave()), and how big it looks and sounds (see Blasts, 1 = io8 blowing up). Within
			// `reach` (m) io8 loses up to `damage` health, less the further away he is (see IO8.blast()), the same
			// whether he touched it or shot it, and drones and other explosives go too
			blast: {radius: 4, impulse: 250, size: 1, damage: 100, reach: 2.5}
		}, conf);
	}

	// Props, which owns them: a mine that's gone off is removed through it
	setProps (props) {
		this.props = props;
	}

	add (entity) {
		if ([...entity.bodyObjects.values()].some(obj => obj.userData.explosive)) {
			this.explosives.add(entity);
		}
	}

	remove (entity) {
		this.explosives.delete(entity);
	}

	// Something blew up at `point` (see App.blast()): any explosive within its `reach` (m) goes off, which can set
	// off more. Each one is gone before its own blast goes out, so a chain always ends
	blast (point, {reach}) {
		this.explosives.forEach(entity => entity.distanceTo(point) < reach && this.explode(entity));
	}

	// Every frame, after the physics. Touching one does no damage itself, its blast does (see App.blast())
	step (deltaTime) {
		this.explosives.forEach(entity => this.toucher(entity) && this.explode(entity));
	}

	// Whatever's touching it (a collider), or null. Anything that can move counts, the ground it lies on doesn't
	toucher (entity) {
		const {world} = this.physics;
		let found = null;

		// What's near it at all, then whether any of it really touches. Collected first, Rapier can't be asked
		// about one pair while it's listing them
		entity.colliders.forEach(collider => {
			this.near.length = 0;
			world.contactPairsWith(collider, other => !other.parent()?.isFixed() && this.near.push(other));

			this.near.forEach(other => world.contactPair(collider, other, manifold => {
				for (let i = 0; i < manifold.numContacts(); i++) {
					if (manifold.contactDist(i) < this.config.touch) {
						found ??= other;
					}
				}
			}));
		});

		return found;
	}

	explode (entity) {
		const {blast} = this.config;
		const explosion = new Explosion(this.scene, this.physics, entity.position, blast);

		velocity.copy(entity.mainBody.linvel());
		explosion.shatter(entity.object3d, () => velocity);
		this.props.remove(entity);
		explosion.shockwave();
		this.blasts.spawn(explosion.center, blast.size);
		this.debris.add(explosion);
		this.onBlast?.(explosion.center, blast);
	}
}
