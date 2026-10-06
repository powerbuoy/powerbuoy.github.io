import * as THREE from 'three';

import SleekLoader from '../sleek/loader.js';

// Pickup models, in assets/gltf/pickups/<Name>/<Name>.gltf. What each one does comes from the custom properties
// on its root object in Blender: effect (see EFFECTS in io8.js), amount, duration (leave it out for an instant
// one, like health), and optionally pitch (of the pickup sound, 1 = as recorded, the default)
const MODELS = ['Speed', 'Weight', 'Health'];

const position = new THREE.Vector3();

// A bubble that glows at its edges and is clear in the middle (a fresnel effect): the more the surface faces
// away from the camera, the brighter. Additive, so it only ever adds light. Can't come from Blender, glTF
// only has standard materials
const bubbleShader = {
	vertexShader: `
		varying vec3 vNormal;
		varying vec3 vView;

		void main () {
			vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);

			vNormal = normalize(normalMatrix * normal);
			vView = normalize(-viewPosition.xyz);
			gl_Position = projectionMatrix * viewPosition;
		}
	`,
	fragmentShader: `
		uniform vec3 color;
		uniform float strength;
		uniform float power;
		uniform float fill;

		varying vec3 vNormal;
		varying vec3 vView;

		void main () {
			float edge = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), power);

			gl_FragColor = vec4(color * strength, edge + fill);
		}
	`
};

/*
	Floating power-ups in a glowing bubble. They spin and bob, and when io8 touches one it starts that effect on him, plays a sound
	and the pickup pops away. No physics, it's just a distance check against io8's parts
*/
export default class Pickups {
	models = [];
	pickups = new Set();

	constructor (scene, audio, conf = {}) {
		this.scene = scene;
		this.audio = audio;
		this.config = Object.assign({
			// Played where it was picked up, at the pitch the pickup's model asks for
			sound: {src: './assets/audio/kenney_sci-fi-sounds/Audio/forceField_000.ogg', volume: 0.8},

			// How close (m) any part of io8 has to get to pick one up
			reach: 0.45,

			// The glowing bubble around each pickup, the size of `reach` so it shows how close you need to get.
			// strength = how bright the edge glows, power = how thin the glowing edge is, fill = glow in the middle
			bubble: {strength: 2, power: 2.5, fill: 0.04},

			// Spin (radians per second), and how far (m) and fast (bobs per second) it bobs up and down
			spin: 1,
			bob: {height: 0.08, speed: 0.6},

			// Seconds to shrink away when picked up
			pop: 0.15,

			// Removed once this far behind or ahead of io8, like the props
			despawn: {behind: 8, ahead: 35}
		}, conf);
	}

	async init () {
		this.sound = await this.audio.load(this.config.sound.src);
		this.models = await Promise.all(MODELS.map(async name => {
			const object3d = await SleekLoader.loadObject(`./assets/gltf/pickups/${name}/${name}.gltf`);
			const {effect, amount, duration, pitch = 1} = object3d.children[0].userData;

			return {name, object3d, effect, amount: Number(amount), duration: Number(duration), pitch: Number(pitch), bubble: this.createBubbleMaterial(object3d)};
		}));

		this.bubbleGeometry = new THREE.SphereGeometry(this.config.reach, 32, 16);
	}

	// Tinted with the pickup's own glow colour (its first emissive material), white if it has none
	createBubbleMaterial (object3d) {
		const {strength, power, fill} = this.config.bubble;
		let color = null;

		object3d.traverse(obj => {
			if (!color && obj.isMesh && obj.material.emissive?.getHex()) {
				color = obj.material.emissive.clone();
			}
		});

		return new THREE.ShaderMaterial({
			...bubbleShader,
			uniforms: {color: {value: color ?? new THREE.Color(0xffffff)}, strength: {value: strength}, power: {value: power}, fill: {value: fill}},
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});
	}

	// A random pickup at x, `height` above y
	spawn (x, y) {
		const model = this.models[Math.floor(Math.random() * this.models.length)];
		const object3d = model.object3d.clone();

		object3d.position.set(x, y, 0);
		object3d.add(new THREE.Mesh(this.bubbleGeometry, model.bubble));
		this.scene.add(object3d);
		this.pickups.add({model, object3d, baseY: y, phase: Math.random() * Math.PI * 2, popping: 0});
	}

	// Call every frame with io8 (for the pickup check and despawning)
	step (deltaTime, player) {
		const {reach, spin, bob, pop, despawn} = this.config;
		const time = performance.now() / 1000;
		const focusX = player.focusObject.getWorldPosition(position).x;
		const parts = player.isExploded ? [] : [player.wheel, player.legs, player.head].map(body => new THREE.Vector3().copy(body.translation()));

		this.pickups.forEach(pickup => {
			const {object3d, model} = pickup;

			// Shrinking away after being picked up
			if (pickup.popping) {
				pickup.popping -= deltaTime;
				object3d.scale.setScalar(Math.max(0, pickup.popping / pop));

				if (pickup.popping <= 0) {
					this.remove(pickup);
				}

				return;
			}

			object3d.rotation.y += spin * deltaTime;
			object3d.position.y = pickup.baseY + Math.sin(time * bob.speed * Math.PI * 2 + pickup.phase) * bob.height;

			if (parts.some(part => part.distanceTo(object3d.position) < reach)) {
				player.addEffect(model.effect, {amount: model.amount, duration: model.duration});
				pickup.popping = pop;

				this.audio.playAt(this.sound, object3d.position, {volume: this.config.sound.volume, rate: model.pitch});

				return;
			}

			const dx = object3d.position.x - focusX;

			if (dx < -despawn.behind || dx > despawn.ahead) {
				this.remove(pickup);
			}
		});
	}

	remove (pickup) {
		pickup.object3d.removeFromParent();
		this.pickups.delete(pickup);
	}
}
