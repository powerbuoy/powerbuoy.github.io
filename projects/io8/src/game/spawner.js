import * as THREE from 'three';

import SleekLoader from '../sleek/loader.js';
import SleekEntity from '../sleek/entity.js';

// Tiny gap so stacked things start apart and settle, instead of starting inside each other
const GAP = 0.005;

const MODELS = {
	cardboard: './assets/gltf/props/Cardboard/Cardboard.gltf'
};

// What each prop sounds like when it hits something (see impacts.js)
const IMPACT = {cardboard: 'cardboard'};

// How far behind and ahead of io8 (m) the road is filled in. Ahead has to reach past what the camera can see
// (view 3 looks a long way down the road), or things visibly pop in
const RANGE = {behind: 6, ahead: 80};

// The road is built in chunks of this many metres, each with a couple of obstacles and some background clutter
const CHUNK = 10;

// Anything that ends up this far from io8 (debris and pickups included) is removed, a chunk past the range so
// what was just built doesn't go straight away
export const DESPAWN = {behind: RANGE.behind + 2, ahead: RANGE.ahead + CHUNK};

const CONFIG = {

	// Nothing spawns closer than this to either end of the map
	edge: 2,

	// An obstacle slot every spacing m (offset from the map's x = 0), each one used by chance
	obstacles: {spacing: 15, offset: 2, chance: 0.7},

	// A pickup slot every spacing m like the obstacles, nudged up to `jitter` m forward so they don't line up,
	// and how high above the ground (m). io8 is about 1.15 m tall with his antenna up, so they're all out of
	// reach without flying. Which pickup it is depends on their `frequency` (see Pickups)
	pickups: {spacing: 25, offset: 9, jitter: 5, chance: 0.8, height: [1.5, 2.5]},

	// Keep the spot io8 starts on clear (distance from its start)
	safeZone: 3
};

// Obstacles on io8's path, weighted by how often they show up
const OBSTACLES = [
	[3, (s, x) => s.pyramid('cardboard', x, 0, 3 + s.int(2))],
	[2, (s, x) => s.tower('cardboard', x, 0, 3 + s.int(4))],
	[2, (s, x) => s.wall('cardboard', x, 0, 3, 1 + s.int(2))],
	[1, (s, x) => s.stairs('cardboard', x, 0, 3 + s.int(3))],

	// Heavy enough that you need to fly over it, or the weight pickup to plough through (3 rows of cardboard, io8
	// can still push through on his own)
	[2, (s, x) => s.fullPyramid('cardboard', x, 0, 4 + s.int(2))]
];

