/*
	Where the GPU time goes: node gpu.mjs <url>

	Drives a few seconds in, then times frames (synced with readPixels) with one thing switched off at a time:
	the shadow maps, each post-processing pass, io8, each top-level part of the map and the rest of the scene,
	and every double-sided material made single-sided. Each is 8 rounds of on and off taking turns, so drift
	cancels out; differences under ~0.2 ms are noise. Meshes are hidden rather than lights, as hiding a light
	recompiles every shader. Also lists the biggest meshes by triangles with their shadow and material flags
*/
import {open} from './common.mjs';

const url = process.argv[2];

if (!url) {
	console.log('node gpu.mjs <url>');
	process.exit(1);
}

const {browser, page, errors} = await open(url);

const result = await page.evaluate(() => {
	app.player.keys.add('KeyD');

	for (let i = 0; i < 240; i++) {
		app.step(1 / 60);
	}

	const gl = app.renderer.getContext();
	const px = new Uint8Array(4);
	const frame = () => {
		const start = performance.now();

		app.composer.render();
		gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

		return performance.now() - start;
	};
	const median = list => list.sort((a, b) => a - b)[list.length >> 1];

	// Median frame on minus median frame off
	const cost = (off, on) => {
		const withIt = [];
		const without = [];

		for (let round = 0; round < 8; round++) {
			on();
			frame();
			frame();

			for (let i = 0; i < 10; i++) {
				withIt.push(frame());
			}

			off();
			frame();
			frame();

			for (let i = 0; i < 10; i++) {
				without.push(frame());
			}
		}

		on();

		return +(median(withIt) - median(without)).toFixed(2);
	};

	const meshesOf = root => {
		const meshes = [];

		root.traverse(obj => (obj.isMesh || obj.isPoints || obj.isLine) && obj.visible && meshes.push(obj));

		return [() => meshes.forEach(mesh => mesh.visible = false), () => meshes.forEach(mesh => mesh.visible = true), meshes.length];
	};

	for (let i = 0; i < 30; i++) {
		frame();
	}

	const costs = {'whole frame': +median(Array.from({length: 60}, frame)).toFixed(2)};

	costs['shadow maps'] = cost(() => app.renderer.shadowMap.autoUpdate = false, () => app.renderer.shadowMap.autoUpdate = true);
	app.composer.passes.forEach((pass, i) => {
		if (i > 0 && pass.enabled) {
			costs[`pass ${pass.constructor.name}`] = cost(() => pass.enabled = false, () => pass.enabled = true);
		}
	});

	const [hidePlayer, showPlayer] = meshesOf(app.player.object3d);

	costs.io8 = cost(hidePlayer, showPlayer);
	app.map.object3d.children.forEach(child => {
		const [hide, show, count] = meshesOf(child);

		if (count) {
			costs[`map ${child.name}`] = cost(hide, show);
		}
	});

	const [hideRest, showRest] = meshesOf({traverse: callback => app.scene.children.filter(child => child !== app.map.object3d && child !== app.player.object3d).forEach(child => child.traverse(callback))});

	costs['everything else (props, effects, sky...)'] = cost(hideRest, showRest);

	const doubleSided = new Set();

	app.scene.traverse(obj => obj.isMesh && [obj.material].flat().forEach(material => material.side === 2 && doubleSided.add(material)));

	const sides = side => doubleSided.forEach(material => {
		material.side = side;
		material.needsUpdate = true;
	});

	costs[`${doubleSided.size} double-sided materials`] = cost(() => sides(0), () => sides(2));

	const meshes = [];

	app.scene.traverse(obj => {
		if (!obj.isMesh) {
			return;
		}

		const {index, attributes} = obj.geometry;
		const materials = [obj.material].flat().map(material => `${material.name || material.type}${material.transparent ? ' see-through' : ''}${material.side === 2 ? ' double-sided' : ''}`);
		let path = obj.name;

		for (let parent = obj.parent; parent && parent !== app.scene; parent = parent.parent) {
			path = `${parent.name || parent.type}/${path}`;
		}

		meshes.push({path, triangles: Math.round((index ? index.count : attributes.position.count) / 3 * (obj.count ?? 1)), casts: obj.castShadow, materials: materials.join(', ')});
	});

	meshes.sort((a, b) => b.triangles - a.triangles);

	return {costs, meshes: meshes.slice(0, 12), triangles: meshes.reduce((sum, mesh) => sum + mesh.triangles, 0)};
});

console.log('GPU ms per frame each thing costs (noise ~0.2)');
Object.entries(result.costs).forEach(([what, ms]) => console.log(`  ${String(ms).padStart(6)}  ${what}`));
console.log(`\nbiggest meshes (${result.triangles} triangles in the scene)`);
result.meshes.forEach(({path, triangles, casts, materials}) => console.log(`  ${String(triangles).padStart(7)}  ${casts ? 'casts' : '     '}  ${path}  [${materials}]`));
console.log(errors.length ? `\nerrors:\n${errors.join('\n')}` : '');
await browser.close();
