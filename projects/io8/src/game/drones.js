import * as THREE from 'three';

import SleekLoader from '../sleek/loader.js';
import SleekEntity from '../sleek/entity.js';
import {randomItem} from '../sleek/utils.js';

import Explosion from './explosion.js';
import Lasers from './lasers.js';
import Debris from './debris.js';

const MODEL = './assets/gltf/enemies/Drone/Drone.gltf';

// Drones are in their own collision group: their bolts and their dive fly through drones (their own and each other)
const DRONE_GROUP = 0x0008;
const DRONE_GROUPS = (DRONE_GROUP << 16) | (0xFFFF & ~DRONE_GROUP);

const Z = new THREE.Vector3(0, 0, 1);
const position = new THREE.Vector3();
const next = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const origin = new THREE.Vector3();
const direction = new THREE.Vector3();
const playerVelocity = new THREE.Vector3();

// A slow wave with a smaller, quicker one on top, so drifting swings most of the way every time but never
// repeats exactly (-1..1)
function wave (t, slow, quick, phase) {
	return Math.sin(t * slow + phase) * 0.75 + Math.sin(t * quick + phase * 2) * 0.25;
}

/*
	One drone. Where it is in its life is just how long it's been around (see physicsStep()): it swoops in from the
	top right, hovers ahead of and above io8 shooting at him, warns, then dives at where he was and blows up on
	whatever it hits, so it has to be shot down before then. A kinematic body: it flies where the code says,
	pushing whatever's in its way
*/
class Drone extends SleekEntity {
	// Seconds since it appeared (game time, it stops while paused)
	time = 0;

	// Where on io8's plane it hovers around (and how fast that's moving along the road) and what it aims at, set
	// every frame by Drones
	anchor = new THREE.Vector3();
	anchorSpeed = 0;
	aimAt = new THREE.Vector3();

	// Lowest it can go (its middle) until it dives, kept above the ground under it by Drones
	floor = -Infinity;

	// Darting about: where it's darting to (from the anchor), how far it's got, and when the next dart is
	dartTo = new THREE.Vector3();
	dart = new THREE.Vector3();
	nextDart = 0;

	shots = 0;
	blink = 0;
	hasWarned = false;

	// Called with how much health a blast took (see Drones.blast())
	onHit = null;

	// Set when the dive starts: which way it flies, how fast it's going now and how far it's gone
	diveDirection = null;
	diveSpeed = 0;
	dived = 0;

	// Where it hit something on its dive (or ran out of range), for Drones to blow it up between physics steps
	crashedAt = null;

	constructor (object3d, physics, conf) {
		super(object3d, physics, conf);

		this.body = this.mainBody;
		this.colliders.forEach(collider => collider.setCollisionGroups(DRONE_GROUPS));
		this.muzzleObject = object3d.getObjectByName('Muzzle');

		// Its own copy of the eye's material, so each drone can glow on its own
		this.eye = object3d.getObjectByName('Drone_Eye');
		this.eye.material = this.eye.material.clone();
		this.eyeGlow = this.eye.material.emissiveIntensity;

		this.phase = Math.random() * Math.PI * 2;
		this.angle = Math.PI;
		this.health = this.config.health;

		// Better now than on the first shot
		if (!this.muzzleObject) {
			throw new Error('Drone: the model has no "Muzzle" empty (where its bolts leave from)');
		}

		// Work out the debris shapes now, so being shot doesn't hitch
		Explosion.prepare(object3d);
	}

	// 0-1, what its hurt emitters show (see Emitters)
	get healthLevel () {
		return this.health / this.config.health;
	}

	damage (amount) {
		const lost = Math.min(this.health, amount);

		this.health -= lost;
		this.onHit?.(lost);
	}

	get diveTime () {
		const {enter, hover, warn} = this.config;

		return enter.time + hover.time + warn.time;
	}

