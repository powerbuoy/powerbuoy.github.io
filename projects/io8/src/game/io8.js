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
	brake: ['KeyS'],
	jump: ['Space'],
	antenna: ['KeyF'],
	light: ['KeyC'],
	satellite: ['KeyV']
};

// Actions that happen once per press rather than while held
const TOGGLES = {
	antenna: io8 => io8.antennaIsUp = !io8.antennaIsUp,
	light: io8 => io8.toggleLight(),
	satellite: io8 => io8.satelliteIsSpinning = !io8.satelliteIsSpinning
};

// Power-ups. A timed one (it has a duration) changes something on io8 and returns how to put it back when it
// runs out, an instant one (no duration) just does its thing
const EFFECTS = {
	// Instant. amount = how much of full health it gives back (0-1), never past full
	health (io8, amount) {
		const {capacity} = io8.config.health;

		io8.health = Math.min(capacity, io8.health + capacity * amount);
	},

	// amount = how many times faster
	speed (io8, amount) {
		const original = io8.config.maxSpeed;

		io8.config.maxSpeed *= amount;

		return () => io8.config.maxSpeed = original;
	},

	// amount = how many times heavier (the Weight pickup's amount). The motors and balance spring are acceleration based, so he drives the
	// same, but he slams through things instead of bouncing off them, and blasts barely move him. Thrust is worked
	// out from his normal weight, so it can't lift him any more, and the head spring is a plain spring, so the head sinks down onto its end stops
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

// How stiffly axle friction holds the wheel still in the legs (acceleration based), its torque limit is what
// lets it slip, see physicsStep()
const AXLE_HOLD = 10000;

// Scratch objects reused every physics step instead of allocating new ones
const up = new THREE.Vector3();
const velocity = new THREE.Vector3();
const quat = new THREE.Quaternion();
const legsUp = new THREE.Vector3();
const anchor = new THREE.Vector3();
const headPosition = new THREE.Vector3();
const headOffset = new THREE.Vector3();
const anchorVelocity = new THREE.Vector3();
const headVelocity = new THREE.Vector3();
const jumpImpulse = new THREE.Vector3();

export default class IO8 extends SleekEntity {
	keys = new Set();

	// Off while the game is paused, see App.pause()
	hasInput = false;

	antennaIsUp = false;
	satelliteIsSpinning = true;
	isThrusting = false;

	// Seconds the jump key has been held, 0 when it isn't (see updateJump())
	jumpHeld = 0;

	// World point (on io8's plane) the head looks at, null = straight ahead. Set by the app from the mouse
	aim = null;

	isExploded = false;

	// His head's piece of debris ({object3d, body}) once he's blown up, the camera watches it for a moment
	headPiece = null;

	fuel = 0;

	// Active power-ups: name -> {remaining seconds, how to undo it}
	effects = new Map();

	// How many times heavier than normal (the weight power-up)
	massScale = 1;

	// How fast the wheel spins compared to normal top speed, and how much the gas is on (0-1), both eased
	// (they drive the engine sound)
	engineRevs = 0;
	engineGas = 0;
	sinceThrust = 0;
	sinceDamage = 0;

	// His velocity (centre of mass) over the last few physics steps, kept in a ring (`newest` is where the latest
	// went, `stored` how many there are so far), and the biggest speed change of the crash going on right now
	// (0 when there isn't one), see updateHealth()
	velocities = [];
	newest = -1;
	stored = 0;
	crash = 0;

	constructor (object3d, physics, conf = {}) {
		super(object3d, physics, Object.assign({
			name: 'Robot',
			maxSpeed: 7.5,

			// The wheel motor drives him up to maxSpeed, see physicsStep(). Acceleration based, so roughly "how many g's",
			// whatever he weighs
			driveFactor: 100,

			// Friction at the axle, between the legs and the wheel, as a share of his weight (like a rolling resistance
			// coefficient): `roll` off the gas (the tyre flexing and the bearing), `brake` the brake pads. Below it the
			// wheel holds still in the legs, above it, it slips. 0.015 is about a bike tyre on tarmac
			roll: 0.015,
			brake: 0.8,

			// Thrust as an acceleration (m/s², gravity is 9.81) of io8's normal weight, so changing his masses in
			// Blender doesn't need retuning. The weight power-up doesn't count, so it can't lift him any more
			thrust: 15.7,

			// Thruster fuel: seconds of thrust in a full tank. Starts refilling `refillDelay` seconds after you let
			// go of the thrusters (anywhere, in the air too), empty to full in `refillTime` seconds.
			// Below `low` (0-1) the flames sputter
			fuel: {capacity: 2, refillDelay: 1, refillTime: 1.5, low: 0.25},

			// Hold to charge, let go to jump: a tap jumps height[0] m, `charge` seconds or more height[1] m. Charging
			// squashes the leg springs down to `squash` of their travel. Like thrust, the push is worked out from his
			// normal weight, so the weight power-up keeps him (almost) on the ground
			jump: {height: [0.1, 1], charge: 0.6, squash: 0.8},

			// Hitting things hard hurts: how much his speed changes within `window` seconds (a fall stopping, a wall,
			// a blast) past `safe` m/s does damage * excess² (like crash energy). A 1.5 m drop lands at ~5 m/s,
			// 5 m at ~10, 10 m at ~14. Health comes back `refillDelay` seconds after the last hit, empty to full in
			// `refillTime` seconds (null for no healing, health pickups only). With his head under water it all
			// drains in `drown` seconds. At 0 he blows up
			health: {capacity: 100, safe: 6, damage: 1, window: 0.025, refillDelay: 3, refillTime: null, drown: 0.3},

			balance: {stiffness: 1500, damping: 70, lean: 0.12},
			neck: {stiffness: 200, damping: 12},

			// Engine sound pitch (playback rate) and volume, from how fast the wheel spins: `idle` when still,
			// `top` at normal top speed. Past that (a speed boost) the pitch keeps climbing at the same rate, up to
			// `max` (4x speed reaches 2.5), the volume doesn't. Only on the gas: rolling or braking, it fades out
			engine: {pitch: {idle: 0.5, top: 1, max: 2.5}, volume: {idle: 0.15, top: 0.5}},

			// Thruster sound volume while firing (it fades in and out with the flames)
			thrusterVolume: 0.8,

			// Blowing up (two sounds layered: a deep boom and a crunch, pitched down a little)
			explosionVolume: {boom: 1, crunch: 0.7},

			// The head bobs on the leg springs (parts tagged "suspension" in Blender). Acceleration based like the neck,
			// travel is how far (m) it can squash down and stretch up before hitting the end stops
			suspension: {stiffness: 120, damping: 5, travel: [-0.12, 0.08]}
		}, conf));

		this.findParts();
		this.initPhysics();
		this.handleInput();

		this.fuel = this.config.fuel.capacity;
		this.health = this.config.health.capacity;

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

		// Only the flame meshes are hidden when off, not the lights in the same group: a hidden light changes how
		// many lights there are, which makes three recompile every shader. Off they're just intensity 0
		this.flameMeshes = [];
		this.flames.traverse(obj => obj.isMesh && this.flameMeshes.push(obj));
		this.thrusterIntensities = this.thrusterLights.map(l => l.intensity);
		this.setThrusters(false);
	}

	initPhysics () {
		const {RobotWheel: wheel, RobotLegs: legs, RobotHead: head} = this.bodies;

		this.wheel = wheel;
		this.legs = legs;
		this.head = head;
		this.legsObject = this.object3d.getObjectByName('RobotLegs_RigidBody');

		// Speed along the road is the wheel's spin times its radius, measured from what it rolls on (its collision
		// shape, or the mesh without one). Half its height, as he's upright when he's built
		const tyre = this.object3d.getObjectByName('RobotWheel_Shape') ?? this.object3d.getObjectByName('RobotWheel_Mesh');
		const size = new THREE.Box3().setFromObject(tyre).getSize(new THREE.Vector3());

		this.wheelRadius = size.y / 2;

		this.colliders.forEach(collider => collider.setCollisionGroups(ROBOT_GROUPS));

		// What he stands on, see isGrounded
		this.wheelColliders = this.colliders.filter(collider => collider.parent().handle === wheel.handle);

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

		// His whole normal weight, the thrust is worked out from it
		this.mass = wheel.mass() + legs.mass() + head.mass();

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
			if (!this.hasInput) {
				return;
			}

			this.keys.add(e.code);

			if (e.repeat) {
				return;
			}

			Object.keys(TOGGLES).forEach(action => CONTROLS[action].includes(e.code) && TOGGLES[action](this));
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

	// Where the camera, spawner and sunlight centre on: his legs, or where he blew up
	getFocusPosition (target) {
		return this.isExploded ? target.copy(this.wreck) : this.legsObject.getWorldPosition(target);
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

		this.wreck = this.legsObject.getWorldPosition(new THREE.Vector3());
		this.headPiece = explosion.shatter(this.object3d, velocityOf).find(piece => piece.object3d.name === 'RobotHead_RigidBody') ?? null;
		this.isExploded = true;
		this.engineSound?.stop();
		this.thrusterSound?.stop();
		this.playExplosion(explosion.center);

		// Removing a body removes its joints too
		this.destroy();
		this.physics.world.removeRigidBody(this.gyro);
		this.physics.world.removeRigidBody(this.planeAnchor);
	}

	physicsStep (timestep) {
		const drive = this.drive;

		// The wheel motor drives him up to top speed, like an e-bike: faster than that (downhill), it lets the wheel
		// roll instead of holding him back, so going downhill on the gas is never slower than rolling down. It only
		// switches over where it was hardly pushing anyway, so it's smooth. Positive motor speed rolls towards +X.
		// Off the gas it's friction at the axle: a stiff motor holding the wheel still in the legs, but only up to
		// a torque (rolling resistance or the brake times his weight), past that it slips like real friction
		const {maxSpeed, driveFactor, roll, brake} = this.config;
		const topSpin = maxSpeed / this.wheelRadius;
		const spin = -(this.wheel.angvel().z - this.legs.angvel().z);

		if (drive && !this.isBraking && spin * drive < topSpin) {
			this.wheelJoint.configureMotorVelocity(drive * topSpin, driveFactor);
			this.wheelJoint.setMotorMaxForce(Infinity);
		}
		else {
			const friction = this.isBraking ? brake : roll;

			this.wheelJoint.configureMotorVelocity(0, AXLE_HOLD);
			this.wheelJoint.setMotorMaxForce(friction * this.mass * this.massScale * 9.81 * this.wheelRadius);
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
			up.set(0, 1, 0).applyQuaternion(quat.copy(this.legs.rotation())).multiplyScalar(this.config.thrust * this.mass * timestep);
			this.legs.applyImpulse(up, true);
		}

		this.updateJump(timestep);
		this.updateFuel(timestep);
		this.updateHealth(timestep);
		this.updateEffects(timestep);
	}

	// Start a power-up (see EFFECTS). Getting the same one again while it's running adds its time instead of
	// its strength, so two speed boosts last twice as long rather than making io8 way too fast for the physics.
	// The meter goes back to full and drains over the new total
	addEffect (name, {amount, duration}) {
		const active = this.effects.get(name);

		if (!duration) {
			EFFECTS[name](this, amount);

			return;
		}

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

	// Charges while the key is held, jumps when it's let go, if the wheel is on something. The push is along the
	// legs (like thrust), as an instant speed change that would lift his normal weight to the charged height,
	// shared by the parts by what they weigh right now so they all leave together
	updateJump (timestep) {
		if (this.isDown('jump')) {
			this.jumpHeld += timestep;

			return;
		}

		if (!this.jumpHeld) {
			return;
		}

		const [low, high] = this.config.jump.height;
		const height = low + (high - low) * this.jumpCharge;

		this.jumpHeld = 0;

		if (!this.isGrounded) {
			return;
		}

		const bodies = [this.wheel, this.legs, this.head];
		const weight = bodies.reduce((sum, body) => sum + body.mass(), 0);
		const speed = Math.sqrt(2 * 9.81 * height);

		up.set(0, 1, 0).applyQuaternion(quat.copy(this.legs.rotation())).multiplyScalar(speed * this.mass / weight);
		bodies.forEach(body => body.applyImpulse(jumpImpulse.copy(up).multiplyScalar(body.mass()), true));
	}

	// 0-1, how charged the jump is
	get jumpCharge () {
		return Math.min(1, this.jumpHeld / this.config.jump.charge);
	}

	// The tyre is touching something (or within a hair of it: Rapier keeps contact points a little ahead of time).
	// NOTE: numSolverContacts() can't be used, it always reads 0 between steps
	get isGrounded () {
		const world = this.physics.world;
		let touching = false;

		this.wheelColliders.forEach(collider => world.contactPairsWith(collider, other => {
			world.contactPair(collider, other, manifold => touching ||= manifold.numContacts() > 0);
		}));

		return touching;
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

	// Damage from sudden speed changes of the whole of io8 (centre of mass, so the head bobbing on its springs
	// doesn't count). Driving, thrust and gravity change it far too slowly to matter, a cardboard box gives
	// way so it barely does either. One crash takes a few steps to play out, so it's charged by its peak:
	// as the speed change grows, only the extra damage is taken
	updateHealth (timestep) {
		const {capacity, safe, damage, window, refillDelay, refillTime} = this.config.health;
		const steps = Math.max(1, Math.round(window / timestep));

		velocity.set(0, 0, 0);
		velocity.addScaledVector(this.wheel.linvel(), this.wheel.mass());
		velocity.addScaledVector(this.legs.linvel(), this.legs.mass());
		velocity.addScaledVector(this.head.linvel(), this.head.mass());
		velocity.divideScalar(this.wheel.mass() + this.legs.mass() + this.head.mass());

		// The one `steps` ago is the next slot round the ring, about to be overwritten
		while (this.velocities.length <= steps) {
			this.velocities.push(new THREE.Vector3());
		}

		const size = this.velocities.length;

		this.newest = (this.newest + 1) % size;
		this.velocities[this.newest].copy(velocity);
		this.stored = Math.min(size, this.stored + 1);

		if (this.stored < size) {
			return;
		}

		const change = velocity.distanceTo(this.velocities[(this.newest + 1) % size]);
		const hurt = speed => damage * Math.max(0, speed - safe) ** 2;

		if (change > safe) {
			if (change > this.crash) {
				this.health = Math.max(0, this.health - (hurt(change) - hurt(this.crash)));
				this.crash = change;
				this.sinceDamage = 0;
			}
		}
		else {
			this.crash = 0;
		}

		this.sinceDamage += timestep;

		if (refillTime && this.sinceDamage > refillDelay && this.health > 0) {
			this.health = Math.min(capacity, this.health + capacity / refillTime * timestep);
		}
	}

	// Call every frame his head is under water (see Water), he shorts out within `drown` seconds
	drown (deltaTime) {
		const {capacity, drown} = this.config.health;

		this.health = Math.max(0, this.health - capacity / drown * deltaTime);
		this.sinceDamage = 0;
	}

	// 0-1, for the health meter
	get healthLevel () {
		return this.health / this.config.health.capacity;
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

		// The head's weight pulls it round the neck (the head's origin) unless it's balanced on it. A spring only
		// pushes back once it's off target, so it would settle a few degrees low, and shots with it. So the neck
		// holds the weight up like a servo would, and the spring only has to do the aiming
		const hold = (this.head.worldCom().x - pos.x) * this.head.mass() * 9.81;
		const impulse = (this.neckInertia * this.massScale * (stiffness * error - damping * relativeSpin) + hold) * timestep;

		this.head.applyTorqueImpulse({x: 0, y: 0, z: impulse}, true);
		this.legs.applyTorqueImpulse({x: 0, y: 0, z: -impulse}, true);
	}

	// The head riding on the leg springs. A spring along the legs between them, with gravity taken off so it
	// rests at the natural height and only squashes when something pushes (landing, bumps, hitting things),
	// or when charging a jump pulls it down
	suspension (timestep) {
		const {stiffness, damping, travel} = this.config.suspension;
		const rest = travel[0] * this.config.jump.squash * this.jumpCharge;

		legsUp.set(0, 1, 0).applyQuaternion(quat.copy(this.legs.rotation()));
		anchor.copy(this.neckAnchor).applyQuaternion(quat).add(this.legs.translation());
		headPosition.copy(this.head.translation());

		// How far the head has moved up (+) or down (-) the legs, and how fast
		const offset = headOffset.copy(headPosition).sub(anchor).dot(legsUp);
		const legsCom = this.legs.worldCom();
		const spin = this.legs.angvel().z;

		anchorVelocity.copy(this.legs.linvel());
		anchorVelocity.x -= spin * (anchor.y - legsCom.y);
		anchorVelocity.y += spin * (anchor.x - legsCom.x);

		const speed = headVelocity.copy(this.head.linvel()).sub(anchorVelocity).dot(legsUp);

		// Much stiffer past the end of the travel, like hitting the end stop
		const beyond = offset < travel[0] ? offset - travel[0] : offset > travel[1] ? offset - travel[1] : 0;
		const spring = -stiffness * (offset - rest) + 9.81 * legsUp.y;
		const endStop = -stiffness * 60 * beyond;

		// The spring is a real spring: its strength is set for the head's normal weight, not whatever it weighs
		// right now, so a heavier head (the weight power-up) sinks down onto the end stops. The end stops and
		// damping follow the actual weight, so however heavy it gets it stops there (instead of pushing through)
		// and settles instead of wobbling
		const force = this.headMass * spring + this.head.mass() * (endStop - damping * speed);
		const impulse = legsUp.multiplyScalar(force * timestep);

		this.head.applyImpulseAtPoint(impulse, headPosition, true);
		this.legs.applyImpulseAtPoint(impulse.negate(), anchor, true);

		this.springOffset = offset;
	}

	// A random one of each kind's variations, layered
	playExplosion (position) {
		if (!this.explosionSounds) {
			return;
		}

		const pick = buffers => buffers[Math.floor(Math.random() * buffers.length)];
		const {boom, crunch} = this.config.explosionVolume;

		this.audio.playAt(pick(this.explosionSounds.boom), position, {volume: boom});
		this.audio.playAt(pick(this.explosionSounds.crunch), position, {volume: crunch, rate: 0.8});
	}

	// Give io8 his sounds (buffers loaded by the app), they play from where he is
	initSounds (audio, {engine, thruster, impacts, boom, crunch}) {
		this.audio = audio;
		this.explosionSounds = {boom, crunch};

		// Bumps and crashes: the tyre thuds, everything else clanks. Judged by io8's whole weight (not just the
		// part that got hit), so bumping a light box sounds like the box, not like io8
		const weight = () => this.wheel.mass() + this.legs.mass() + this.head.mass();

		impacts.register(this.wheelColliders, 'tyre', weight);
		impacts.register(this.colliders.filter(collider => collider.parent().handle !== this.wheel.handle), 'robot', weight);

		// Always playing, just silent until the flames are on, so starting and stopping is a quick fade, not a click
		this.thrusterSound = audio.positional(thruster, {loop: true, volume: 0});
		this.legsObject.add(this.thrusterSound);
		this.thrusterSound.play();

		// Same here, silent until you hit the gas
		this.engineSound = audio.positional(engine, {loop: true, volume: 0});

		// Wheel spin at normal top speed, remembered now so a speed boost revs higher instead of rescaling
		this.engineTopSpin = this.config.maxSpeed / this.wheelRadius;
		this.legsObject.add(this.engineSound);
		this.engineSound.play();
	}

	// The engine revs with the wheel: pitch and volume follow how fast it spins (relative to the legs), but you
	// only hear it on the gas. Held gas counts even past top speed where the motor freewheels (downhill), so it
	// doesn't cut out there
	updateEngineSound (deltaTime) {
		if (!this.engineSound) {
			return;
		}

		const {pitch, volume} = this.config.engine;
		const revs = Math.abs(this.legs.angvel().z - this.wheel.angvel().z) / this.engineTopSpin;
		const gas = this.drive && !this.isBraking ? 1 : 0;

		// Eased a little so it doesn't jitter with every bump, and fades in and out instead of clicking
		this.engineRevs += (revs - this.engineRevs) * Math.min(1, deltaTime * 8);
		this.engineGas += (gas - this.engineGas) * Math.min(1, deltaTime * 10);

		this.engineSound.setPlaybackRate(Math.min(pitch.max, pitch.idle + (pitch.top - pitch.idle) * this.engineRevs));
		this.engineSound.setVolume(this.engineGas * (volume.idle + (volume.top - volume.idle) * Math.min(1, this.engineRevs)));
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
		this.flamesOn = on;
		this.flameMeshes.forEach(mesh => mesh.visible = on);
		this.thrusterLights.forEach((l, i) => l.intensity = on ? this.thrusterIntensities[i] : 0);
	}

	toggleLight () {
		const on = this.headlight.intensity === 0;

		this.headlight.intensity = on ? this.headlightIntensity : 0;
		this.headlightBulb.material.emissiveIntensity = on ? this.headlightGlow : 0;

		// No point drawing its shadow map while it's off (see Sunlight.step())
		this.headlight.shadow.autoUpdate = on;
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
			const volume = this.flamesOn ? this.config.thrusterVolume : 0;
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
