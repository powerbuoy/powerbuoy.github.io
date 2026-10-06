import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import Explosion from './explosion.js';
import {ROBOT_GROUPS} from './io8.js';

// Where the Kenney sound packs are (see config.sounds)
const SOUNDS = './assets/audio';

const Y = new THREE.Vector3(0, 1, 0);
const origin = new THREE.Vector3();
const direction = new THREE.Vector3();
const center = new THREE.Vector3();

/*
	Laser bolts. They fly (not an instant beam), but they're far too fast for a physics body: they'd pass
	through a box between two steps. So each frame the bolt's own shape (a capsule, so it can't slip through a
	gap thinner than itself, like the seams between stacked boxes) is swept over the stretch it covers, and if
	it hits something the bolt stops there and blows up (a small blast, and an Explosion's shockwave). They glow
	from bloom, no real lights (changing the number of lights makes three.js recompile its shaders)
*/
export default class Lasers {
	bolts = new Set();
	sounds = {};
	sinceFired = 0;

	constructor (scene, physics, audio, impacts, blasts, conf = {}) {
		this.scene = scene;
		this.physics = physics;
		this.audio = audio;
		this.impacts = impacts;
		this.blasts = blasts;
		this.config = Object.assign({
			// Bolt size (m) and speed (m/s). It should be longer than it moves in a frame, or it looks like dots
			length: 0.3,
			radius: 0.012,
			speed: 50,

			// Colour, and how far past white it's pushed so bloom makes it glow
			color: 0xff1a1a,
			brightness: 6,

			// How far (m) they go before disappearing
			range: 40,

			// Shots in a full charge. Like the thruster fuel it starts refilling `refillDelay` seconds after the
			// last shot, and takes `refillTime` seconds to go from empty to full
			ammo: {capacity: 8, refillDelay: 2, refillTime: 2.5},

			// The blast where it hits: things within `radius` (m) get up to `impulse` N·s per m² facing it (167 sends
			// a cardboard box off at 15 m/s, see Explosion.shockwave()),
			// and how big it looks (see Blasts, 1 = io8 blowing up)
			blast: {radius: 3, impulse: 167, size: 0.5},

			// Sounds (5 variations of each, a random one plays): files in Kenney's sci-fi pack, or "pack/name" for
			// another Kenney pack (e.g. "impact-sounds/impactGeneric_light"). And their volumes (0-1)
			// (`empty` is the dry click when you fire with no charge left), and optionally their pitch (1 = as recorded)
			sounds: {fire: 'laserRetro', blast: 'explosionCrunch', empty: 'impact-sounds/impactGeneric_light'},
			volume: {fire: 0.18, blast: 0.7, hit: 0.6, empty: 0.5},
			pitch: {}
		}, conf);

		const {length, radius, color, brightness} = this.config;

		// Along Y with the tip at the origin, so a bolt's position is its front end (where the ray starts from)
		this.geometry = new THREE.CapsuleGeometry(radius, length - radius * 2, 4, 8).translate(0, -length / 2, 0);
		this.material = new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(brightness)});
		// The same capsule for the physics, swept along each frame (along Y, centred on its position)
		this.shape = new RAPIER.Capsule((length - radius * 2) / 2, radius);
		this.ammo = this.config.ammo.capacity;
	}

	// 0-1, for the ammo meter
	get ammoLevel () {
		return this.ammo / this.config.ammo.capacity;
	}

	async init () {
		await Promise.all(Object.entries(this.config.sounds).map(async ([name, file]) => {
			const [pack, sound] = file.includes('/') ? file.split('/') : ['sci-fi-sounds', file];

			this.sounds[name] = await Promise.all([0, 1, 2, 3, 4].map(i => this.audio.load(`${SOUNDS}/kenney_${pack}/Audio/${sound}_00${i}.ogg`)));
		}));
	}

	playSound (name, position) {
		const variations = this.sounds[name];

		this.audio.playAt(variations[Math.floor(Math.random() * variations.length)], position, {volume: this.config.volume[name], rate: this.config.pitch[name] ?? 1});
	}

	// `fire` is true on the frame the mouse was clicked (one shot per click)
	step (deltaTime, player, fire) {
		const {capacity, refillDelay, refillTime} = this.config.ammo;

		// Any charge at all fires (a shot with less than a whole one left just empties it), so the meter
		// never shows ammo you can't use. Every shot restarts the refill delay, so it can't be spammed
		if (fire && !player.isExploded && this.ammo > 0) {
			player.muzzle(origin, direction);
			this.fire(origin, direction);
			this.ammo = Math.max(0, this.ammo - 1);
			this.sinceFired = 0;
		}
		else {
			if (fire && !player.isExploded) {
				player.muzzle(origin, direction);
				this.playSound('empty', origin);
			}

			this.sinceFired += deltaTime;

			if (this.sinceFired > refillDelay) {
				this.ammo = Math.min(capacity, this.ammo + capacity / refillTime * deltaTime);
			}
		}

		this.bolts.forEach(bolt => this.move(bolt, deltaTime));
	}

	fire (position, dir) {
		const mesh = new THREE.Mesh(this.geometry, this.material);

		mesh.position.copy(position);
		mesh.quaternion.setFromUnitVectors(Y, dir);
		this.scene.add(mesh);
		this.bolts.add({mesh, direction: dir.clone(), travelled: 0});
		this.playSound('fire', position);
	}

	move (bolt, deltaTime) {
		const {speed, range, blast, volume, length} = this.config;
		const {mesh} = bolt;
		const distance = speed * deltaTime;

		// The position is the tip, the capsule's centre is half a bolt behind it. The sweep's "velocity" is
		// the unit direction, so its time of impact is how far (m) the bolt gets before it touches something.
		// Skips io8's own parts (same collision groups as them), so he can't shoot himself
		center.copy(mesh.position).addScaledVector(bolt.direction, -length / 2);

		const hit = this.physics.world.castShape(center, mesh.quaternion, bolt.direction, this.shape, 0, distance, true, undefined, ROBOT_GROUPS);

		if (hit) {
			const point = mesh.position.clone().addScaledVector(bolt.direction, hit.time_of_impact);
			// Hits io8 too if he's close, so don't shoot point blank
			new Explosion(this.scene, this.physics, point, blast).shockwave();
			this.blasts.spawn(point, blast.size);
			this.playSound('blast', point);
			this.impacts.hit(hit.collider, point, volume.hit);
			this.remove(bolt);

			return;
		}

		mesh.position.addScaledVector(bolt.direction, distance);
		bolt.travelled += distance;

		if (bolt.travelled > range) {
			this.remove(bolt);
		}
	}

	remove (bolt) {
		bolt.mesh.removeFromParent();
		this.bolts.delete(bolt);
	}
}
