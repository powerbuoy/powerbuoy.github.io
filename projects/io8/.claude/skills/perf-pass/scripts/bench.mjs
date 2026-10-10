/*
	Old build against new: node bench.mjs <old url> <new url> [--runs=3] [--frames=600] [--full] [--nofire]

	Steps each build by hand at 1/60 s through drive, combat and death (see common.mjs) and prints, per
	scenario, CPU time (and the slowest 5%), GPU time (synced with readPixels), draw calls, physics and render
	time, JS memory allocated per frame and garbage collections. Builds take turns so drift hits both.

	By default props and pickups are removed (--full keeps them): only then do both builds see the same scene,
	and io8's path is compared too. It must match to 4 decimals unless physics was meant to change. --nofire
	leaves out the shots, whose path depends on the muzzle and the aim
*/
import {open, SCENARIOS, state} from './common.mjs';

const [oldUrl, newUrl] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const flag = name => process.argv.find(arg => arg.startsWith(`--${name}`));
const RUNS = Number(flag('runs')?.split('=')[1] ?? 3);
const FRAMES = Number(flag('frames')?.split('=')[1] ?? 600);
const FULL = !!flag('full');
const FIRE = !flag('nofire');

if (!oldUrl || !newUrl) {
	console.log('node bench.mjs <old url> <new url> [--runs=3] [--frames=600] [--full] [--nofire]');
	process.exit(1);
}

async function run (url) {
	const {browser, page, errors} = await open(url, {props: FULL, pickups: FULL});

	await page.evaluate(SCENARIOS);
	await page.evaluate(() => {
		const gl = app.renderer.getContext();
		const px = new Uint8Array(4);
		const spent = {};

		// Times a method into `spent` under a name, every call
		const time = (obj, name, key) => {
			const original = obj[name].bind(obj);

			obj[name] = (...args) => {
				const start = performance.now();
				const result = original(...args);

				spent[key] = (spent[key] ?? 0) + performance.now() - start;

				return result;
			};
		};

		time(app.physics, 'step', 'physics');
		time(app.composer, 'render', 'render');
		app.renderer.info.autoReset = false;

		window.bench = async (scenario, frames, fire) => {
			const rows = [];

			for (let i = 0; i < frames; i++) {
				window.scenario[scenario](i, fire);

				for (const key in spent) {
					spent[key] = 0;
				}

				app.renderer.info.reset();

				const heap = performance.memory.usedJSHeapSize;
				const start = performance.now();

				app.step(1 / 60);

				const cpu = performance.now() - start;

				gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
				rows.push({cpu, gpu: performance.now() - start - cpu, heap: performance.memory.usedJSHeapSize - heap, calls: app.renderer.info.render.calls, ...spent});

				// Let the browser breathe (garbage collection, tasks) like it would between real frames
				if (i % 30 === 29) {
					await new Promise(resolve => setTimeout(resolve, 0));
				}
			}

			return rows;
		};
	});

	// Warm up the JIT first
	await page.evaluate(() => bench('drive', 120, false));

	const result = {start: await state(page)};

	for (const scenario of ['drive', 'combat', 'death']) {
		result[scenario] = summarise(await page.evaluate(([scenario, frames, fire]) => bench(scenario, frames, fire), [scenario, FRAMES, FIRE]));
		result[`after ${scenario}`] = await state(page);
	}

	result.errors = errors;
	await browser.close();

	return result;
}

function summarise (rows) {
	const out = {};

	['cpu', 'gpu', 'calls', 'physics', 'render'].forEach(key => {
		const values = rows.map(row => row[key] ?? 0).sort((a, b) => a - b);

		out[key] = values.reduce((sum, value) => sum + value, 0) / values.length;
		out[`${key} p95`] = values[Math.floor(values.length * 0.95)];
	});

	out['alloc KB'] = rows.reduce((sum, row) => sum + Math.max(0, row.heap), 0) / rows.length / 1024;

	// A drop of more than 100 KB in a frame is a collection
	out['GCs per 10 s'] = rows.filter(row => row.heap < -100000).length / (rows.length / 600);

	return out;
}

const results = {old: [], new: []};

for (let i = 0; i < RUNS; i++) {
	results.old.push(await run(oldUrl));
	results.new.push(await run(newUrl));
	console.error(`run ${i + 1} of ${RUNS} done`);
}

const mean = (list, scenario, key) => list.reduce((sum, result) => sum + result[scenario][key], 0) / list.length;
const KEYS = [['cpu', 'ms'], ['cpu p95', 'ms'], ['gpu', 'ms'], ['calls', ''], ['physics', 'ms'], ['render', 'ms'], ['alloc KB', ''], ['GCs per 10 s', '']];

console.log(`${FULL ? 'Full game' : 'Bare map (no props or pickups)'}${FIRE ? '' : ', no shots'}, ${RUNS} runs of ${FRAMES} frames each\n`);

for (const scenario of ['drive', 'combat', 'death']) {
	console.log(scenario);

	KEYS.forEach(([key, unit]) => {
		const before = mean(results.old, scenario, key);
		const after = mean(results.new, scenario, key);
		const change = before ? `${after < before ? '' : '+'}${Math.round((after - before) / before * 100)}%` : '';

		console.log(`  ${key.padEnd(13)} ${before.toFixed(2).padStart(8)} -> ${after.toFixed(2).padStart(8)} ${unit.padEnd(2)} ${change}`);
	});
}

// Did both builds do the same thing? Within a build runs should agree too, or something isn't deterministic
console.log('\nwhere it ended up (camera x, y, health, bodies)');

['start', 'after drive', 'after combat', 'after death'].forEach(when => {
	const describe = result => `${result[when].x}, ${result[when].y}, ${result[when].health}, ${result[when].bodies}`;
	const same = results.old.concat(results.new).every(result => describe(result) === describe(results.old[0]));

	console.log(`  ${when.padEnd(13)} old ${describe(results.old[0])}  new ${describe(results.new[0])}  ${same ? 'same' : 'DIFFERENT'}`);
});

const errors = [...results.old, ...results.new].flatMap(result => result.errors);

console.log(errors.length ? `\nerrors:\n${[...new Set(errors)].join('\n')}` : '\nno errors');
