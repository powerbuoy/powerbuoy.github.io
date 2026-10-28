import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import SleekLoader from '../sleek/loader.js';
import {randomItem} from '../sleek/utils.js';

import Explosion from './explosion.js';
import {ROBOT_GROUPS} from './io8.js';

// Where the Kenney sound packs are (see config.sounds)
const SOUNDS = './assets/audio';

const Y = new THREE.Vector3(0, 1, 0);
const center = new THREE.Vector3();

/*
	Laser bolts. They fly (not an instant beam), but they're far too fast for a physics body: they'd pass
	through a mine between two steps. So each frame the bolt's own shape (a capsule, so it can't slip through a
	gap thinner than itself, like the seam between two pieces of debris) is swept over the stretch it covers, and
	if it hits something the bolt stops there and blows up (a small blast, and an Explosion's shockwave). They glow
	from bloom, no real lights (changing the number of lights makes three.js recompile its shaders). Whoever
	fires them aims them and keeps track of their own ammo (see IO8.shoot())

	The gun itself (how its bolts look, fly, hit and sound) is the model's: custom properties on its Muzzle empty,
	see gun() and the README. One Lasers for each kind of shooter (io8, the drones), so a new one with a Muzzle
	just works
*/
export default class Lasers {
	bolts = new Set();
	sounds = {};

	// Called with (point, blast config) whenever a bolt blows up, so everything nearby can react (see App.blast())
	onBlast = null;

	constructor (scene, physics, audio, impacts, blasts, muzzle, conf = {}) {
		this.scene = scene;
		this.physics = physics;
		this.audio = audio;
		this.impacts = impacts;
		this.blasts = blasts;
		this.config = Object.assign({
			// Collision groups of whoever fires them, whose own parts they fly through (see castShape())
			groups: ROBOT_GROUPS,

			// The rest is for whatever the Muzzle doesn't say (see gun()).
			// Bolt size (m) and speed (m/s). It should be longer than it moves in a frame, or it looks like dots
			length: 0.3,
			radius: 0.012,
			speed: 50,

			// Colour, and how far past white it's pushed so bloom makes it glow
			color: '#ff1a1a',
			brightness: 6,

			// How far (m) they go before disappearing
			range: 40,

			// The blast where it hits: things within `radius` (m) get up to `impulse` N·s per m² facing it (167 sends
			// a mine off at 7 m/s, see Explosion.shockwave()), and how big it looks and sounds (see Blasts,
			// 1 = io8 or a mine blowing up). Within `reach` (m) io8 and drones lose up to `damage` health and mines go
			// off, see App.blast() and Explosion.damageTo()
			blast: {radius: 3, impulse: 167, size: 0.5, damage: 40, reach: 1.5},

			// Sounds (5 variations of each, a random one plays): files in Kenney's sci-fi pack, or "pack/name" for
			// another Kenney pack (e.g. "impact-sounds/impactGeneric_light"). And their volumes (0-1)
			// (`empty` is the dry click when whoever holds it fires with no charge left), and their pitch (1 = as recorded)
			sounds: {fire: 'laserRetro', empty: 'impact-sounds/impactGeneric_light'},
			volume: {fire: 0.18, hit: 0.6, empty: 0.5},
			pitch: {fire: 1, empty: 1}
		}, conf);

		Object.assign(this.config, Lasers.gun(muzzle, this.config));

		const {length, radius, color, brightness} = this.config;

		// Along Y with the tip at the origin, so a bolt's position is its front end (where the ray starts from)
		this.geometry = new THREE.CapsuleGeometry(radius, length - radius * 2, 4, 8).translate(0, -length / 2, 0);
		this.material = new THREE.MeshBasicMaterial({color: SleekLoader.colorOf(color).multiplyScalar(brightness)});
		// The same capsule for the physics, swept along each frame (along Y, centred on its position)
		this.shape = new RAPIER.Capsule((length - radius * 2) / 2, radius);
	}

	// The gun from the custom properties on its Muzzle empty, `defaults` for any it doesn't have: bolt_speed,
	// bolt_length, bolt_radius, bolt_color, bolt_brightness and range, the blast_* of a hit (see Explosion.blastOf()), sound_fire and
	// sound_empty, and volume_fire, volume_hit, volume_empty, pitch_fire and pitch_empty
	static gun (muzzle, defaults) {
		const {userData} = muzzle;
		const number = (key, fallback) => Number(userData[key] ?? fallback);
		const {sounds, volume, pitch} = defaults;

		return {
			speed: number('bolt_speed', defaults.speed),
			length: number('bolt_length', defaults.length),
			radius: number('bolt_radius', defaults.radius),
			color: userData.bolt_color ?? defaults.color,
			brightness: number('bolt_brightness', defaults.brightness),
			range: number('range', defaults.range),
			blast: Explosion.blastOf(muzzle, defaults.blast),
			sounds: {fire: userData.sound_fire ?? sounds.fire, empty: userData.sound_empty ?? sounds.empty},
			volume: {fire: number('volume_fire', volume.fire), hit: number('volume_hit', volume.hit), empty: number('volume_empty', volume.empty)},
			pitch: {fire: number('pitch_fire', pitch.fire), empty: number('pitch_empty', pitch.empty)}
		};
	}

	async init () {
		await Promise.all(Object.entries(this.config.sounds).map(async ([name, file]) => {
			const [pack, sound] = file.includes('/') ? file.split('/') : ['sci-fi-sounds', file];

			this.sounds[name] = await this.audio.loadVariations(`${SOUNDS}/kenney_${pack}/Audio/${sound}`);
		}));
	}

	playSound (name, position) {
		this.audio.playAt(randomItem(this.sounds[name]), position, {volume: this.config.volume[name], rate: this.config.pitch[name]});
	}

	// For App.warmUp(): a bolt, so its shader is compiled before the first shot
	standIns () {
		return [new THREE.Mesh(this.geometry, this.material)];
	}

	step (deltaTime) {
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
		const {speed, range, blast, volume, length, groups} = this.config;
		const {mesh} = bolt;
		const distance = speed * deltaTime;

		// The position is the tip, the capsule's centre is half a bolt behind it. The sweep's "velocity" is
		// the unit direction, so its time of impact is how far (m) the bolt gets before it touches something.
		// Skips the parts of whoever fired it (same collision groups as them), so nothing shoots itself
		center.copy(mesh.position).addScaledVector(bolt.direction, -length / 2);

		const hit = this.physics.world.castShape(center, mesh.quaternion, bolt.direction, this.shape, 0, distance, true, undefined, groups);

		if (hit) {
			const point = mesh.position.clone().addScaledVector(bolt.direction, hit.time_of_impact);
			// The sound first: the blast may blow up what it hit (a drone, a mine), and its collider with it.
			// Hits io8 too if he's close, so don't shoot point blank
			this.impacts.hit(hit.collider, point, volume.hit);
			this.remove(bolt);
			new Explosion(this.scene, this.physics, point, blast).shockwave();
			this.blasts.spawn(point, blast.size);
			this.onBlast?.(point, blast);

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