	physicsStep (timestep) {
		if (this.crashedAt) {
			return;
		}

		const {enter, hover, warn, dart, turn} = this.config;

		this.time += timestep;
		this.body.translation(position);
		this.body.rotation(rotation);

		if (this.time < this.diveTime) {
			const t = this.time;
			const arrived = Math.min(1, t / enter.time);

			// Swooping in: from where it appeared to the anchor, dipping below it on the way and rising into place.
			// The drift fades in as it arrives, so there's no jump when it starts hovering
			next.copy(this.anchor).addScaledVector(this.offset, (1 - arrived) ** 2);
			next.y -= enter.dip * Math.sin(Math.PI * arrived);
			next.x += hover.wobble.x * wave(t, 0.6, 1.7, this.phase) * arrived;
			next.y += hover.wobble.y * wave(t, 1.1, 2.9, this.phase + 1) * arrived;

			// Every so often it darts off somewhere new near its spot, fast at first and easing to a stop
			if (t > this.nextDart) {
				this.dartTo.set(THREE.MathUtils.randFloatSpread(dart.size.x * 2), THREE.MathUtils.randFloatSpread(dart.size.y * 2), 0);
				this.nextDart = t + THREE.MathUtils.randFloat(...dart.every);
			}

			this.dart.lerp(this.dartTo, 1 - Math.exp(-dart.speed * timestep));
			next.addScaledVector(this.dart, arrived);

			// Shaking harder the closer it gets to diving
			const warning = (t - enter.time - hover.time) / warn.time;

			if (warning > 0) {
				next.x += Math.sin(t * 61) * warn.shake * warning;
				next.y += Math.sin(t * 53) * warn.shake * warning;
			}

			// However it drifts, darts or dips, never into the ground
			next.y = Math.max(next.y, this.floor);
		}
		else if (this.dive(timestep)) {
			return;
		}

		// Its eye (-X) turns towards io8
		direction.copy(this.aimAt).sub(next);

		const target = Math.atan2(direction.y, direction.x) + Math.PI;
		const error = THREE.MathUtils.euclideanModulo(target - this.angle + Math.PI, Math.PI * 2) - Math.PI;

		this.angle += error * Math.min(1, turn * timestep);

		this.body.setNextKinematicTranslation(next);
		this.body.setNextKinematicRotation(rotation.setFromAxisAngle(Z, this.angle));
	}

	// Straight at where io8 was when it started, faster and faster. The drone's own shape is swept along each step
	// (like a laser bolt), so it can't fly through anything. True once it's hit something
	dive (timestep) {
		const {accel, speed, range} = this.config.dive;

		if (!this.diveDirection) {
			this.diveDirection = new THREE.Vector3().copy(this.aimAt).sub(position).setZ(0).normalize();
		}

		this.diveSpeed = Math.min(speed, this.diveSpeed + accel * timestep);

		const distance = this.diveSpeed * timestep;
		const hit = this.physics.world.castShape(position, rotation, this.diveDirection, this.colliders[0].shape, 0, distance, true, undefined, DRONE_GROUPS);

		if (hit || this.dived > range) {
			this.crashedAt = position.clone().addScaledVector(this.diveDirection, hit?.time_of_impact ?? 0);

			return true;
		}

		next.copy(position).addScaledVector(this.diveDirection, distance);
		this.dived += distance;

		return false;
	}

	// Every frame: the shooting, the eye, the warning. `lasers` are the drones' own, `canShoot` false once io8 is gone
	step (deltaTime, lasers, canShoot, warnSound) {
		const {enter, hover, warn, attack, eye} = this.config;
		const h = this.time - enter.time;
		const material = this.eye.material;

		// Bursts of `shots` while it hovers, the first `first` seconds in, then every `every`
		if (canShoot && h > 0 && h < hover.time) {
			while (this.shots < Drone.shotsDue(h, attack)) {
				this.fire(lasers);
			}
		}

		if (h > hover.time) {
			// Blinking faster and faster until it dives, then lit up
			const warning = Math.min(1, (h - hover.time) / warn.time);

			if (!this.hasWarned) {
				this.hasWarned = true;
				warnSound(this.position);
			}

			this.blink += THREE.MathUtils.lerp(warn.blink[0], warn.blink[1], warning) * deltaTime;
			material.emissiveIntensity = this.eyeGlow * (warning >= 1 || this.blink % 1 < 0.5 ? eye.bright : eye.dim);
		}
		else {
			// Charging up before each burst
			const nextBurst = Drone.nextBurst(h, attack);
			const charge = canShoot && nextBurst < hover.time ? Math.max(0, 1 - (nextBurst - h) / attack.charge) : 0;

			material.emissiveIntensity = this.eyeGlow * THREE.MathUtils.lerp(1, eye.bright, charge);
		}
	}

	fire (lasers) {
		this.muzzleObject.getWorldPosition(origin);
		direction.copy(this.aimAt).sub(origin).setZ(0).normalize();
		lasers.fire(origin, direction);
		this.shots++;
	}

	// How many shots should have gone by `h` seconds into hovering
	static shotsDue (h, {first, every, shots, spacing}) {
		if (h < first) {
			return 0;
		}

		// Which burst it's on (0 is the first) and how long since it started
		const burst = Math.floor((h - first) / every);
		const since = h - first - burst * every;

		return burst * shots + Math.min(shots, Math.floor(since / spacing) + 1);
	}

	// When (s into hovering) the next burst starts
	static nextBurst (h, {first, every}) {
		return h < first ? first : first + (Math.floor((h - first) / every) + 1) * every;
	}
}

