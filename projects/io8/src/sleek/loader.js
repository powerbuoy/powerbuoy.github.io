import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Shadow settings per kind of light. A point light shines every way, so its shadow is 6 renders (one per
// cube face), hence the much smaller default. A "shadowSize" custom property on the light overrides the size
const LIGHT_SHADOWS = {
	PointLight: {size: 512, bias: -0.002, near: 0.1},
	SpotLight: {size: 2048, bias: -0.0002, near: 0.01},
	DirectionalLight: {size: 2048, bias: -0.0002, near: 0.01}
};

// One manager for every load so a single progress bar covers everything
const manager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(manager);
const textureLoader = new THREE.TextureLoader(manager);

// The build (build.mjs) turns every .gltf into a .glb, so the code can keep asking for .gltf either way
if (globalThis.BUILD) {
	manager.setURLModifier(url => url.replace(/\.gltf$/, '.glb'));
}

export default class SleekLoader {
	static manager = manager;

	static onProgress (callback) {
		manager.onProgress = (url, loaded, total) => callback(loaded / total, url);
	}

	static async loadTexture (src) {
		return textureLoader.loadAsync(src);
	}

	static async loadObject (src) {
		const gltf = await gltfLoader.loadAsync(src);

		gltf.scene.traverse(node => {
			// Meshes cast and receive shadows unless Blender says "shadow: 0", on them or on anything they're under
			// (a mesh with several materials arrives as one mesh per material, the property is on their parent)
			if (node.isMesh) {
				const shadow = SleekLoader.inherited(node, 'shadow') ?? 1;

				node.castShadow = !!Number(shadow);
				node.receiveShadow = !!Number(shadow);

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
				const {size, bias, near} = LIGHT_SHADOWS[node.type];
				const mapSize = Number(node.userData.shadowSize ?? size);

				node.castShadow = true;
				node.shadow.bias = bias;
				node.shadow.mapSize.set(mapSize, mapSize);
				node.shadow.camera.near = near;
				node.shadow.camera.far = node.distance || 50;
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
