import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';

import SleekScene from '../sleek/scene.js';
import SleekPhysics from '../sleek/physics.js';
import SleekLoader from '../sleek/loader.js';
import SleekAudio from '../sleek/audio.js';
import SleekEntity from '../sleek/entity.js';

import IO8 from './io8.js';
import Spawner from './spawner.js';
import Ground from './ground.js';
import Explosion from './explosion.js';
import Impacts from './impacts.js';
import Pickups from './pickups.js';
import Hud from './hud.js';
import Lasers from './lasers.js';
import Sunlight from './sunlight.js';
import Sky from './sky.js';
import Blasts from './effects/blasts.js';
import Damage from './damage.js';

// Swap for your own map. Conventions (and what the map needs) are in the README
const MAP = './assets/gltf/windowsxpmap/windowsxpmap.gltf';

const target = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

export default class App extends SleekScene {
	constructor (el) {
		// The map's sky (see Sky) is what lights and reflects everything
		super(el, {
			fov: 45,

			// Draw distance (m), far enough for a sun and moon kilometres away, and the stars
			far: 5000
		});

		this.physics = new SleekPhysics();
		this.hud = new Hud();
		this.spawner = new Spawner(this.scene, this.physics);
		this.cameraTarget = new THREE.Vector3();
		this.cameraLead = 0;
		this.cameraLift = 0;

		// Mouse position in -1..1 screen coordinates, null until it first moves
		this.pointer = null;
		this.fire = false;

		// On window rather than the canvas so the UI cards on top don't block aiming
		window.addEventListener('pointermove', e => {
			const rect = this.el.getBoundingClientRect();

			this.pointer ??= new THREE.Vector2();
			this.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
		});

		// One shot per left click, fired on the next frame
		window.addEventListener('pointerdown', e => {
			if (e.button === 0 && this.isPlaying) {
				this.fire = true;
			}
		});
	}

	async init () {
		this.audio = new SleekAudio(this.camera, this.scene);
		this.impacts = new Impacts(this.physics, this.audio);
		this.spawner.setImpacts(this.impacts);
		this.pickups = new Pickups(this.scene, this.audio);
		this.spawner.setPickups(this.pickups);
		this.blasts = new Blasts(this.scene, this.camera);
		this.lasers = new Lasers(this.scene, this.physics, this.audio, this.impacts, this.blasts);

		const sciFi = name => this.audio.load(`./assets/audio/kenney_sci-fi-sounds/Audio/${name}.ogg`);

		const [robot, map, sky, engineSound, thrusterSound, boom, crunch] = await Promise.all([
			SleekLoader.loadObject('./assets/gltf/io8/io8v6.gltf'),
			SleekLoader.loadObject(MAP),
			Sky.load(MAP),
			this.audio.load('./assets/audio/freesound/407540__sojan__sci-fi-engine-loop.ogg'),
			this.audio.load('./assets/audio/freesound/512815__mostyxs__good-jetpack-sound-loop.wav'),
			Promise.all([0, 1].map(i => sciFi(`lowFrequency_explosion_00${i}`))),
			Promise.all([0, 1, 2, 3, 4].map(i => sciFi(`explosionCrunch_00${i}`))),
			this.impacts.init(),
			this.pickups.init(),
			this.lasers.init(),
			this.spawner.init()
		]);

		this.map = new SleekEntity(map, this.physics, {name: 'Map'});
		this.scene.add(this.map.object3d);
		this.ground = new Ground(this.map);
		this.sunlight = new Sunlight(this.map.object3d, this.scene);

		// The map's sky.json if it has one, otherwise the sky stays black
		if (sky) {
			this.sky = new Sky(this.scene, this.camera, this.renderer, this.map.object3d, sky);
		}

		const start = this.spawnPoint();

		this.spawner.setGround(this.ground, start.x);

		this.player = new IO8(robot, this.physics, {pos: start});
		this.player.initSounds(this.audio, {engine: engineSound, thruster: thrusterSound, impacts: this.impacts, boom, crunch});
		this.scene.add(this.player.object3d);

		this.spawner.update(start.x);

		this.damage = new Damage(this.scene, this.blasts, this.player);

		// FPS counter, top left, only with ?debug in the address (it redraws itself every frame)
		if (new URLSearchParams(location.search).has('debug')) {
			this.stats = new Stats();
			this.el.appendChild(this.stats.dom);
		}

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enabled = false;

		// OrbitControls puts an inline cursor: auto on the canvas, which hides the crosshair from app.css
		this.renderer.domElement.style.cursor = '';

		// O toggles the orbit camera
		window.addEventListener('keydown', e => {
			if (e.code === 'KeyO' && !e.repeat && this.isPlaying) {
				this.controls.enabled = !this.controls.enabled;
				this.controls.target.copy(this.cameraTarget);
			}
		});

		this.updateCamera(1);
		this.sunlight.step(this.player.focusObject.getWorldPosition(target));
		this.warmUp();
	}