/*
	Enemy drones (see Drone). One at a time for now: the next one comes a while after the last one's gone. Any blast
	that reaches one (io8's bolts, a mine) shoots it down and it falls apart, diving it blows up itself. They fire
	bolts like his (their own Lasers, slower so they can be dodged)
*/
export default class Drones {
	drones = new Set();

	// Called with (point, blast config) whenever a drone crashes or one of their bolts blows up, so everything
	// nearby can react (see App.blast())
	onBlast = null;

	constructor (scene, physics, audio, impacts, blasts, conf = {}) {
		this.scene = scene;
		this.physics = physics;
		this.audio = audio;
		this.blasts = blasts;
		this.config = Object.assign({
			// The first one comes `delay` seconds in, each next one a random `interval` (s) after the last one's gone,
			// at most `max` at once
			spawn: {delay: 6, interval: [4, 8], max: 1},

			// Swooping in: from `from` (m ahead of and above io8, out of view) in `time` seconds, dipping `dip` m
			// below where it's headed on the way
			enter: {time: 1.6, from: [12, 7], dip: 1.5},

			// Hovering: `x` m ahead of io8 (picked at random between the two), drifting up to `wobble` m, for `time`
			// seconds before it warns. Kept to io8 rather than the screen, since some camera views look down the road.
			// It keeps up with him on a spring (`stiffness`, `damping`): spot on while he cruises, falling behind when
			// he speeds up and drifting ahead when he brakes. Its height is its own, `y` m above the ground under it
			// (easing to a new height at `follow` per second over hills), so it doesn't copy his every bump and jump
			hover: {x: [3, 5], y: 2.7, follow: 1.5, stiffness: 4, damping: 4, wobble: {x: 1, y: 1}, time: 7},

			// However it moves, its middle stays at least `clearance` m above the ground under it (the highest within
			// `width` m), until it dives
			floor: {clearance: 1, width: 1},

			// Darting about while it hovers: somewhere new up to `size` m from its spot every `every` s (random between
			// the two), getting most of the way there in about 1 / `speed` s
			dart: {every: [0.8, 2.5], size: {x: 1, y: 0.8}, speed: 6},

			// Bursts of `shots` bolts `spacing` s apart while it hovers, the first `first` s after it's settled and then
			// every `every` s, its eye charging up for `charge` s before each one (the first one charges as it
			// swoops in)
			attack: {first: 0, every: 2.2, charge: 0.6, shots: 3, spacing: 0.18},

			// Warning before the dive: `time` s of blinking `blink` times a second (speeding up from the first to the
			// second) and shaking up to `shake` m
			warn: {time: 1.2, blink: [3, 14], shake: 0.05},

			// The dive: speeding up at `accel` m/s² to `speed` m/s, blowing up anyway after `range` m
			dive: {accel: 25, speed: 16, range: 30},

			// How fast it turns to face io8 (higher is snappier)
			turn: 8,

			// How much a blast has to take off to shoot it down, see blast(). io8's bolts do up to 40 (so a direct hit
			// still does it), a mine 100
			health: 30,

			// The eye's glow, times its brightness in the model: charged up or blinking on (`bright`) and off (`dim`)
			eye: {bright: 5, dim: 0.2},

			// Blowing up on its dive: like a laser blast but bigger (see Lasers), io8 loses up to `damage` health
			// within `reach` m. Shot down it only falls apart, `size` is how big that looks
			crash: {radius: 3, impulse: 167, size: 0.8, damage: 35, reach: 2},
			shotDown: {size: 0.6},

			// The warning sound (Kenney's sci-fi pack), its volume and pitch
			warnSound: {name: 'forceField', volume: 0.6, pitch: 1.4}
		}, conf);

		// Slower and weaker than io8's, so they can be dodged and a hit doesn't hurt him as much as his own
		this.lasers = new Lasers(scene, physics, audio, impacts, blasts, {
			groups: DRONE_GROUPS,
			speed: 15,
			length: 0.25,
			color: 0xff6a1a,
			blast: {radius: 1.5, impulse: 80, size: 0.3, damage: 10, reach: 1},
			sounds: {fire: 'laserSmall'},
			volume: {fire: 0.3, hit: 0.4},
			pitch: {fire: 0.8}
		});

		this.lasers.onBlast = (point, blast) => this.onBlast?.(point, blast);

		this.debris = new Debris(impacts);
		this.untilNext = this.config.spawn.delay;
	}

	// Call once the map exists, they hover above it
	setGround (ground) {
		this.ground = ground;
	}

	// Their hurt emitters (smoke and sparks as they lose health, like io8's)
	setEmitters (emitters) {
		this.emitters = emitters;
	}

