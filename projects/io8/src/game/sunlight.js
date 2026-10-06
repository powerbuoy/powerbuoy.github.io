import * as THREE from 'three';

const position = new THREE.Vector3();
const direction = new THREE.Vector3();
const lightQuat = new THREE.Quaternion();
const inverseQuat = new THREE.Quaternion();

// Lights shine down their -Z
const FORWARD = new THREE.Vector3(0, 0, -1);

/*
	A directional light (a Sun lamp in Blender) that casts shadows only does so inside a box, so the box
	travels with io8, keeping the shadows sharp along the whole map. Only the light's direction matters,
	where it is in Blender doesn't.

	A light parented to something (the sun or moon disc) always shines from that towards io8, so it follows
	when the disc moves (the day/night cycle turns them), and fades out as the disc sets below the horizon.
	A light on its own keeps the direction it has in Blender.

	Of the lights on discs, only the brightest one casts shadows: every surface samples every shadow map,
	even a dark light's, so the sun's and the moon's together cost far more than one. They hand over while
	both are faded out near the horizon, and as there's always exactly one, no shader has to recompile
*/
export default class Sunlight {
	lights = [];

	constructor (map, scene, conf = {}) {
		this.config = Object.assign({
			// Size (m) of the shadow box around io8 (width and height) and how far it reaches along the light
			shadow: {size: 30, depth: 120},

			// How high above the horizon (as the sine of the angle, roughly radians) a setting sun or moon fades
			// from full strength to nothing. Starts a little below so it's gone by the time it's out of sight
			fade: [-0.03, 0.12]
		}, conf);

		map.traverse(obj => obj.isDirectionalLight && obj.castShadow && this.lights.push({
			light: obj,
			source: obj.parent === map ? null : obj.parent,
			intensity: obj.intensity
		}));

		// Out of the map (and away from whatever it's parented to in Blender, like the moon) so it moves on its own.
		// The target is the light's child one metre in front of it, so its direction comes along
		this.lights.forEach(({light}) => {
			const {size, depth} = this.config.shadow;
			const camera = light.shadow.camera;

			scene.attach(light);

			camera.left = camera.bottom = -size / 2;
			camera.right = camera.top = size / 2;
			camera.near = 0.5;
			camera.far = depth;
			camera.updateProjectionMatrix();
		});
	}

	// Call every frame with the point shadows should be sharpest around (io8)
	step (focus) {
		const [low, high] = this.config.fade;
		let brightest = null;

		this.lights.forEach(({light, source, intensity}) => {
			if (source) {
				direction.copy(focus).sub(source.getWorldPosition(position)).normalize();
				light.quaternion.setFromUnitVectors(FORWARD, direction);
				light.intensity = intensity * THREE.MathUtils.smoothstep(-direction.y, low, high);

				if (!brightest || light.intensity > brightest.intensity) {
					brightest = light;
				}
			}

			this.follow(light, focus);
		});

		// See above. Its shadow map isn't redrawn while it's completely faded out either
		this.lights.forEach(({light, source}) => {
			if (source) {
				light.castShadow = light === brightest;
				light.shadow.autoUpdate = light.castShadow && light.intensity > 0;
			}
		});
	}

	// Put the light half the box's depth back along its direction from the focus. The position is snapped
	// to whole shadow map pixels (sideways, as the light sees it), or the shadow edges shimmer as it moves
	follow (light, focus) {
		const {size, depth} = this.config.shadow;
		const texel = size / light.shadow.mapSize.x;

		inverseQuat.copy(lightQuat.copy(light.quaternion)).invert();
		position.copy(focus).applyQuaternion(inverseQuat);
		position.x = Math.round(position.x / texel) * texel;
		position.y = Math.round(position.y / texel) * texel;

		// Back towards where the light comes from (the light looks down its own -Z)
		position.z += depth / 2;
		position.applyQuaternion(lightQuat);

		light.position.copy(position);
	}
}
