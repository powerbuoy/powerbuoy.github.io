import * as THREE from 'three';

import SleekLoader from '../sleek/loader.js';

const right = new THREE.Vector3();
const back = new THREE.Vector3();
const look = new THREE.Vector3();
const goal = new THREE.Vector3();

// What a view in camera.json gets for anything it leaves out (see below)
const DEFAULTS = {fov: 45, yaw: 0, distance: 7.5, shift: 0, height: 0.3, lookUp: 0.5, lookAhead: 0, screenX: 0};

/*
	Follows io8 in one of the views from assets/camera.json, picked with the number keys (view "1" is the
	default). Switching view glides over rather than cutting, `glide` is how fast (per second). It eases after
	him, aims ahead by his speed so he stays put on screen however fast he goes, and rises over any terrain
	between it and him so it never dips into a hill. Each view is where the camera sits and where it looks:

	- fov: field of view (degrees, top to bottom)
	- yaw: degrees around io8 from the side view (0, the camera out in front of the road looking across it).
	  Negative swings it back behind him, positive round in front of him
	- distance (m) from io8, shift (m) to the right as the camera sees it, height (m) above him
	- lookUp: how high above io8 (m) it looks, lookAhead how far past him down the road (m). Pushes him back
	  (down and left) in views that look along the road
	- screenX: where io8 ends up on screen, -1 the left edge, 0 the middle, 1 the right. The camera turns until
	  he's there, which depends on how wide the screen is (a narrow portrait screen needs much less turn, or
	  he'd end up off it). Measured at his depth, so a little out for things in front/behind
*/
export default class FollowCamera {
	// Where it's following (io8, plus the lead), eased
	target = new THREE.Vector3();
	lead = 0;
	lift = 0;

	// views is camera.json, see load()
	constructor (camera, ground, views, conf = {}) {
		this.camera = camera;
		this.ground = ground;
		this.views = Object.fromEntries(Object.entries(views.views).map(([key, view]) => [key, {...DEFAULTS, ...view}]));
		this.config = Object.assign({
			// How quickly it eases after io8, and over to a new view (per second)
			follow: 4,
			glide: views.glide ?? 3,

			// How far (m) it stays above the terrain between it and io8
			clearance: 0.3
		}, conf);

		this.view = this.views['1'];
		this.current = {...this.view};
	}

	static async load () {
		return JSON.parse(await new THREE.FileLoader(SleekLoader.manager).loadAsync('./assets/camera.json'));
	}

	// A key's code (e.g. "Digit3"), true if there's a view for it
	pick (code) {
		const view = this.views[code.replace(/^Digit/, '')];

		if (!view) {
			return false;
		}

		this.view = view;

		return true;
	}

	// focus is where io8 is, speed his speed along the road (m/s). A big deltaTime (1) snaps straight there
	update (deltaTime, focus, speed) {
		const {follow, glide} = this.config;

		// Easing after io8 at rate `follow` leaves the camera speed / follow behind, which pushes io8 towards
		// the middle of the screen when it's fast. Aiming that far ahead cancels it out, so io8 stays put on
		// screen at any speed. The speed is smoothed so io8's wobble doesn't shake the camera
		this.lead += (speed / follow - this.lead) * Math.min(1, deltaTime * 2);
		goal.copy(focus);
		goal.x += this.lead;
		this.target.lerp(goal, Math.min(1, deltaTime * follow));

		// Glide towards the picked view
		const view = this.current;

		Object.keys(view).forEach(key => view[key] += (this.view[key] - view[key]) * Math.min(1, deltaTime * glide));

		const {fov, yaw, distance, shift, height, lookUp, lookAhead, screenX} = view;

		if (Math.abs(this.camera.fov - fov) > 0.01) {
			this.camera.fov = fov;
			this.camera.updateProjectionMatrix();
		}

		const angle = THREE.MathUtils.degToRad(yaw);
		const halfWidth = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
		const ahead = distance * Math.tan(Math.atan(-screenX * halfWidth) - Math.atan(shift / distance));

		// The camera's right and "from io8 towards the camera", flat
		right.set(Math.cos(angle), 0, -Math.sin(angle));
		back.set(Math.sin(angle), 0, Math.cos(angle));

		const {position} = this.camera;

		position.copy(this.target).addScaledVector(back, distance).addScaledVector(right, shift);
		position.y += height;
		look.copy(this.target).addScaledVector(right, shift + ahead);
		look.x += lookAhead;
		look.y += lookUp;

		// Straight up when the ground needs it (so it never dips in), eased back down so it doesn't bob over every bump
		const lift = this.liftFor(position, look.y);

		this.lift = lift > this.lift ? lift : this.lift + (lift - this.lift) * Math.min(1, deltaTime * 2);
		position.y += this.lift;
		this.camera.lookAt(look);
	}

	// How much higher the camera has to be for it, and its line of sight down to io8 (lookY above him), to stay
	// clear of the terrain in between. Checked at a few points along the way
	liftFor (position, lookY) {
		const {x, z} = this.target;
		let lift = 0;

		[1, 0.8, 0.6, 0.4].forEach(t => {
			const ground = this.ground.heightAt(x + (position.x - x) * t, z + (position.z - z) * t);

			// The line of sight at t of the way from io8 to the camera is at lookY + (cameraY - lookY) * t
			if (ground !== null) {
				lift = Math.max(lift, (ground + this.config.clearance - lookY) / t + lookY - position.y);
			}
		});

		return lift;
	}
}