	play () {
		super.play();
		this.audio.resume();
		this.player.hasInput = true;
	}

	// Freezes everything (physics, sounds, io8's controls), the last frame stays on screen
	pause () {
		super.pause();
		this.audio.pause();
		this.player.hasInput = false;
		this.player.keys.clear();
	}

	// Compile every shader now, or each one hitches the game (~100 ms) the first time it's seen. three only
	// compiles what's visible and in the scene, so hidden things (thruster flames, the stars by day) are shown
	// for it and things added later (laser bolts, pickups) get a stand-in. Rendered once rather than just
	// compiled, so the shadow versions are made too
	warmUp () {
		const hidden = [];
		const standIns = [new THREE.Mesh(this.lasers.geometry, this.lasers.material), ...this.pickups.models.map(model => this.pickups.create(model))];

		this.scene.traverse(obj => {
			if (!obj.visible) {
				hidden.push(obj);
				obj.visible = true;
			}
		});

		standIns.forEach(obj => {
			obj.position.copy(this.camera.position).add({x: 0, y: 0, z: -3});
			this.scene.add(obj);
		});

		this.composer.render();

		standIns.forEach(obj => obj.removeFromParent());
		hidden.forEach(obj => obj.visible = false);
	}

	// Blow io8 up (when he's out of health), Restart in the menu gets him back
	explode () {
		if (this.player.isExploded) {
			return;
		}

		this.explosion = new Explosion(this.scene, this.physics, this.player.legs.translation());
		this.blasts.spawn(this.explosion.center, 1);
		this.player.explode(this.explosion);
		this.explosion.shockwave();
		this.impacts.register(this.explosion.pieces.map(piece => piece.body.collider(0)), 'robot');
	}

	step (deltaTime) {
		this.physics.step(deltaTime);

		// Out of health: blown up here, between physics steps (explode() can't run during one)
		if (this.player.health <= 0) {
			this.explode();
		}
		this.pickups.step(deltaTime, this.player);
		this.player.step(deltaTime);
		this.explosion?.step(deltaTime);
		this.blasts.step(deltaTime);
		this.damage.step(deltaTime);
		this.lasers.step(deltaTime, this.player, this.fire && !this.controls.enabled);
		this.fire = false;
		this.map.step(deltaTime);
		// Keep stuff to crash into ahead of io8
		this.spawner.update(this.player.focusObject.getWorldPosition(target).x);
		this.stats?.update();
		// Rounded up so he never shows 0% while he's still alive
		this.hud.set('health', this.player.healthLevel, Math.ceil(this.player.healthLevel * 100));
		this.hud.set('fuel', this.player.fuelLevel, Math.round(this.player.fuelLevel * 100));
		this.hud.set('ammo', this.lasers.ammoLevel, Math.floor(this.lasers.ammoLevel * 100));
		this.hud.set('speed', this.player.effectLevel('speed'), Math.ceil(this.player.effectRemaining('speed')));
		this.hud.set('weight', this.player.effectLevel('weight'), Math.ceil(this.player.effectRemaining('weight')));

		if (this.controls.enabled) {
			this.controls.update();
		}
		else {
			this.updateCamera(deltaTime);
			this.updateAim();
		}

		this.sky?.step(deltaTime);
		this.sunlight.step(this.player.focusObject.getWorldPosition(target));

		super.step(deltaTime);
	}

