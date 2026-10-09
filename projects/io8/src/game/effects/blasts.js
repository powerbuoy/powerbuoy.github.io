import * as THREE from 'three';

import Fireball from './fireball.js';
import Sparks from './sparks.js';

const offset = new THREE.Vector3();

/*
	What an explosion looks like: a fireball and sparks, a flash of light and a kick of
	the camera. Only looks, the physics (debris, shockwave) is Explosion's job. spawn(position, size) anywhere,
	size 1 is io8 blowing up, smaller for a laser hit. Every layer is one pool drawn in one go, so any number
	of blasts costs the same few draw calls
*/
export default class Blasts {
	trauma = 0;
	time = 0;

	constructor (scene, camera, conf = {}) {
		this.scene = scene;
		this.camera = camera;
		this.config = Object.assign({
			// The flash of light, brightest at size 1, lighting things within `distance` (m) for `duration` (s)
			light: {color: 0xffaa55, intensity: 15, distance: 12, duration: 0.35},

			// Camera kick: how much a size 1 blast right next to the camera adds (0-1), how far away (m) it's
			// still felt, how fast it settles (per second), and at full strength how far it moves the camera (m)
			// and turns it (degrees)
			shake: {amount: 1, reach: 30, decay: 1.1, move: 0.25, turn: 4}
		}, conf);

		// Sparks are also used on their own (see Emitters)
		this.fireball = new Fireball(scene);
		this.sparks = new Sparks(scene);
		this.layers = [this.fireball, this.sparks];

		// One light, always there and normally off: adding and removing lights makes three.js recompile shaders
		this.light = new THREE.PointLight(this.config.light.color, 0, this.config.light.distance);
		this.lightLevel = 0;
		scene.add(this.light);
	}

	spawn (position, size = 1) {
		const {light, shake} = this.config;

		this.layers.forEach(layer => layer.spawn(position, size));

		// The light jumps to the newest blast if it's at least as big as what's still glowing
		if (size >= this.lightLevel) {
			this.light.position.copy(position);
			this.light.distance = light.distance * size;
			this.lightLevel = size;
		}

		// Felt less the further it is from the camera
		const falloff = Math.max(0, 1 - offset.copy(position).sub(this.camera.position).length() / shake.reach);

		this.trauma = Math.min(1, this.trauma + shake.amount * size * falloff);
	}

	step (deltaTime) {
		const {light, shake} = this.config;

		this.time += deltaTime;
		this.layers.forEach(layer => layer.step(deltaTime));

		this.lightLevel = Math.max(0, this.lightLevel - deltaTime / light.duration);
		this.light.intensity = light.intensity * this.lightLevel ** 2;
		this.trauma = Math.max(0, this.trauma - shake.decay * deltaTime);
	}

	// Rattle the camera (call after aiming it). Both moves and turns it: turning is what reads as a shake,
	// moving alone is barely noticeable from a few metres away. The strength is squared, so small bumps are
	// gentle and big ones violent, and each axis is a few out-of-step waves so it rattles instead of swinging
	shake (camera) {
		const {move, turn} = this.config.shake;
		const strength = Math.max(this.trauma, 0) ** 2;

		if (!strength) {
			return;
		}

		const t = this.time * 35;
		const wave = (a, b, phase) => (Math.sin(t * a + phase) + Math.sin(t * b + phase * 2)) / 2;
		const angle = THREE.MathUtils.degToRad(turn) * strength;

		camera.position.add(offset.set(wave(1.1, 2.7, 0), wave(1.3, 3.1, 1), 0).multiplyScalar(move * strength));
		camera.rotateX(wave(0.9, 2.3, 2) * angle);
		camera.rotateY(wave(1.2, 2.9, 3) * angle);
		camera.rotateZ(wave(0.7, 1.9, 4) * angle * 0.5);
	}
}