// Background clutter, just for looks (until something knocks it over)
const DECORATIONS = [
	(s, x, z) => s.tower('cardboard', x, z, 1 + s.int(3))
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

	setPickups (pickups) {
		this.pickups = pickups;
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
			const shape = object3d.getObjectByName(object3d.children[0].name.replace(/_RigidBody$/, '_Shape'));
			const box = new THREE.Box3().setFromObject(shape);

			this.models[name] = {object3d, size: box.getSize(new THREE.Vector3()), bottom: box.min.y};
		}));
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
				this.impacts?.unregister(prop.colliders);
				prop.destroy();
				this.props.delete(prop);
			}
		});
	}

	createChunk (index) {
		const size = CHUNK;
		const start = index * size;

		this.slots(start, size, CONFIG.obstacles, slot => this.pick(OBSTACLES)(this, slot + Math.random() * 1.5));

		// Pickups up in the air
		if (this.pickups) {
			this.slots(start, size, CONFIG.pickups, slot => {
				const x = slot + Math.random() * CONFIG.pickups.jitter;
				const ground = this.ground.heightAt(x);

				if (ground !== null && this.ground.contains(x, CONFIG.edge)) {
					this.pickups.spawn(x, ground + THREE.MathUtils.randFloat(...CONFIG.pickups.height));
				}
			});
		}

		// Some clutter along the back
		for (let i = this.int(3); i > 0; i--) {
			this.pick(DECORATIONS.map(fn => [1, fn]))(this, start + Math.random() * size, -1 - Math.random() * 0.8);
		}
	}

	// Helpers
	// Every `spacing` m from `offset` (in map x) that falls inside this chunk (none in some, when the spacing is
	// bigger than a chunk), each used by `chance`, never right where io8 starts
	slots (start, size, {spacing, offset, chance}, callback) {
		for (let slot = Math.ceil((start - offset) / spacing) * spacing + offset; slot < start + size; slot += spacing) {
			if (Math.abs(slot - this.startX) > CONFIG.safeZone && Math.random() < chance) {
				callback(slot);
			}
		}
	}

	int (max) {
		return Math.floor(Math.random() * max);
	}

	// Weighted random pick from [[weight, value], ...]
	pick (options) {
		let roll = Math.random() * options.reduce((sum, [weight]) => sum + weight, 0);

		return options.find(([weight]) => (roll -= weight) < 0)[1];
	}

	// y is the height above the ground (for stacking). Returns null when there's no ground to put it on
	spawn (name, x, y, z, rotY = 0) {
		const model = this.models[name];

		if (!this.ground.contains(x, CONFIG.edge)) {
			return null;
		}

		const groundY = this.ground.heightUnder(x, z, Math.max(model.size.x, model.size.z));

		if (groundY === null) {
			return null;
		}

		const entity = new SleekEntity(model.object3d.clone(), this.physics, {
			pos: {x, y: groundY - model.bottom + y + GAP, z},
			rot: {y: rotY}
		});

		this.scene.add(entity.object3d);
		this.props.add(entity);

		if (IMPACT[name]) {
			this.impacts?.register(entity.colliders, IMPACT[name]);
		}

		return entity;
	}

	// Shapes
	// Built along Z so io8 hits it head on, pieces turned 90° so it's wide but thin and easy to punch through
	pyramid (name, x, z, rows) {
		const {size} = this.models[name];

		for (let row = 0; row < rows; row++) {
			const count = rows - row;

			for (let i = 0; i < count; i++) {
				this.spawn(name, x, row * (size.y + GAP), z + (i - (count - 1) / 2) * (size.x + GAP), Math.PI / 2);
			}
		}
	}

	// A pyramid in both directions: rows x rows at the bottom, one smaller each way per layer, every piece
	// resting on the four below it. 3 rows is 14 pieces, 4 is 30, 5 is 55
	fullPyramid (name, x, z, rows) {
		const {size} = this.models[name];

		for (let layer = 0; layer < rows; layer++) {
			const count = rows - layer;

			for (let i = 0; i < count; i++) {
				for (let j = 0; j < count; j++) {
					this.spawn(name, x + (i - (count - 1) / 2) * (size.x + GAP), layer * (size.y + GAP), z + (j - (count - 1) / 2) * (size.z + GAP));
				}
			}
		}
	}

	// A flat wall across the road, same orientation as the pyramids
	wall (name, x, z, width, height) {
		const {size} = this.models[name];

		for (let row = 0; row < height; row++) {
			for (let i = 0; i < width; i++) {
				this.spawn(name, x, row * (size.y + GAP), z + (i - (width - 1) / 2) * (size.x + GAP), Math.PI / 2);
			}
		}
	}

	// Slightly twisted so it looks hand stacked (and topples more interestingly)
	tower (name, x, z, count) {
		const {size} = this.models[name];

		for (let i = 0; i < count; i++) {
			this.spawn(name, x, i * (size.y + GAP), z, (Math.random() - 0.5) * 0.4);
		}
	}

	// Steps going up in io8's direction, a thrust-over or a smash-through
	stairs (name, x, z, steps) {
		const {size} = this.models[name];

		for (let step = 0; step < steps; step++) {
			for (let i = 0; i <= step; i++) {
				this.spawn(name, x + step * (size.x + GAP), i * (size.y + GAP), z);
			}
		}
	}
}
