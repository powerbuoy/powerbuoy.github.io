/*
	Phone and tablet controls:

	- Tilt the device left or right (like a steering wheel) to drive, full gas past TILT degrees either way
	- A finger on the left half of the screen thrusts for as long as it's held
	- A finger on the right half works like the mouse: touching fires, dragging aims

	Each finger keeps the job it started with, so a thumb sliding over the middle doesn't switch. Actions go
	into io8's held set (see IO8.isDown()), aiming and firing through the app like the mouse.
*/

// Degrees the device has to lean (left or right, relative to the screen) before he drives
const TILT = 10;

// Which way up is, in the device's own axes (x right, y up the screen in its natural orientation), from
// deviceorientation's angles. Only the z rotation (alpha) is left out, it doesn't change where up is
function upInDevice (beta, gamma) {
	const b = beta * Math.PI / 180;
	const g = gamma * Math.PI / 180;

	return {x: -Math.sin(g) * Math.cos(b), y: Math.sin(b)};
}

export default class TouchDevice {
	// pointerId -> 'thrust' or 'aim'
	fingers = new Map();

	constructor (app) {
		this.app = app;
		this.lean = Math.sin(TILT * Math.PI / 180);

		window.addEventListener('pointerdown', e => {
			if (e.pointerType !== 'touch' || !this.app.isPlaying) {
				return;
			}

			if (e.clientX < window.innerWidth / 2) {
				this.fingers.set(e.pointerId, 'thrust');
				this.app.player.held.add('thrust');
			}
			else {
				this.fingers.set(e.pointerId, 'aim');
				this.app.setPointer(e.clientX, e.clientY);
				this.app.fire = true;
			}
		});

		window.addEventListener('pointermove', e => {
			if (this.fingers.get(e.pointerId) === 'aim') {
				this.app.setPointer(e.clientX, e.clientY);
			}
		});

		window.addEventListener('pointerup', e => this.lift(e.pointerId));
		window.addEventListener('pointercancel', e => this.lift(e.pointerId));
		window.addEventListener('blur', () => this.release());
		window.addEventListener('deviceorientation', e => this.tilt(e));
	}

	// iOS only sends deviceorientation once the player has allowed it, and only asks from inside a tap or click
	// (the Play button, see App.play()). Elsewhere there's nothing to ask
	async requestTilt () {
		try {
			await DeviceOrientationEvent.requestPermission?.();
		}
		catch {
			// Turned down, or not asked from a tap (resumed with Esc): no tilt, the keyboard still works
		}
	}

	lift (pointerId) {
		// Not one of ours (it went down while paused)
		if (!this.fingers.delete(pointerId)) {
			return;
		}

		if (![...this.fingers.values()].includes('thrust')) {
			this.app.player.held.delete('thrust');
		}
	}

	// Everything let go (paused, or the page lost focus with fingers down)
	release () {
		this.fingers.clear();
		this.app.player?.held.clear();
	}

	tilt (e) {
		const held = this.app.player?.held;

		// Desktops that fire the event without a sensor send nulls
		if (!held || e.beta === null || !this.app.isPlaying) {
			return;
		}

		// Up as seen on the screen, which turns with the device: x > 0 means the right edge is up
		const up = upInDevice(e.beta, e.gamma);
		const angle = (screen.orientation?.angle ?? 0) * Math.PI / 180;
		const x = up.x * Math.cos(angle) - up.y * Math.sin(angle);

		if (x < -this.lean) {
			held.add('forward');
			held.delete('backward');
		}
		else if (x > this.lean) {
			held.add('backward');
			held.delete('forward');
		}
		else {
			held.delete('forward');
			held.delete('backward');
		}
	}
}
