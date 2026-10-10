// Shared by the perf-pass scripts: headless Chromium on the real GPU, and io8 loaded, paused and ready to be
// stepped by hand. Never played in real time, so a run doesn't depend on how many frames fit in a wait
import fs from 'node:fs';
import {chromium} from 'playwright';

// The headless shell Playwright downloaded once (~/Library/Caches/ms-playwright), its own default otherwise
const SHELL = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`;

// Every option is on by default, the scripts switch off what they measure without
export async function open (url, {seed = true, props = true, pickups = true, width = 1600, height = 900} = {}) {
	const browser = await chromium.launch({
		executablePath: fs.existsSync(SHELL) ? SHELL : undefined,
		args: ['--use-angle=metal', '--enable-gpu', '--enable-precise-memory-info']
	});
	const page = await browser.newPage({viewport: {width, height}});
	const errors = [];

	page.on('pageerror', e => errors.push(String(e)));
	page.on('console', message => message.type() === 'error' && errors.push(message.text()));

	// The same random props, puffs and sparks every run (mulberry32), so builds can be compared
	if (seed) {
		await page.addInitScript(() => {
			let a = 12345;

			Math.random = () => {
				a = (a + 0x6D2B79F5) | 0;

				let t = Math.imul(a ^ (a >>> 15), 1 | a);

				t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			};
		});
	}

	await page.goto(url);
	await page.waitForFunction(() => window.app?.player, null, {timeout: 90000});

	// The game starts paused behind the menu with its first frame drawn. Input and aim are set straight on the app
	await page.evaluate(({props, pickups}) => {
		app.player.hasInput = true;
		app.pointer = {x: 0.6, y: -0.15};

		if (!pickups) {
			app.pickups.step = () => {};
			app.pickups.spawn = () => {};
		}

		// The spawner's layout isn't reproducible between builds, without props io8's path is
		if (!props) {
			app.spawner.props.forEach(prop => {
				app.impacts.unregister(prop.colliders);
				app.emitters.remove(prop.object3d);
				prop.destroy();
			});
			app.spawner.props.clear();
			app.spawner.update = () => {};
		}
	}, {props, pickups});

	return {browser, page, errors};
}

// The usual scenarios, in order: driving, then badly hurt (smoke, sparks) while thrusting on and off and
// shooting four times a second, then blown up. Call from inside page.evaluate() via window.scenario
export const SCENARIOS = `
	window.scenario = {
		drive (i) {
			app.player.keys.add('KeyD');
		},

		combat (i, fire) {
			if (i === 0) {
				app.player.health = app.player.config.health.capacity * 0.15;
			}

			if (fire && i % 15 === 0) {
				app.fire = true;
			}

			i % 120 < 40 ? app.player.keys.add('KeyW') : app.player.keys.delete('KeyW');
		},

		death (i) {
			if (i === 0) {
				app.player.keys.clear();
				app.player.health = 0;
			}
		}
	};
`;

// Where things are, to check two builds did the same thing
export function state (page) {
	return page.evaluate(() => ({
		bodies: app.physics.world.bodies.len(),
		x: +app.camera.position.x.toFixed(4),
		y: +app.camera.position.y.toFixed(4),
		health: +app.player.health.toFixed(4)
	}));
}
