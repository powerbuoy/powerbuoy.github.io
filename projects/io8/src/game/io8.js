import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import SleekEntity from '../sleek/entity.js';
import Explosion from './explosion.js';

// Robot parts are in their own collision group so overlapping parts (wheel/mudflap, head/legs) don't fight each other
const ROBOT_GROUP = 0x0002;
export const ROBOT_GROUPS = (ROBOT_GROUP << 16) | (0xFFFF & ~ROBOT_GROUP);

const CONTROLS = {
	forward: ['KeyD'],
	backward: ['KeyA'],
	thrust: ['KeyW'],
	brake: ['KeyS']
};

// Timed power-ups. Each one changes something on io8 and returns how to put it back when it runs out
const EFFECTS = {
	// amount = how many times faster
	speed (io8, amount) {
		const original = io8.config.maxSpeed;

		io8.config.maxSpeed *= amount;

		return () => io8.config.maxSpeed = original;
	},

	// amount = how many times heavier (the Weight pickup's amount). The motors and balance spring are acceleration based, so he drives the
	// same, but he slams through things instead of bouncing off them. Thrust is a plain force, so it can't
	// lift him any more, and the head spring is a plain spring, so the head sinks down onto its end stops
	weight (io8, amount) {
		const masses = io8.colliders.map(collider => collider.mass());

		io8.colliders.forEach((collider, i) => collider.setMass(masses[i] * amount));
		io8.massScale = amount;

		return () => {
			io8.colliders.forEach((collider, i) => collider.setMass(masses[i]));
			io8.massScale = 1;
		};
	}
};

const up = new THREE.Vector3();
const quat = new THREE.Quaternion();

export default class IO8 extends SleekEntity {
	keys = new Set();
	antennaIsUp = false;
	satelliteIsSpinning = true;
	isThrusting = false;

	// World point (on io8's plane) the head looks at, null = straight ahead. Set by the app from the mouse
	aim = null;

	isExploded = false;

	fuel = 0;

	// Active power-ups: name -> {remaining seconds, how to undo it}
	effects = new Map();

	// How many times heavier than normal (the weight power-up)
	massScale = 1;

	// How fast the wheel spins compared to normal top speed, eased (drives the engine sound)
	engineRevs = 0;
	sinceThrust = 0;

	constructor (object3d, physics, conf = {}) {
		super(object3d, physics, Object.assign({
			name: 'Robot',
			maxSpeed: 5,
			driveFactor: 100,
			brakeFactor: 40,
			rollFactor: 0.05,
			thrust: 110,

			// Thruster fuel: seconds of thrust in a full tank. Starts refilling `refillDelay` seconds after you let
			// go of the thrusters (anywhere, in the air too), empty to full in `refillTime` seconds.
			// Below `low` (0-1) the flames sputter
			fuel: {capacity: 2, refillDelay: 1, refillTime: 1.5, low: 0.25},

			balance: {stiffness: 1500, damping: 70, lean: 0.12},
			neck: {stiffness: 200, damping: 12},

			// Engine sound pitch (playback rate) and volume, from how fast the wheel spins: `idle` when still,
			// `top` at normal top speed. Past that (a speed boost) the pitch keeps climbing at the same rate, up to
			// `max` (4x speed reaches 2.5), the volume doesn't
			engine: {pitch: {idle: 0.5, top: 1, max: 2.5}, volume: {idle: 0.15, top: 0.5}},

			// Thruster sound volume while firing (it fades in and out with the flames)
			thrusterVolume: 0.8,

			// The head bobs on the leg springs (parts tagged "suspension" in Blender). Acceleration based like the neck,
			// travel is how far (m) it can squash down and stretch up before hitting the end stops
			suspension: {stiffness: 120, damping: 5, travel: [-0.12, 0.08]}
		}, conf));

		this.findParts();
		this.initPhysics();
		this.handleInput();

		this.fuel = this.config.fuel.capacity;

		// Work out the debris shapes now, so exploding doesn't hitch
		Explosion.prepare(this.object3d);
	}

