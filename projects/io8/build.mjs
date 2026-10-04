/*
	npm run build: makes dist/, the version of the game players get (it's committed, so run this before
	committing). The source stays as it is (plain .gltf from Blender, ES modules loaded through the import
	map in index.html), dist/ is made from it:

	- Every .gltf in assets/ becomes one .glb with its textures inside (one request instead of a dozen).
	  Textures bigger than MAX_TEXTURE are scaled down and everything is converted to WebP. Geometry is left
	  exactly as exported (compressing it rounds positions by centimetres, which colliders would feel)
	- src/ and lib/ are bundled and minified into one main.js
	- Everything else in assets/ (audio, sky.json...) is copied as is
*/
import fs from 'node:fs/promises';
import path from 'node:path';
import esbuild from 'esbuild';
import sharp from 'sharp';
import {NodeIO, PropertyType} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup, textureCompress} from '@gltf-transform/functions';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');

// Largest texture size (px, either side). io8 is a few hundred pixels tall on screen and the ground
// textures repeat, so a 4K texture is mostly wasted download and graphics memory
const MAX_TEXTURE = 2048;

// WebP quality (1-100). Normal maps and the packed metal/roughness/occlusion maps hold data rather than
// colour, and lossy WebP blurs their channels together, so they get a higher one
const QUALITY = {color: 80, data: 92};
const DATA_SLOTS = /^(normalTexture|metallicRoughnessTexture|occlusionTexture)$/;

// Never copied into dist/
const SKIP = new Set(['.DS_Store']);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

await fs.rm(DIST, {recursive: true, force: true});
await fs.mkdir(DIST);

const started = performance.now();
const models = await listFiles(path.join(ROOT, 'assets'), file => file.endsWith('.gltf'));

// The files each model points to (textures, .bin). They end up inside its .glb, so aren't copied on their own
const modelFiles = new Map();

for (const file of models) {
	const json = JSON.parse(await fs.readFile(file, 'utf8'));
	const uris = [...(json.buffers ?? []), ...(json.images ?? [])].map(({uri}) => uri).filter(uri => uri && !uri.startsWith('data:'));

	modelFiles.set(file, uris.map(uri => path.join(path.dirname(file), decodeURIComponent(uri))));
}

const usedByModels = new Set([...modelFiles.values()].flat());

await Promise.all([
	...models.map(buildModel),
	copyAssets(),
	bundle()
]);

console.log(`\nBuilt dist/ in ${((performance.now() - started) / 1000).toFixed(1)} s, ${formatSize(await folderSize(DIST))}`);

async function buildModel (file) {
	const out = distPath(file).replace(/\.gltf$/, '.glb');
	const document = await io.read(file);
	const before = (await Promise.all([file, ...modelFiles.get(file)].map(f => fs.stat(f).then(stat => stat.size)))).reduce((a, b) => a + b, 0);

	// Only identical textures and vertex data are merged. Nodes, materials and their names stay as they
	// are, the game finds things by name and reads their custom properties
	await document.transform(
		dedup({propertyTypes: [PropertyType.TEXTURE, PropertyType.ACCESSOR]}),
		textureCompress({encoder: sharp, targetFormat: 'webp', resize: [MAX_TEXTURE, MAX_TEXTURE], slots: DATA_SLOTS, quality: QUALITY.data}),
		textureCompress({encoder: sharp, targetFormat: 'webp', resize: [MAX_TEXTURE, MAX_TEXTURE], slots: negate(DATA_SLOTS), quality: QUALITY.color})
	);

	await fs.mkdir(path.dirname(out), {recursive: true});
	await io.write(out, document);

	const after = (await fs.stat(out)).size;

	console.log(`${path.relative(ROOT, file)}: ${formatSize(before)} -> ${formatSize(after)}`);
}

async function copyAssets () {
	const files = await listFiles(path.join(ROOT, 'assets'), file => !file.endsWith('.gltf') && !usedByModels.has(file) && !SKIP.has(path.basename(file)));

	await Promise.all(files.map(async file => {
		await fs.mkdir(path.dirname(distPath(file)), {recursive: true});
		await fs.copyFile(file, distPath(file));
	}));
}

// One minified main.js instead of the import map and ~40 module files. BUILD tells the code it's running
// from dist/ (models are .glb there, see SleekLoader)
async function bundle () {
	await esbuild.build({
		entryPoints: [path.join(ROOT, 'src/main.js')],
		outfile: path.join(DIST, 'main.js'),
		bundle: true,
		minify: true,
		format: 'esm',
		target: 'es2022',
		define: {'globalThis.BUILD': 'true'},
		logLevel: 'warning',
		plugins: [{
			name: 'import-map',
			setup (build) {
				// The same names the import map in index.html points at lib/
				build.onResolve({filter: /^three$/}, () => ({path: path.join(ROOT, 'lib/three/build/three.module.js')}));
				build.onResolve({filter: /^three\/addons\//}, ({path: p}) => ({path: path.join(ROOT, 'lib/three/examples/jsm', p.slice('three/addons/'.length))}));
				build.onResolve({filter: /^@dimforge\/rapier3d-compat$/}, () => ({path: path.join(ROOT, 'lib/rapier/rapier.mjs')}));
			}
		}]
	});

	// The page itself, loading main.js instead of the import map (and the comment above it) and src/main.js.
	// Fails loudly if index.html no longer looks like this
	const html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
	const built = html
		.replace(/([ \t]*<!--[^\n]*-->\n)?[ \t]*<script type="importmap">[\s\S]*?<\/script>\n\n/, '')
		.replace(/<script type="module" src="\.\/src\/main\.js"><\/script>/, '<script type="module" src="./main.js"></script>');

	if (built.includes('importmap') || !built.includes('src="./main.js"')) {
		throw new Error('index.html: couldn\'t swap the import map and src/main.js for the bundle, check build.mjs');
	}

	await fs.writeFile(path.join(DIST, 'index.html'), built);
}

async function listFiles (dir, keep) {
	const entries = await fs.readdir(dir, {recursive: true, withFileTypes: true});

	return entries.filter(entry => entry.isFile()).map(entry => path.join(entry.parentPath, entry.name)).filter(keep);
}

async function folderSize (dir) {
	const files = await listFiles(dir, () => true);
	const sizes = await Promise.all(files.map(file => fs.stat(file).then(stat => stat.size)));

	return sizes.reduce((a, b) => a + b, 0);
}

function distPath (file) {
	return path.join(DIST, path.relative(ROOT, file));
}

// Matches every texture slot the pattern doesn't
function negate (pattern) {
	return new RegExp(`^(?!${pattern.source.replace(/^\^|\$$/g, '')}$)`);
}

function formatSize (bytes) {
	return `${(bytes / 1e6).toFixed(1)} MB`;
}
