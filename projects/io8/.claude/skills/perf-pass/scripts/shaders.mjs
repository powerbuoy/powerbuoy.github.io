/*
	Shader trouble: node shaders.mjs <url>

	1. Late compiles: any shader program made after loading (warm-up should have made them all), with the
	   objects using it and when it happened. Each one is a hitch the first time something is seen.
	2. Churn: materials three.js sets up again (getParameters + program cache key) every frame although nothing
	   changed, and which of their properties keep flipping. A see-through double-sided material does this twice
	   a frame (three draws its back faces, then its front), a material shared by an instanced and a plain mesh
	   flips "instancing", and so on
*/
import {open, SCENARIOS} from './common.mjs';

const url = process.argv[2];

if (!url) {
	console.log('node shaders.mjs <url>');
	process.exit(1);
}

const {browser, page, errors} = await open(url);

await page.evaluate(SCENARIOS);

const result = await page.evaluate(() => {
	const {properties} = app.renderer;
	const known = new Set(app.renderer.info.programs);
	const late = [];
	const churn = new Map();
	const watched = new Set();

	// three asks a material for its customProgramCacheKey() every time it works out the material's program, so
	// wrapping it counts that, and the material's render properties say what changed since last time
	const watch = material => {
		if (watched.has(material)) {
			return;
		}

		const original = material.customProgramCacheKey;
		const before = {};

		watched.add(material);
		material.customProgramCacheKey = function () {
			const now = properties.get(material);
			const key = `${material.type} "${material.name}"`;
			const entry = churn.get(key) ?? {count: 0, flips: new Set()};

			for (const name in now) {
				const value = now[name];

				if ((value === null || typeof value !== 'object') && before[name] !== undefined && before[name] !== value) {
					entry.flips.add(name);
				}

				if (value === null || typeof value !== 'object') {
					before[name] = value;
				}
			}

			entry.count++;
			churn.set(key, entry);

			return original.call(this);
		};
	};

	const users = program => {
		const found = [];

		app.scene.traverse(obj => [obj.material].flat().forEach(material => {
			if (material && properties.get(material).currentProgram === program) {
				found.push(`${obj.type} ${obj.name || '(no name)'} in ${obj.parent?.name || obj.parent?.type}, ${material.type} ${material.name}`);
			}
		}));

		return found;
	};

	let frames = 0;

	const run = (scenario, count) => {
		for (let i = 0; i < count; i++) {
			app.scene.traverse(obj => [obj.material].flat().forEach(material => material && watch(material)));
			window.scenario[scenario](i, true);
			app.step(1 / 60);
			frames++;

			app.renderer.info.programs.forEach(program => {
				if (!known.has(program)) {
					known.add(program);
					late.push({when: `${scenario} frame ${i}`, users: users(program)});
				}
			});
		}
	};

	run('drive', 200);
	run('combat', 300);
	run('death', 200);

	return {
		late,
		churn: [...churn].filter(([, {count}]) => count / frames > 0.05).map(([key, {count, flips}]) => `${(count / frames).toFixed(2)} a frame  ${key}  flipping: ${[...flips].join(', ') || '?'}`)
	};
});

console.log(result.late.length ? 'compiled after loading:' : 'nothing compiled after loading');
result.late.forEach(({when, users}) => console.log(`  ${when}: ${users.join('; ') || '(nothing in the scene uses it any more)'}`));
console.log(result.churn.length ? '\nset up again every frame:' : '\nno material is set up again every frame');
result.churn.forEach(line => console.log(`  ${line}`));
console.log(errors.length ? `\nerrors:\n${errors.join('\n')}` : '');
await browser.close();