	findParts () {
		const get = name => this.object3d.getObjectByName(name);
		const light = name => {
			let found = null;

			get(name)?.traverse(obj => obj.isLight && (found ??= obj));

			return found;
		};

		// Head
		this.satellite = get('RobotSatellite');
		this.satelliteDish = get('RobotSatelliteDish');
		this.antenna = get('RobotAntenna');
		this.eye = get('RobotEye');
		this.muzzleObject = get('Muzzle');

		// Headlight (remember its brightness and glow from Blender so toggling doesn't need magic numbers)
		this.headlight = light('RobotHeadlight');
		this.headlightBulb = get('RobotHeadlightBulb');
		this.headlightIntensity = this.headlight.intensity;
		this.headlightGlow = this.headlightBulb.material.emissiveIntensity;

		// Parts that move with the head's suspension, tagged in Blender with a "suspension" custom property:
		// "stretch" (the springs, origin at the bottom) stretch and squash, "slide" (the rod) moves up and down
		this.stretchParts = [];
		this.slideParts = [];

		this.object3d.traverse(obj => {
			if (obj.userData.suspension === 'stretch') {
				obj.geometry.computeBoundingBox();
				this.stretchParts.push({obj, length: obj.geometry.boundingBox.max.y});
			}
			else if (obj.userData.suspension === 'slide') {
				this.slideParts.push({obj, restY: obj.position.y});
			}
		});

		this.springOffset = 0;


		// Antenna
		this.antennaUp = 0.05;
		this.antennaDown = -0.06;
		this.antenna.position.y = this.antennaDown;

		// Thrusters
		this.flames = get('RobotThrusters');
		this.thrusterLights = [light('RobotThrustersLeftLight'), light('RobotThrustersRightLight')];
		this.thrusterIntensities = this.thrusterLights.map(l => l.intensity);
		this.setThrusters(false);
	}

	initPhysics () {
		const {RobotWheel: wheel, RobotLegs: legs, RobotHead: head} = this.bodies;

		this.wheel = wheel;
		this.legs = legs;
		this.head = head;
		this.legsObject = this.object3d.getObjectByName('RobotLegs_RigidBody');

		this.colliders.forEach(collider => collider.setCollisionGroups(ROBOT_GROUPS));

		// Wheel spins freely inside the legs, the motor on this joint is how we drive
		this.wheelJoint = this.physics.world.createImpulseJoint(
			RAPIER.JointData.revolute({x: 0, y: 0, z: 0}, IO8.localAnchor(legs, wheel.translation()), {x: 0, y: 0, z: 1}),
			wheel,
			legs,
			true
		);

		// The neck sits on the Connector axle through the middle of the head (the head's origin). The head can
		// turn around it (see turnHead()) and slide up and down along the legs on the springs (see suspension()).
		// A generic joint whose X axis is the legs' up: everything locked except sliding along it and turning around Z
		const neckPos = new THREE.Vector3().copy(head.translation());
		const headAnchor = IO8.localAnchor(head, neckPos);

		this.neckAnchor = IO8.localAnchor(legs, neckPos);
		this.neckJoint = this.physics.world.createImpulseJoint(
			RAPIER.JointData.generic(this.neckAnchor, headAnchor, {x: 0, y: 1, z: 0}, RAPIER.JointAxesMask.LinY | RAPIER.JointAxesMask.LinZ | RAPIER.JointAxesMask.AngX | RAPIER.JointAxesMask.AngY),
			legs,
			head,
			true
		);

		// How hard the head is to turn around the neck (its own inertia plus being off-center from the pivot)
		const com = head.localCom();

		this.neckInertia = head.principalInertia().z + head.mass() * ((headAnchor.x - com.x) ** 2 + (headAnchor.y - com.y) ** 2);

		// The head's normal weight, the suspension spring is tuned for it (see suspension())
		this.headMass = head.mass();

		// Balance and 2.5D in one go: an invisible body that can never rotate, hinged to the legs at the axle.
		// The hinge stops the legs (and so everything jointed to them) rotating around anything but Z,
		// and its motor is a spring keeping them upright. The solver handles it, so it can be stiff without exploding.
		// NOTE: Rapier's per-axis locks (setEnabledRotations/Translations) explode when combined with joints, hence all this
		const axle = wheel.translation();

		this.gyro = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
			.setTranslation(axle.x, axle.y, axle.z)
			.setAdditionalMass(0.1)
			.lockRotations());

		this.balanceJoint = this.physics.world.createImpulseJoint(
			RAPIER.JointData.revolute({x: 0, y: 0, z: 0}, IO8.localAnchor(legs, axle), {x: 0, y: 0, z: 1}),
			this.gyro,
			legs,
			true
		);

