import * as THREE from 'three';

import SleekLoader from '../sleek/loader.js';
import {pickWeighted} from '../sleek/utils.js';

// Pickup models, in assets/gltf/pickups/<Name>/<Name>.gltf. What each one does comes from the custom properties
// on its root object in Blender: effect (see EFFECTS in io8.js), amount, duration (leave it out for an instant
// one, like health), and optionally pitch (of the pickup sound, 1 = as recorded, the default) and frequency (how
// often it shows up compared to the others: 2 is twice as often as a 1, the default, 0.5 half as often) and
// color (of its bubble, white by default)
const MODELS = ['Speed', 'Weight', 'Health'];

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
	Floating power-ups in a glowing bubble, placed at random along the road ahead of io8 (see fill()). They spin
	and bob, and when io8 touches one it starts that effect on him, plays a sound and the pickup pops away. No
	physics, it's just a distance check against io8 (see SleekEntity.distanceTo())
*/
export default class Pickups {
	models = [];
	pickups = new Set();

	// The slots (see fill()) that have been decided on, a pickup or not
	decided = new Set();

	// Seconds of game time (it stops while paused), for the bobbing
	time = 0;

	constructor (scene, audio, conf = {}) {
		this.scene = scene;
		this.audio = audio;
		this.config = Object.assign({
			// Played where it was picked up, at the pitch the pickup's model asks for
			sound: {src: './assets/audio/kenney_sci-fi-sounds/Audio/forceField_000.ogg', volume: 0.8},

			// How close (m) any bit of io8 has to get to pick one up
			reach: 0.65,

			// The glowing bubble around each pickup, the size of `reach`: touching it picks it up.
			// strength = how bright the edge glows, power = how thin the glowing edge is, fill = glow in the middle
			bubble: {strength: 2, power: 2.5, fill: 0.04},

			// Spin (radians per second), and how far (m) and fast (bobs per second) it bobs up and down
			spin: 1,
			bob: {height: 0.08, speed: 0.6},

			// Seconds to shrink away when picked up
			pop: 0.15,

			// A slot every `spacing` m along the map (from `offset`, in map x), each one used by `chance` and nudged
			// up to `jitter` m forward so they don't line up, `height` m above the ground. io8 is about 1.15 m tall
			// with his antenna up, so they're all out of reach without flying. Which pickup it is depends on their
			// `frequency`. Off for now (was 0.8)
			slots: {spacing: 25, offset: 9, jitter: 5, chance: 0, height: [1.5, 2.5]},

			// How far behind and ahead of io8 (m) the slots are filled in (ahead past what the camera can see, view 3
			// looks a long way down the road, or they visibly pop in), and how far until they're removed again, a
			// little further, so what was just placed doesn't go straight away
			range: {behind: 6, ahead: 80},
			despawn: {behind: 8, ahead: 90},

			// None closer (m) than `edge` to either end of the map, or than `safeZone` to where io8 starts
			edge: 2,
			safeZone: 3
		}, conf);
	}

	// Call once the map exists, they're placed above it from then on
	setGround (ground, startX = 0) {
		this.ground = ground;
		this.startX = startX;
	}

	async init () {
		this.sound = await this.audio.load(this.config.sound.src);
		this.models = await Promise.all(MODELS.map(async name => {
			const object3d = await SleekLoader.loadObject(`./assets/gltf/pickups/${name}/${name}.gltf`);
			const {effect, amount, duration, pitch = 1, frequency = 1} = object3d.children[0].userData;

			return {name, object3d, effect, amount: Number(amount), duration: Number(duration), pitch: Number(pitch), frequency: Number(frequency), bubble: this.createBubbleMaterial(object3d)};
		}));

		this.bubbleGeometry = new THREE.SphereGeometry(this.config.reach, 32, 16);
	}

	// Tinted with the root object's color property (see SleekLoader.colorOf()), white without one
	createBubbleMaterial (object3d) {
		const {strength, power, fill} = this.config.bubble;
		const color = SleekLoader.colorOf(object3d.children[0].userData.color ?? '#ffffff');

		return new THREE.ShaderMaterial({
			...bubbleShader,
			uniforms: {color: {value: color}, strength: {value: strength}, power: {value: power}, fill: {value: fill}},
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});
	}

	// Every slot around io8 is decided on once, a pickup or not, and forgotten again once it's well past where they
	// go, so it's decided anew when he drives back
	fill (x) {
		const {slots: {spacing, offset, jitter, chance, height}, range, despawn, edge, safeZone} = this.config;
		const last = Math.floor((x + range.ahead - offset) / spacing);

		for (let slot = Math.ceil((x - range.behind - offset) / spacing); slot <= last; slot++) {
			if (this.decided.has(slot)) {
				continue;
			}

			this.decided.add(slot);

			const slotX = slot * spacing + offset + Math.random() * jitter;

			if (Math.random() < chance && this.ground.contains(slotX, edge) && Math.abs(slotX - this.startX) > safeZone) {
				const ground = this.ground.heightAt(slotX);

				if (ground !== null) {
					this.spawn(slotX, ground + THREE.MathUtils.randFloat(...height));
				}
			}
		}

		this.decided.forEach(slot => {
			const dx = slot * spacing + offset - x;

			if (dx < -(despawn.behind + spacing) || dx > despawn.ahead + spacing) {
				this.decided.delete(slot);
			}
		});
	}

	// A random pickup at x, y
	spawn (x, y) {
		const model = pickWeighted(this.models, ({frequency}) => frequency);
		const object3d = this.create(model);

		object3d.position.set(x, y, 0);
		this.scene.add(object3d);
		this.pickups.add({model, object3d, baseY: y, phase: Math.random() * Math.PI * 2, popping: 0});
	}

	// For App.warmUp(): one of each, so their shaders are compiled before the first one shows up
	standIns () {
		return this.models.map(model => this.create(model));
	}

	// A pickup in its bubble, not placed anywhere yet
	create (model) {
		const object3d = model.object3d.clone();

		object3d.add(new THREE.Mesh(this.bubbleGeometry, model.bubble));

		return object3d;
	}

	// Call every frame with io8 (for the pickup check) and the x the game centres on (for placing and removing them)
	step (deltaTime, player, focusX) {
		this.fill(focusX);

		if (!this.pickups.size) {
			return;
		}

		const {reach, spin, bob, pop, despawn} = this.config;
		const canReach = !player.isExploded;

		this.time += deltaTime;

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
			object3d.position.y = pickup.baseY + Math.sin(this.time * bob.speed * Math.PI * 2 + pickup.phase) * bob.height;

			if (canReach && player.distanceTo(object3d.position) < reach) {
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
