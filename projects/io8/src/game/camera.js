import * as THREE from 'three';

import SleekLoader from '../sleek/loader.js';

const right = new THREE.Vector3();
const back = new THREE.Vector3();
const look = new THREE.Vector3();
const goal = new THREE.Vector3();
const forward = new THREE.Vector3();
const toFocus = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const matrix = new THREE.Matrix4();

// How far (0-1) from io8 to the camera the terrain is checked, see liftFor()
const SIGHT_CHECKS = [1, 0.8, 0.6, 0.4];

// What a view in camera.json gets for anything it leaves out (see below)
const DEFAULTS = {fov: 45, yaw: 0, distance: 7.5, shift: 0, height: 0.3, lookUp: 0.5, lookAhead: 0, screenX: 0};

/*
	Follows io8 in one of the views from assets/camera.json, picked with the number keys (view "1" is the
	default). Switching view glides over rather than cutting, `glide` is how fast (per second). It eases after
	him, aims ahead by his speed so he stays put on screen however fast he goes, and rises over any terrain
	between it and him so it never dips into a hill (or under water). Each view is where the camera sits and
	where it looks:

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

	// How long since io8 blew up, where it was following his head to (before the shake) and how fast, where it was
	// when it started backing away and how long ago, see retreat()
	sinceBlast = 0;
	followed = null;
	velocity = new THREE.Vector3();
	wreck = null;
	retreating = 0;

	// views is camera.json, see load()
	constructor (camera, ground, water, views, conf = {}) {
		this.camera = camera;
		this.ground = ground;
		this.water = water;
		this.views = Object.fromEntries(Object.entries(views.views).map(([key, view]) => [key, {...DEFAULTS, ...view}]));
		this.config = Object.assign({
			// How quickly it eases after io8, and over to a new view (per second)
			follow: 4,
			glide: views.glide ?? 3,

			// How far (m) it stays above the terrain between it and io8, and above water
			clearance: 0.3,

			// io8 is always kept at least this far in from the sides of the screen (1 = the edge). A view that looks
			// down the road (lookAhead) would otherwise turn him right off a narrow (portrait) screen
			margin: 0.75,

			// Once he's blown up it follows his head for `delay` seconds, then backs away `distance` m and rises
			// `height` m over `time` seconds (easing in and out). As it lets go of the head it coasts on the way it
			// was going, slowing over about `release` seconds (it drifts its speed times `release` m). It keeps
			// facing the same way, but tilts up or down to the horizon over `level` seconds, in case it was looking
			// down at his head in the water
			retreat: {delay: 2, release: 3, distance: 100, height: 40, time: 60, level: 5}
		}, conf);

		this.view = this.views['1'];
		this.current = {...this.view};
	}

	static async load () {
		return JSON.parse(await new THREE.FileLoader(SleekLoader.manager).loadAsync('./assets/camera.json'));
	}

	// A key's code (e.g. "Digit3"), keys without a view do nothing
	pick (code) {
		this.view = this.views[code.replace(/^Digit/, '')] ?? this.view;
	}

	// Call every frame once io8 has blown up, instead of update(), with where his head is and its speed along the
	// road (no focus once there's no head). It follows the head for a moment, then coasts to a stop and slowly
	// backs away and rises (see config.retreat), facing the same way but levelling out to the horizon, never into a
	// hill or the sea
	retreat (deltaTime, focus = null, speed = 0) {
		const {position, quaternion} = this.camera;
		const {delay, release, distance, height, time, level} = this.config.retreat;

		this.sinceBlast += deltaTime;

		if (focus && this.sinceBlast < delay) {
			this.update(deltaTime, focus, speed);

			if (this.followed && deltaTime > 0) {
				this.velocity.subVectors(position, this.followed).divideScalar(deltaTime);
			}

			this.followed = (this.followed ?? new THREE.Vector3()).copy(position);

			return;
		}

		// Away from where it looks, along the ground, and the same view tilted to the horizon
		if (!this.wreck) {
			const away = this.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate();
			const horizon = new THREE.Quaternion().setFromRotationMatrix(matrix.lookAt(away, look.set(0, 0, 0), UP));

			const from = (this.followed ?? position).clone();
			// Coming down, it stops sooner, settling just above the ground (or sea) rather than landing on it
			const room = Math.max(from.y - this.floorAt(from) - this.config.clearance, 0);
			const settle = this.velocity.y < 0 ? Math.min(release, room / -this.velocity.y) : release;

			this.wreck = {position: from, quaternion: quaternion.clone(), horizon, away, settle};
		}

		this.retreating += deltaTime;

		const away = THREE.MathUtils.smoothstep(this.retreating, 0, time);
		// Starts at the speed it had and slows exponentially (stopping after about `slow` seconds), so letting go of
		// the head never jolts
		const coast = slow => slow > 0 ? slow * (1 - Math.exp(-this.retreating / slow)) : 0;

		position.copy(this.wreck.position).addScaledVector(this.wreck.away, distance * away);
		position.x += this.velocity.x * coast(release);
		position.y += this.velocity.y * coast(this.wreck.settle) + height * away;
		position.z += this.velocity.z * coast(release);
		position.y = Math.max(position.y, this.floorAt(position) + this.config.clearance);

		// The explosion's shake turns the camera a little every frame, from here rather than adding up
		quaternion.slerpQuaternions(this.wreck.quaternion, this.wreck.horizon, THREE.MathUtils.smoothstep(this.retreating, 0, level));
	}

	// The ground or the sea, whichever is higher, under a point
	floorAt ({x, z}) {
		return Math.max(this.ground.heightAt(x, z) ?? -Infinity, this.water.levelAt(x, z) ?? -Infinity);
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

		for (const key in view) {
			view[key] += (this.view[key] - view[key]) * Math.min(1, deltaTime * glide);
		}

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
		this.keepInView(focus, halfWidth);
		this.camera.lookAt(look);
	}

	// Turn the camera (around the vertical) just enough that io8 stays within `margin` of the screen's sides.
	// halfWidth is tan(half the horizontal field of view), how wide the screen is
	keepInView (focus, halfWidth) {
		const {position} = this.camera;

		forward.subVectors(look, position).setY(0);
		toFocus.subVectors(focus, position).setY(0);

		// How far round io8 is from straight ahead, + to the left, and the most the screen allows
		const angle = Math.atan2(forward.z * toFocus.x - forward.x * toFocus.z, forward.dot(toFocus));
		const allowed = Math.atan(this.config.margin * halfWidth);
		const excess = Math.abs(angle) - allowed;

		if (excess > 0) {
			look.sub(position).applyAxisAngle(UP, Math.sign(angle) * excess).add(position);
		}
	}

	// How much higher the camera has to be for it, and its line of sight down to io8 (lookY above him), to stay
	// clear of the terrain in between. Checked at a few points along the way. Only the camera itself is kept
	// above water, its line of sight may go through the surface
	liftFor (position, lookY) {
		const {x, z} = this.target;
		let lift = 0;

		for (const t of SIGHT_CHECKS) {
			const ground = this.ground.heightAt(x + (position.x - x) * t, z + (position.z - z) * t);

			// The line of sight at t of the way from io8 to the camera is at lookY + (cameraY - lookY) * t
			if (ground !== null) {
				lift = Math.max(lift, (ground + this.config.clearance - lookY) / t + lookY - position.y);
			}
		}

		const water = this.water.levelAt(position.x, position.z);

		if (water !== null) {
			lift = Math.max(lift, water + this.config.clearance - position.y);
		}

		return lift;
	}
}
