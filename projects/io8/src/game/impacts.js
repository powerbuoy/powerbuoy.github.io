import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

import {randomItem} from '../sleek/utils.js';

// Which sound each material makes (Kenney's impact pack has 5 variations of each, _000 to _004), and optionally
// a pitch to play it at (lower = bigger and hollower, 1 = as recorded)
const SOUNDS = {
	cardboard: 'impactPunch_medium',
	robot: 'impactPlate_heavy',
	tyre: 'impactSoft_heavy'
};

const position = new THREE.Vector3();

/*
	Collision sounds. Register colliders with a material, and when they hit something hard enough they play
	a random variation of that material's sound where they are, louder the harder the hit.
	"Hard" is measured in g's (the force compared to the object's own weight), so a light box and heavy io8
	are judged the same way, and resting or rolling (about 1 g) stays quiet
*/
export default class Impacts {
	sounds = {};
	materials = new Map();
	lastPlayed = new Map();
	recent = [];

	constructor (physics, audio, conf = {}) {
		this.physics = physics;
		this.audio = audio;
		this.config = Object.assign({
			// Quietest hit that makes a sound, and the hit that's full volume (in g's)
			minG: 6,
			maxG: 40,

			// Seconds before the same object can make another sound (so a tumbling pile doesn't machine-gun),
			// and how long something is quiet after it's registered (props settling when they spawn)
			cooldown: 0.15,
			settle: 0.5,

			// Most impact sounds per second in total, so an explosion is a crash and not a wall of noise
			maxPerSecond: 20,

			// Random pitch range, so repeated hits don't all sound the same
			pitch: [0.9, 1.1]
		}, conf);

		physics.onContactForce((collider1, collider2, force) => this.onContact(collider1, collider2, force));
	}

	async init () {
		await Promise.all(Object.entries(SOUNDS).map(async ([material, sound]) => {
			const {name, pitch = 1} = typeof sound === 'string' ? {name: sound} : sound;
			const variations = await this.audio.loadVariations(`./assets/audio/kenney_impact-sounds/Audio/${name}`);

			this.sounds[material] = {variations, pitch};
		}));
	}

	// weight (optional) returns the mass (kg) to judge hits by, for colliders that are part of something bigger:
	// io8 is several bodies jointed together, a bump on his 1 kg legs should count against all of him
	register (colliders, material, weight = null) {
		colliders.forEach(collider => {
			collider.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);

			// Rapier only reports forces above this, no point hearing about everything resting on the ground
			collider.setContactForceEventThreshold(collider.mass() * 9.81 * this.config.minG);
			this.materials.set(collider.handle, {material, weight});

			// Counts as having just played, so it stays quiet while it settles
			this.lastPlayed.set(collider.parent().handle, performance.now() / 1000 + this.config.settle - this.config.cooldown);
		});
	}

	// Call before the colliders are removed, or their entries stay forever (handles are never reused)
	unregister (colliders) {
		colliders.forEach(collider => {
			this.materials.delete(collider.handle);
			this.lastPlayed.delete(collider.parent()?.handle);
		});
	}

	onContact (collider1, collider2, force) {
		// Of the two, the one that felt it most (in g's) makes the sound
		let loudest = null;

		[collider1, collider2].forEach(collider => {
			const entry = collider && this.materials.get(collider.handle);
			const body = collider?.parent();
			const mass = entry?.weight?.() ?? body?.mass();

			if (!entry || !body || !mass) {
				return;
			}

			const g = force / (mass * 9.81);

			if (g > (loudest?.g ?? 0)) {
				loudest = {g, body, material: entry.material};
			}
		});

		if (!loudest || loudest.g < this.config.minG) {
			return;
		}

		const {minG, maxG} = this.config;

		this.play(loudest.body, loudest.material, Math.min(1, (loudest.g - minG) / (maxG - minG)), loudest.body.translation());
	}

	// Something that isn't a collision hit a registered collider (a laser bolt), volume 0-1
	hit (collider, point, volume = 1) {
		const entry = this.materials.get(collider.handle);

		if (entry) {
			this.play(collider.parent(), entry.material, volume, point);
		}
	}

	play (body, material, volume, point) {
		const {cooldown, maxPerSecond, pitch} = this.config;
		const now = performance.now() / 1000;

		this.recent = this.recent.filter(time => now - time < 1);

		// Too quiet to matter, this object played very recently, or too much is going on already
		if (volume < 0.05 || now - (this.lastPlayed.get(body.handle) ?? 0) < cooldown || this.recent.length >= maxPerSecond) {
			return;
		}

		this.lastPlayed.set(body.handle, now);
		this.recent.push(now);

		const {variations, pitch: materialPitch} = this.sounds[material];

		this.audio.playAt(randomItem(variations), position.copy(point), {
			volume,
			rate: materialPitch * THREE.MathUtils.randFloat(pitch[0], pitch[1])
		});
	}
}