		// Pin the gyro (and so the whole robot) to its starting Z
		this.planeAnchor = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
		this.planeJoint = this.physics.world.createImpulseJoint(
			RAPIER.JointData.generic({x: 0, y: 0, z: axle.z}, {x: 0, y: 0, z: 0}, {x: 1, y: 0, z: 0}, RAPIER.JointAxesMask.LinZ),
			this.planeAnchor,
			this.gyro,
			true
		);
	}

	handleInput () {
		window.addEventListener('keydown', e => {
			this.keys.add(e.code);

			if (e.repeat) {
				return;
			}

			switch (e.code) {
				case 'KeyF':
					this.antennaIsUp = !this.antennaIsUp;
					break;

				case 'KeyC':
					this.toggleLight();
					break;

				case 'KeyV':
					this.satelliteIsSpinning = !this.satelliteIsSpinning;
					break;

				case 'Space':
					this.onExplode?.();
					break;
			}
		});

		window.addEventListener('keyup', e => this.keys.delete(e.code));

		// Otherwise a key held while switching tabs stays "down" forever
		window.addEventListener('blur', () => this.keys.clear());
	}

	isDown (action) {
		return CONTROLS[action].some(key => this.keys.has(key));
	}

	get drive () {
		return this.isDown('forward') - this.isDown('backward');
	}

	get isBraking () {
		return this.isDown('brake');
	}

	// What the camera (and spawner) should follow: the legs, or the head once it's flying on its own
	get focusObject () {
		return this.isExploded ? this.headPiece.object3d : this.legsObject;
	}

	get focusBody () {
		return this.isExploded ? this.headPiece.body : this.legs;
	}

	// Blow io8 apart: every mesh becomes a piece of debris keeping the speed its part had,
	// then the real bodies, joints and controls go. Only call between frames, not during a physics step
	explode (explosion) {
		if (this.isExploded) {
			return;
		}

		// Which body each mesh was riding on, so its debris keeps that body's speed
		const velocities = new Map(Object.entries(this.bodies).map(([name, body]) => [`${name}_RigidBody`, new THREE.Vector3().copy(body.linvel())]));
		const velocityOf = mesh => {
			for (let obj = mesh; obj; obj = obj.parent) {
				if (velocities.has(obj.name)) {
					return velocities.get(obj.name);
				}
			}

			return null;
		};

		const pieces = explosion.shatter(this.object3d, velocityOf);

		// The camera follows the piece with the back of the head in it (the head on its own, or the whole head)
		this.headPiece = pieces.find(piece => piece.object3d.getObjectByName('BackHead')) ?? pieces[0];
		this.isExploded = true;
		this.engineSound?.stop();
		this.thrusterSound?.stop();

		// Removing a body removes its joints too
		this.destroy();
		this.physics.world.removeRigidBody(this.gyro);
		this.physics.world.removeRigidBody(this.planeAnchor);
	}

	physicsStep (timestep) {
		const drive = this.drive;

		// Drive (positive motor velocity rolls towards +X, which is where the robot faces)
		if (this.isBraking) {
			this.wheelJoint.configureMotorVelocity(0, this.config.brakeFactor);
		}
		else if (drive) {
			this.wheelJoint.configureMotorVelocity(drive * this.config.maxSpeed / 0.25, this.config.driveFactor);
		}
		else {
			this.wheelJoint.configureMotorVelocity(0, this.config.rollFactor);
		}

		// Springs are set every step so you can tweak app.player.config live in the console.
		// NOTE: Rapier motors are acceleration based, so stiffness is roughly "how many g's", not a force
		const {stiffness, damping, lean} = this.config.balance;

		this.balanceJoint.configureMotorPosition(-drive * lean, stiffness, damping);

		this.turnHead(timestep);
		this.suspension(timestep);

		// Thrusters push along the legs, so tilting changes where you fly
		this.isThrusting = this.isDown('thrust') && this.fuel > 0;

		if (this.isThrusting) {
			up.set(0, 1, 0).applyQuaternion(quat.copy(this.legs.rotation())).multiplyScalar(this.config.thrust * timestep);
			this.legs.applyImpulse(up, true);
		}

		this.updateFuel(timestep);
		this.updateEffects(timestep);
	}

	// Start a power-up (see EFFECTS). Getting the same one again while it's running adds its time instead of
	// its strength, so two speed boosts last twice as long rather than making io8 way too fast for the physics.
	// The meter goes back to full and drains over the new total
	addEffect (name, {amount, duration}) {
		const active = this.effects.get(name);

		if (active) {
			active.remaining += duration;
			active.duration = active.remaining;

			return;
		}

		this.effects.set(name, {remaining: duration, duration, stop: EFFECTS[name](this, amount)});
	}

	// How much of a power-up is left (0-1), or null when it isn't running
	effectLevel (name) {
		const effect = this.effects.get(name);

		return effect ? effect.remaining / effect.duration : null;
	}

	// Seconds left of a power-up, or null when it isn't running
	effectRemaining (name) {
		return this.effects.get(name)?.remaining ?? null;
	}

	updateEffects (timestep) {
		this.effects.forEach((effect, name) => {
			effect.remaining -= timestep;

			if (effect.remaining <= 0) {
				effect.stop();
				this.effects.delete(name);
			}
		});
	}

	// Burns while thrusting, refills once you've let go of the thrusters for a moment
	updateFuel (timestep) {
		const {capacity, refillDelay, refillTime} = this.config.fuel;

		if (this.isThrusting) {
			this.fuel = Math.max(0, this.fuel - timestep);
			this.sinceThrust = 0;

			return;
		}

		this.sinceThrust += timestep;

		if (this.sinceThrust > refillDelay) {
			this.fuel = Math.min(capacity, this.fuel + capacity / refillTime * timestep);
		}
	}

	// 0-1, for the fuel meter
	get fuelLevel () {
		return this.fuel / this.config.fuel.capacity;
	}

	// A spring pulling the head towards the aim, done by hand rather than with the joint's motor because
	// the motor's angle stops at ±180° and would spin the head the long way round when you aim behind.
	// Same maths as the motor (acceleration based), so braking and accelerating still swing the head around.
	// Equal and opposite on the legs, so flicking the aim rocks io8 a little
	turnHead (timestep) {
		const {stiffness, damping} = this.config.neck;
		const headAngle = IO8.angleZ(this.head.rotation());
		const pos = this.head.translation();
		const target = this.aim ? Math.atan2(this.aim.y - pos.y, this.aim.x - pos.x) : IO8.angleZ(this.legs.rotation());
		const error = IO8.wrapAngle(target - headAngle);
		const relativeSpin = this.head.angvel().z - this.legs.angvel().z;
		const impulse = this.neckInertia * this.massScale * (stiffness * error - damping * relativeSpin) * timestep;

		this.head.applyTorqueImpulse({x: 0, y: 0, z: impulse}, true);
		this.legs.applyTorqueImpulse({x: 0, y: 0, z: -impulse}, true);
	}

	// The head riding on the leg springs. A spring along the legs between them, with gravity taken off so it
	// rests at the natural height and only squashes when something pushes (landing, bumps, hitting things)
	suspension (timestep) {
		const {stiffness, damping, travel} = this.config.suspension;
		const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat.copy(this.legs.rotation()));
		const anchor = new THREE.Vector3().copy(this.neckAnchor).applyQuaternion(quat).add(this.legs.translation());
		const head = new THREE.Vector3().copy(this.head.translation());

		// How far the head has moved up (+) or down (-) the legs, and how fast
		const offset = head.clone().sub(anchor).dot(up);
		const legsCom = this.legs.worldCom();
		const spin = this.legs.angvel().z;
		const anchorVelocity = new THREE.Vector3().copy(this.legs.linvel()).add({x: -spin * (anchor.y - legsCom.y), y: spin * (anchor.x - legsCom.x), z: 0});
		const speed = new THREE.Vector3().copy(this.head.linvel()).sub(anchorVelocity).dot(up);

		// Much stiffer past the end of the travel, like hitting the end stop
		const beyond = offset < travel[0] ? offset - travel[0] : offset > travel[1] ? offset - travel[1] : 0;
		const spring = -stiffness * offset + 9.81 * up.y;
		const endStop = -stiffness * 60 * beyond;

		// The spring is a real spring: its strength is set for the head's normal weight, not whatever it weighs
		// right now, so a heavier head (the weight power-up) sinks down onto the end stops. The end stops and
		// damping follow the actual weight, so however heavy it gets it stops there (instead of pushing through)
		// and settles instead of wobbling
		const force = this.headMass * spring + this.head.mass() * (endStop - damping * speed);
		const impulse = up.multiplyScalar(force * timestep);

		this.head.applyImpulseAtPoint(impulse, head, true);
		this.legs.applyImpulseAtPoint(impulse.negate(), anchor, true);

		this.springOffset = offset;
	}

	// Give io8 his sounds (buffers loaded by the app), they play from where he is
	initSounds (audio, {engine, thruster, impacts}) {
		// Bumps and crashes: the tyre thuds, everything else clanks. Judged by io8's whole weight (not just the
		// part that got hit), so bumping a light box sounds like the box, not like io8
		const weight = () => this.wheel.mass() + this.legs.mass() + this.head.mass();

		impacts.register(this.colliders.filter(collider => collider.parent().handle === this.wheel.handle), 'tyre', weight);
		impacts.register(this.colliders.filter(collider => collider.parent().handle !== this.wheel.handle), 'robot', weight);

		// Always playing, just silent until the flames are on, so starting and stopping is a quick fade, not a click
		this.thrusterSound = audio.positional(thruster, {loop: true, volume: 0});
		this.legsObject.add(this.thrusterSound);
		this.thrusterSound.play();

		this.engineSound = audio.positional(engine, {loop: true, volume: this.config.engine.volume.idle});

		// Wheel spin at normal top speed, remembered now so a speed boost revs higher instead of rescaling
		this.engineTopSpin = this.config.maxSpeed / 0.25;
		this.legsObject.add(this.engineSound);
		this.engineSound.play();
	}

	// The engine revs with the wheel: pitch and volume follow how fast it spins (relative to the legs)
	updateEngineSound (deltaTime) {
		if (!this.engineSound) {
			return;
		}

		const {pitch, volume} = this.config.engine;
		const revs = Math.abs(this.legs.angvel().z - this.wheel.angvel().z) / this.engineTopSpin;

		// Eased a little so it doesn't jitter with every bump
		this.engineRevs += (revs - this.engineRevs) * Math.min(1, deltaTime * 8);

		this.engineSound.setPlaybackRate(Math.min(pitch.max, pitch.idle + (pitch.top - pitch.idle) * this.engineRevs));
		this.engineSound.setVolume(volume.idle + (volume.top - volume.idle) * Math.min(1, this.engineRevs));
	}

	// Where laser bolts leave from and which way they go: the "Muzzle" empty on the gun (its X axis is the
	// barrel), or the middle of the head the way it points until the model has one
	muzzle (position, direction) {
		if (this.muzzleObject) {
			this.muzzleObject.getWorldPosition(position);
			direction.set(1, 0, 0).applyQuaternion(this.muzzleObject.getWorldQuaternion(quat));
			direction.z = 0;
			direction.normalize();
		}
		else {
			position.copy(this.head.translation());
			direction.copy(this.headDirection);
		}
	}

	// Which way the head points in the world
	get headDirection () {
		const angle = IO8.angleZ(this.head.rotation());

		return new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
	}

	setThrusters (on) {
		this.flames.visible = on;
		this.thrusterLights.forEach((l, i) => l.intensity = on ? this.thrusterIntensities[i] : 0);
	}

	toggleLight () {
		const on = this.headlight.intensity === 0;

		this.headlight.intensity = on ? this.headlightIntensity : 0;
		this.headlightBulb.material.emissiveIntensity = on ? this.headlightGlow : 0;
	}

	step (deltaTime) {
		if (this.isExploded) {
			return;
		}

		this.updateEngineSound(deltaTime);

		this.stretchParts.forEach(({obj, length}) => obj.scale.y = (length + this.springOffset) / length);
		this.slideParts.forEach(({obj, restY}) => obj.position.y = restY + this.springOffset);

		// Satellite
		if (this.satelliteIsSpinning) {
			this.satellite.rotation.y -= Math.PI * 2 * deltaTime;
			this.satelliteDish.rotation.x = Math.sin(performance.now() / 1000);
		}

		// Antenna eases towards its target, no tween library needed
		const antennaTarget = this.antennaIsUp ? this.antennaUp : this.antennaDown;

		this.antenna.position.y += (antennaTarget - this.antenna.position.y) * Math.min(1, deltaTime * 12);

		// Flicker the flames a little, and sputter (cut in and out) when the tank is nearly empty
		const sputter = this.fuelLevel < this.config.fuel.low && Math.random() < 0.35;

		this.setThrusters(this.isThrusting && !sputter);

		// The sound follows the flames, sputter included
		if (this.thrusterSound) {
			const volume = this.flames.visible ? this.config.thrusterVolume : 0;
			const current = this.thrusterSound.getVolume();

			this.thrusterSound.setVolume(current + (volume - current) * Math.min(1, deltaTime * 20));
		}

		if (this.isThrusting) {
			this.flames.scale.setScalar(0.85 + Math.random() * 0.3);
		}
	}

	// Rotation around Z (the only way anything on io8 rotates), 0 = facing +X
	static angleZ ({z, w}) {
		return 2 * Math.atan2(z, w);
	}

	// Into -PI..PI, so the head always turns the short way
	static wrapAngle (angle) {
		return Math.atan2(Math.sin(angle), Math.cos(angle));
	}

	// Rapier joint anchors are in the body's local space
	static localAnchor (body, worldPoint) {
		const local = new THREE.Vector3().copy(worldPoint).sub(body.translation());

		return local.applyQuaternion(new THREE.Quaternion().copy(body.rotation()).invert());
	}
}
