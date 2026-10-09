import * as THREE from 'three';

/*
	Moving water. Any mesh called "Water" in the map (Blender's .001 suffixes are ignored) keeps the material
	it has in Blender, with its normal map (if it has one) drifting: the map is read twice and the two are
	blended, the second larger and turned. One pattern shows its tiling as a grid from far away, two that
	never line up don't.

	Each layer drifts along the waves in the normal map (`wind`, the direction they run in the image, see
	water_nor_gl_1k.png). Speeds are in tiles a second (how the map repeats in Blender, ~20 m on windowsxpmap).

	It also knows where the water is, for anything that shouldn't go in it (io8, the camera)
*/
export default class Water {
	layers = [];
	surfaces = [];
	time = 0;

	constructor (map, conf = {}) {
		this.config = Object.assign({
			wind: 0.33,

			// scale: size compared to how it's tiled in Blender (smaller = bigger waves), turn: radians
			layers: [
				{scale: 1, turn: 0, speed: 0.02},
				{scale: 0.37, turn: 0.9, speed: 0.012}
			]
		}, conf);

		map.updateWorldMatrix(true, true);
		map.traverse(obj => {
			if (obj.isMesh && obj.name.replace(/\.\d+$/, '') === 'Water') {
				this.surfaces.push(new THREE.Box3().setFromObject(obj));

				if (obj.material.normalMap) {
					this.patch(obj.material);
				}
			}
		});
	}

	// How high the water is at (x, z), the highest surface there, or null where there's none
	levelAt (x, z) {
		let level = null;

		this.surfaces.forEach(box => {
			if (x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z && (level === null || box.max.y > level)) {
				level = box.max.y;
			}
		});

		return level;
	}

	isUnder ({x, y, z}) {
		const level = this.levelAt(x, z);

		return level !== null && y < level;
	}

	// Swaps three's one normal map read for the two layers. Each layer's UVs are scaled, turned and moved
	// by a matrix and an offset, and its normals turned back by the same angle so they match the surface
	patch (material) {
		const layers = this.config.layers.map(({scale, turn}) => {
			const cos = Math.cos(turn);
			const sin = Math.sin(turn);

			return {
				matrix: new THREE.Matrix2(cos * scale, -sin * scale, sin * scale, cos * scale),
				turn: new THREE.Matrix2(cos, sin, -sin, cos),
				offset: new THREE.Vector2()
			};
		});

		const normalChunk = THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `
			vec3 mapA = waterNormal( waterLayers[ 0 ] );
			vec3 mapB = waterNormal( waterLayers[ 1 ] );
			// Averaged, as adding them would make the waves twice as steep as the normal map in Blender
			vec3 mapN = normalize( vec3( ( mapA.xy + mapB.xy ) * 0.5, mapA.z * mapB.z ) );
		`);

		// A wave tilted away from the camera reflects downwards, where the sky has no gradient (see sky.js),
		// which showed as flat grey patches. On real water another wave is in the way and reflects the sky, so
		// downward reflections are mirrored up into it
		const reflectChunk = THREE.ShaderChunk.envmap_physical_pars_fragment.replace('reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );', `
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			reflectVec.y = abs( reflectVec.y );
		`);

		// three's shader code changed (after an upgrade?), the water would quietly go back to how it was
		if (normalChunk === THREE.ShaderChunk.normal_fragment_maps || reflectChunk === THREE.ShaderChunk.envmap_physical_pars_fragment) {
			throw new Error('Water: couldn\'t find what it changes in three\'s shader chunks, check water.js');
		}

		material.onBeforeCompile = shader => {
			shader.uniforms.waterLayers = {value: layers};
			shader.fragmentShader = shader.fragmentShader
				.replace('void main() {', `
					struct WaterLayer {
						mat2 matrix;
						mat2 turn;
						vec2 offset;
					};

					uniform WaterLayer waterLayers[ 2 ];

					vec3 waterNormal( WaterLayer layer ) {
						vec3 n = texture2D( normalMap, layer.matrix * vNormalMapUv + layer.offset ).xyz * 2.0 - 1.0;

						return vec3( layer.turn * n.xy, n.z );
					}

					void main() {
				`)
				.replace('#include <envmap_physical_pars_fragment>', reflectChunk)
				.replace('#include <normal_fragment_maps>', normalChunk);
		};

		material.customProgramCacheKey = () => 'water';
		this.layers.push(...layers);
	}

	step (deltaTime) {
		this.time += deltaTime;

		const {wind} = this.config;

		// Wrapped to one tile (it repeats anyway), so the numbers stay small and precise however long it runs
		this.layers.forEach((layer, i) => {
			const distance = this.time * this.config.layers[i % this.config.layers.length].speed;

			layer.offset.set(Math.cos(wind) * distance % 1, Math.sin(wind) * distance % 1);
		});
	}
}
