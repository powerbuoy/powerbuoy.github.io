import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Shadow settings per kind of light. A point light shines every way, so its shadow is 6 renders (one per
// cube face), hence the much smaller default. A "shadowSize" custom property on the light overrides the size.
// normalBias (m) samples the shadow a little off the surface: without it, light at a shallow angle (a low sun,
// the headlight along the road) makes surfaces shadow themselves in rings and stripes ("shadow acne")
const LIGHT_SHADOWS = {
	PointLight: {size: 512, bias: -0.002, normalBias: 0.02, near: 0.1},
	SpotLight: {size: 2048, bias: -0.0002, normalBias: 0.02, near: 0.01},
	DirectionalLight: {size: 4096, bias: -0.0002, normalBias: 0.03, near: 0.01}
};

// One manager for every load so a single progress bar covers everything
const manager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(manager);

// The build (build.mjs) turns every .gltf into a .glb, so the code can keep asking for .gltf either way
if (globalThis.BUILD) {
	manager.setURLModifier(url => url.replace(/\.gltf$/, '.glb'));
}

export default class SleekLoader {
	static manager = manager;

	static onProgress (callback) {
		manager.onProgress = (url, loaded, total) => callback(loaded / total, url);
	}

	static async loadObject (src) {
		const gltf = await gltfLoader.loadAsync(src);

		gltf.scene.traverse(node => {
			// Meshes cast and receive shadows unless Blender says "shadow: 0", on them or on anything they're under
			// (a mesh with several materials arrives as one mesh per material, the property is on their parent).
			// "shadow: receive" only receives them: for big things like the terrain, which would otherwise be drawn
			// again into every shadow map just to shade itself
			if (node.isMesh) {
				const shadow = SleekLoader.inherited(node, 'shadow') ?? 1;

				node.castShadow = shadow !== 'receive' && !!Number(shadow);
				node.receiveShadow = shadow === 'receive' || !!Number(shadow);

				if (node.material.map) {
					node.material.map.anisotropy = 16;
				}

				// Real transmission renders the whole scene an extra time every frame, plain transparency is close enough for small bits of glass
				if (node.material.transmission > 0) {
					node.material.opacity = 1 - node.material.transmission * 0.7;
					node.material.transmission = 0;
					node.material.transparent = true;
				}
			}

			// Lights too (same rule as meshes, "shadow: 0" turns it off). They're the expensive part of shadows,
			// so switch off the ones you don't need, like small lights inside something that would block them anyway
			else if (node.isLight && Number(SleekLoader.inherited(node, 'shadow') ?? 1) && LIGHT_SHADOWS[node.type]) {
				const {size, bias, normalBias, near} = LIGHT_SHADOWS[node.type];
				const mapSize = Number(node.userData.shadowSize ?? size);

				node.castShadow = true;
				node.shadow.bias = bias;
				node.shadow.normalBias = normalBias;
				node.shadow.mapSize.set(mapSize, mapSize);
				node.shadow.camera.near = near;
				node.shadow.camera.far = node.distance || 50;
			}

			// How light falls off with distance: 2 (the default, glTF can't carry anything else) is physical, the
			// square of the distance, so blinding up close and dim further out. "decay: 1" in Blender falls off far
			// more gently, for lights that should reach (a headlight down the road) without blowing out what's near
			if (node.isLight && node.userData.decay !== undefined) {
				node.decay = Number(node.userData.decay);
			}
		});

		return gltf.scene;
	}

	// A custom property from the object or the closest thing above it that has it
	static inherited (object, name) {
		for (let obj = object; obj; obj = obj.parent) {
			if (obj.userData[name] !== undefined) {
				return obj.userData[name];
			}
		}

		return undefined;
	}
}
