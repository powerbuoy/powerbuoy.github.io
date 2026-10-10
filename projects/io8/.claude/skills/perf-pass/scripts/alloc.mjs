/*
	What allocates: node alloc.mjs <url> [--frames=600]

	Samples JS allocations (Chrome's heap profiler) through the combat scenario, the busiest one, and prints the
	top call sites and call stacks in KB per frame. Point it at the unminified source build
	(http://localhost:8765/projects/io8/, not dist/) so the names and lines mean something.
	Most of what's left after a pass is inside three.js uploading uniforms per draw call (setValueM4 and
	friends), which only fewer draw calls can reduce
*/
import {open, SCENARIOS} from './common.mjs';

const url = process.argv[2];
const FRAMES = Number(process.argv.find(arg => arg.startsWith('--frames='))?.split('=')[1] ?? 600);

if (!url) {
	console.log('node alloc.mjs <url> [--frames=600]');
	process.exit(1);
}

const {browser, page, errors} = await open(url);

await page.evaluate(SCENARIOS);
await page.evaluate(async () => {
	window.steps = async (scenario, frames) => {
		for (let i = 0; i < frames; i++) {
			window.scenario[scenario](i, true);
			app.step(1 / 60);

			if (i % 30 === 29) {
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}
	};

	await steps('drive', 120);
});

const cdp = await page.context().newCDPSession(page);

await cdp.send('HeapProfiler.enable');
await cdp.send('HeapProfiler.startSampling', {samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true});
await page.evaluate(frames => steps('combat', frames), FRAMES);

const {profile} = await cdp.send('HeapProfiler.stopSampling');
const sites = new Map();
const stacks = new Map();
let total = 0;

function walk (node, path) {
	const {functionName, url, lineNumber} = node.callFrame;
	const here = `${functionName || '(anonymous)'} ${url.replace(/.*\/io8\//, '')}:${lineNumber + 1}`;
	const next = [here, ...path];

	if (node.selfSize) {
		const stack = next.filter(frame => !frame.includes('(root)')).slice(0, 5).join(' < ');

		total += node.selfSize;
		sites.set(here, (sites.get(here) ?? 0) + node.selfSize);
		stacks.set(stack, (stacks.get(stack) ?? 0) + node.selfSize);
	}

	node.children.forEach(child => walk(child, next));
}

walk(profile.head, []);

const top = (map, count) => [...map].sort((a, b) => b[1] - a[1]).slice(0, count).map(([where, bytes]) => `${(bytes / FRAMES / 1024).toFixed(1).padStart(6)} KB/frame  ${where}`).join('\n');

console.log(`${(total / FRAMES / 1024).toFixed(1)} KB allocated per frame in combat\n\nby call site\n${top(sites, 30)}\n\nby call stack\n${top(stacks, 20)}`);
console.log(errors.length ? `\nerrors:\n${errors.join('\n')}` : '');
await browser.close();
