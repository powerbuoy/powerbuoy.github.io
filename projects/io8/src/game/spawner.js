import * as THREE from 'three';

import SleekLoader from '../sleek/loader.js';
import SleekEntity from '../sleek/entity.js';
import {pickWeighted} from '../sleek/utils.js';

// Tiny gap so things start just clear of the ground and settle onto it, instead of starting inside it
const GAP = 0.005;

const MODELS = {
	mine: './assets/gltf/props/Mine/Mine.gltf'
};

// How far behind and ahead of io8 (m) the road is filled in. Ahead has to reach past what the camera can see
// (view 3 looks a long way down the road), or things visibly pop in
const RANGE = {behind: 6, ahead: 80};

// The road is built in chunks of this many metres, each with its share of obstacles and pickups
const CHUNK = 10;

// Anything that ends up this far from io8 (debris and pickups included) is removed, a chunk past the range so
// what was just built doesn't go straight away
export const DESPAWN = {behind: RANGE.behind + 2, ahead: RANGE.ahead + CHUNK};

const CONFIG = {

	// Nothing spawns closer than this to either end of the map
	edge: 2,

	// An obstacle slot every spacing m (offset from the map's x = 0), each one used by chance and nudged up to
	// `jitter` m forward so they don't come at an even beat
	obstacles: {spacing: 15, offset: 2, chance: 0.7, jitter: 8},

	// A pickup slot every spacing m like the obstacles, and how high above the ground (m). io8 is about 1.15 m
	// tall with his antenna up, so they're all out of reach without flying. Which pickup it is depends on their
	// `frequency` (see Pickups). Off for now (was 0.8), only drones and mines on the road
	pickups: {spacing: 25, offset: 9, jitter: 5, chance: 0, height: [1.5, 2.5]},

	// Keep the spot io8 starts on clear (distance from its start)
	safeZone: 3
};

// Obstacles on io8's path, weighted by how often they show up
const OBSTACLES = [
	// Goes off when anything that moves touches it, io8 or a laser bolt or a drone (see Explosives): jump it, fly
	// over it, or set it off from a distance
	[1, (s, x) => s.spawn('mine', x)]
];

export default class Spawner {
	models = {};
	chunks = new Set();
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

	setPickups (pickups) {
		this.pickups = pickups;
	}

	setExplosives (explosives) {
		this.explosives = explosives;
	}

	// Call once the map exists, everything is placed on top of it from then on
	setGround (ground, startX = 0) {
		this.ground = ground;
		this.startX = startX;
	}

	async init () {
		// Load each model once, every prop is a clone
		await Promise.all(Object.entries(MODELS).map(async ([name, src]) => {
			const object3d = await SleekLoader.loadObject(src);
			const body = object3d.children[0];
			// What it collides with, like SleekEntity: the _Shape, or the _Mesh without one, or the body itself
			const shape = body.getObjectByName(body.name.replace(/_RigidBody$/, '_Shape')) ?? body.getObjectByName(body.name.replace(/_RigidBody$/, '_Mesh')) ?? body;
			const box = new THREE.Box3().setFromObject(shape);

			this.models[name] = {object3d, size: box.getSize(new THREE.Vector3()), bottom: box.min.y};
		}));
	}

	// For App.warmUp(): one of each prop, so a kind that isn't on the road yet (a mine) doesn't hitch the first time
	standIns () {
		return Object.values(this.models).map(({object3d}) => object3d.clone());
	}

	// Call every frame with io8's x
	update (x) {
		this.updateChunks(x);
		this.despawn(x);
	}

	// Fixed size window of chunk indices around io8, new ones get filled
	updateChunks (x) {
		const last = Math.floor((x + RANGE.ahead) / CHUNK);

		for (let index = Math.floor((x - RANGE.behind) / CHUNK); index <= last; index++) {
			if (!this.chunks.has(index)) {
				this.chunks.add(index);
				this.createChunk(index);
			}
		}

		// The props themselves are cleaned up by distance in despawn() (debris wanders off from its chunk). A chunk
		// is only forgotten (so it can be built again when driving back) well past that, so a rebuilt chunk never
		// lands on top of its own leftovers
		this.chunks.forEach(index => {
			const dx = index * CHUNK + CHUNK / 2 - x;

			if (dx < -(DESPAWN.behind + CHUNK * 2) || dx > DESPAWN.ahead + CHUNK * 2) {
				this.chunks.delete(index);
			}
		});
	}

	despawn (x) {
		const {behind, ahead} = DESPAWN;

		this.props.forEach(prop => {
			const {x: propX, y: propY} = prop.position;
			const dx = propX - x;

			// Anything that fell off the world goes too
			if (dx < -behind || dx > ahead || propY < -10) {
				this.remove(prop);
			}
		});
	}

	// Only call between frames, not during a physics step
	remove (prop) {
		this.impacts?.unregister(prop.colliders);
		this.emitters?.remove(prop.object3d);
		this.explosives?.remove(prop);
		prop.destroy();
		this.props.delete(prop);
	}

	createChunk (index) {
		const size = CHUNK;
		const start = index * size;

		this.slots(start, size, CONFIG.obstacles, x => pickWeighted(OBSTACLES, ([weight]) => weight)[1](this, x));

		// Pickups up in the air
		if (this.pickups) {
			this.slots(start, size, CONFIG.pickups, x => {
				const ground = this.ground.heightAt(x);

				if (ground !== null && this.ground.contains(x, CONFIG.edge)) {
					this.pickups.spawn(x, ground + THREE.MathUtils.randFloat(...CONFIG.pickups.height));
				}
			});
		}
	}

	// Helpers
	// Every `spacing` m from `offset` (in map x) that falls inside this chunk (none in some, when the spacing is
	// bigger than a chunk), each used by `chance` and nudged up to `jitter` m forward, never right where io8 starts
	slots (start, size, {spacing, offset, chance, jitter}, callback) {
		for (let slot = Math.ceil((start - offset) / spacing) * spacing + offset; slot < start + size; slot += spacing) {
			const x = slot + Math.random() * jitter;

			if (Math.abs(x - this.startX) > CONFIG.safeZone && Math.random() < chance) {
				callback(x);
			}
		}
	}

	// On the ground on io8's path (z = 0). Returns null when there's no ground to put it on
	spawn (name, x) {
		const model = this.models[name];

		if (!this.ground.contains(x, CONFIG.edge)) {
			return null;
		}

		const groundY = this.ground.heightUnder(x, 0, Math.max(model.size.x, model.size.z));

		if (groundY === null) {
			return null;
		}

		const entity = new SleekEntity(model.object3d.clone(), this.physics, {
			pos: {x, y: groundY - model.bottom + GAP, z: 0}
		});

		this.scene.add(entity.object3d);
		this.props.add(entity);
		this.emitters?.add(entity.object3d);
		this.explosives?.add(entity);
		this.impacts?.add(entity);

		return entity;
	}
}