	// An empty called "Spawn" in the map wins, otherwise drop io8 on the ground at x = 0.
	// io8's origin is the middle of its wheel (radius 0.25), so start a little above that
	spawnPoint () {
		const spawn = this.map.object3d.getObjectByName('Spawn');

		if (spawn) {
			const pos = spawn.getWorldPosition(new THREE.Vector3());

			return {x: pos.x, y: pos.y, z: 0};
		}

		return {x: 0, y: (this.ground.heightAt(0) ?? 0) + 0.5, z: 0};
	}

	// Where the mouse points on io8's plane (z = 0) is what the head looks at.
	// Redone every frame, not just on mouse move, since the camera moves with io8
	updateAim () {
		if (!this.pointer) {
			return;
		}

		raycaster.setFromCamera(this.pointer, this.camera);
		this.player.aim = raycaster.ray.intersectPlane(aimPlane, this.player.aim ?? new THREE.Vector3());
	}

	// Follow the legs as drawn, not the raw physics body, or the camera and io8 judder against each other
	updateCamera (deltaTime) {
		const follow = 4;

		// Easing after io8 at rate `follow` leaves the camera speed / follow behind, which pushes io8 towards
		// the middle of the screen when it's fast. Aiming that far ahead cancels it out, so io8 stays put on
		// screen at any speed. The speed is smoothed so io8's wobble doesn't shake the camera
		this.cameraLead += (this.player.focusBody.linvel().x / follow - this.cameraLead) * Math.min(1, deltaTime * 2);

		this.player.focusObject.getWorldPosition(target);
		target.x += this.cameraLead;
		this.cameraTarget.lerp(target, Math.min(1, deltaTime * follow));

		// How far (m) the camera sits to the right of io8, and how far back
		const shift = 0.3;
		const distance = 7.5;

		// Where io8 goes on screen, -1 is the left edge and 1 the right, the rest is room to see ahead. The camera
		// turns right until he's there, which depends on how wide the screen is (a narrow portrait screen needs
		// much less turn, or he'd end up off it). Measured at his depth, so a little out for things in front/behind
		const screenX = -0.5;
		const halfWidth = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
		const ahead = distance * Math.tan(Math.atan(-screenX * halfWidth) - Math.atan(shift / distance));

		// Height follows io8 too, for hills. 0.32 keeps the framing the flat road had
		const x = this.cameraTarget.x + shift;
		const y = this.cameraTarget.y + 0.32;
		const lift = this.cameraLiftFor(x, y, this.cameraTarget.y + 0.5, distance);

		// Straight up when the ground needs it (so it never dips in), eased back down so it doesn't bob over every bump
		this.cameraLift = lift > this.cameraLift ? lift : this.cameraLift + (lift - this.cameraLift) * Math.min(1, deltaTime * 2);

		this.camera.position.set(x, y + this.cameraLift, distance);
		this.camera.lookAt(x + ahead, this.cameraTarget.y + 0.5, this.cameraTarget.z);

		this.blasts.shake(this.camera);
	}

	// How much higher than `y` the camera (at depth z) has to be for it, and its view of io8 (lookY at the road,
	// z = 0), to stay `clearance` above the terrain in front of the road. Checked at a few points along the way
	cameraLiftFor (x, y, lookY, z, clearance = 0.3) {
		let lift = 0;

		[1, 0.8, 0.6, 0.4].forEach(t => {
			const ground = this.ground.heightAt(x, z * t);

			// The line of sight at t of the way from the road to the camera is at lookY + (cameraY - lookY) * t
			if (ground !== null) {
				lift = Math.max(lift, (ground + clearance - lookY) / t + lookY - y);
			}
		});

		return lift;
	}
}