	async init () {
		const [model, warnSound] = await Promise.all([
			SleekLoader.loadObject(MODEL),
			this.audio.loadVariations(`./assets/audio/kenney_sci-fi-sounds/Audio/${this.config.warnSound.name}`),
			this.lasers.init()
		]);

		this.model = model;
		this.warnSounds = warnSound;
		this.warn = at => this.audio.playAt(randomItem(this.warnSounds), at, {volume: this.config.warnSound.volume, rate: this.config.warnSound.pitch});
	}

	// For App.warmUp(): a drone and one of its bolts, so their shaders are compiled before the first one shows up
	standIns () {
		return [this.model.clone(), ...this.lasers.standIns()];
	}

	// Every frame, after io8's lasers (they may have shot one down). `focus` is where io8 is (or blew up)
	step (deltaTime, player, focus) {
		const {spawn, hover} = this.config;
		const canShoot = !player.isExploded;
		const speed = canShoot ? player.legs.linvel(playerVelocity).x : 0;

		if (canShoot && this.drones.size < spawn.max) {
			this.untilNext -= deltaTime;

			if (this.untilNext <= 0) {
				this.spawn(focus, speed);
				this.untilNext = THREE.MathUtils.randFloat(...spawn.interval);
			}
		}

		this.drones.forEach(drone => {
			if (drone.crashedAt) {
				this.explode(drone, true);

				return;
			}

			// A spring towards its spot ahead of him, damped against his speed rather than standing still, so it holds
			// that spot while he cruises
			drone.anchorSpeed += (hover.stiffness * (focus.x + drone.hoverX - drone.anchor.x) + hover.damping * (speed - drone.anchorSpeed)) * deltaTime;
			drone.anchor.x += drone.anchorSpeed * deltaTime;
			drone.anchor.y += (this.hoverHeight(drone.anchor.x, drone.anchor.y) - drone.anchor.y) * Math.min(1, hover.follow * deltaTime);
			drone.aimAt.copy(focus);
			drone.floor = this.floorAt(drone.position.x);
			drone.step(deltaTime, this.lasers, canShoot, this.warn);
		});

		this.lasers.step(deltaTime);
		this.debris.step(deltaTime);
	}

	spawn (focus, speed) {
		const {enter, hover} = this.config;
		const hoverX = THREE.MathUtils.randFloat(...hover.x);
		const start = new THREE.Vector3(focus.x + enter.from[0], focus.y + enter.from[1], 0);
		const drone = new Drone(this.model.clone(), this.physics, {...this.config, pos: start});

		drone.hoverX = hoverX;
		drone.anchor.set(focus.x + hoverX, this.hoverHeight(focus.x + hoverX, focus.y + this.config.hover.y), 0);
		drone.anchorSpeed = speed;
		drone.offset = start.clone().sub(drone.anchor);

		this.scene.add(drone.object3d);
		this.drones.add(drone);
		this.emitters?.add(drone.object3d, drone);
		drone.onHit = lost => this.emitters?.hit(drone.object3d, lost);
	}

	// The lowest a drone at `x` may go (see Drone.floor), no limit where there's no ground under it
	floorAt (x) {
		const {clearance, width} = this.config.floor;
		const ground = this.ground?.heightUnder(x, 0, width) ?? null;

		return ground === null ? -Infinity : ground + clearance;
	}

	// How high a drone at `x` hovers, or `fallback` where there's no ground under it (past the end of the map)
	hoverHeight (x, fallback) {
		const ground = this.ground?.heightAt(x) ?? null;

		return ground === null ? fallback : ground + this.config.hover.y;
	}

	// Something blew up at `point` (see App.blast()): drones within its reach lose health (see
	// Explosion.damageTo()), and one that's out of it is shot down
	blast (point, blast) {
		this.drones.forEach(drone => {
			const amount = Explosion.damageTo(drone, point, blast);

			if (amount > 0) {
				drone.damage(amount);

				if (drone.health <= 0) {
					this.explode(drone);
				}
			}
		});
	}

	// Falls apart where it is, and if it `crashed` on its dive blows up properly where it hit
	explode (drone, crashed = false) {
		const {crash, shotDown} = this.config;
		const center = crashed ? drone.crashedAt : drone.position.clone();
		const velocity = new THREE.Vector3().copy(drone.body.linvel());
		const explosion = new Explosion(this.scene, this.physics, center, crash);

		explosion.shatter(drone.object3d, () => velocity);
		this.debris.add(explosion);

		this.emitters?.remove(drone.object3d);
		drone.destroy();
		this.drones.delete(drone);

		if (crashed) {
			explosion.shockwave();
			this.blasts.spawn(center, crash.size);
			this.onBlast?.(center, crash);
		}
		else {
			this.blasts.spawn(center, shotDown.size);
		}
	}
}
