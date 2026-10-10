import * as THREE from 'three';

import SleekLoader from '../sleek/loader.js';

import Stars from './stars.js';

// Most colours a gradient can have (the shader needs a fixed number)
const MAX_STOPS = 8;

const pivotPosition = new THREE.Vector3();
const from = new THREE.Color();
const to = new THREE.Color();

const shader = {
	vertexShader: `
		varying vec3 vDirection;

		void main () {
			vDirection = position;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`,
	fragmentShader: `
		uniform vec3 colors[${MAX_STOPS}];
		uniform int count;
		uniform float ground;

		varying vec3 vDirection;

		void main () {
			// Below the horizon: the horizon colour times ground (1 for the visible sky, so gaps between hills
			// don't show black, darker for the lighting, or everything would be lit as brightly from below)
			if (vDirection.y < 0.0) {
				gl_FragColor = vec4(colors[0] * ground, 1.0);
				return;
			}

			// 0 at the horizon, 1 straight up, by angle so the stops are spread evenly across the sky
			float height = clamp(asin(normalize(vDirection).y) / 1.5707963, 0.0, 1.0);
			float position = height * float(count - 1);
			int index = int(floor(position));
			vec3 color = colors[0];

			for (int i = 0; i < ${MAX_STOPS - 1}; i++) {
				if (i == index) {
					color = mix(colors[i], colors[i + 1], position - float(i));
				}
			}

			gl_FragColor = vec4(index >= count - 1 ? colors[count - 1] : color, 1.0);
		}
	`
};

/*
	A gradient sky: a dome that follows the camera and is drawn behind everything, coloured by how high
	you look, from the horizon up. The gradients come from the map's sky.json, one per time of day:

		{
			"sky": {
				"0": ["#0b1533", "#060b1e", "#02030a"],
				"18": ["#ff7a3d", "#8a4f8f", "#1c2350"]
			},
			"time": 21,
			"cycle": 240,
			"date": "12-21",
			"environment": 1,
			"fog": 0.003
		}

	Keys are hours (0-24), each gradient's colours go from the horizon up (2 to 8 of them, any number per
	keyframe). In between keyframes the colours blend, wrapping around midnight. `time` is the hour it
	starts at, and `cycle` how many seconds a whole day takes (optional, leave it out and time stands still).
	`date` ("MM-DD", optional) is the time of year, which decides which stars are out at night, see Stars.

	An object called "SkyPivot" in the map turns with the time like the hand of a clock: anything on it
	(the sun on one side, the moon on the other) rises on the left and sets on the right. Model it as it
	looks at midday, sun straight up. The lights on the sun and moon follow them, see Sunlight. Stars turn
	with it too, and come out by themselves as the sky gets dark, see Stars.

	Like the dome and the stars, SkyPivot moves with the camera, so the sun and moon never drift as io8
	drives. It stays as far in front of the camera as it's modelled (keep it inside the draw distance, and
	past the hills), and its x/y are its offset from the camera.

	The sky also lights the scene: it's rendered into the environment map, which is the light everything
	gets from all around (what lights the shady sides) and what shiny and metal things reflect. So night
	really is dark blue and dusk warm. `environment` is how strong that light is (optional, default 1)

	`fog` (optional) is how thick the haze is: things fade into the horizon colour with distance, about two
	thirds gone at 1 / fog metres (0.003 is two thirds at 333 m). It follows the sky's colour through the day.
	Give SkyPivot "fog: 0" in Blender so the sun and moon stay out of it, they're as far away as the sky
*/
export default class Sky {
	keyframes = [];

	constructor (scene, camera, renderer, map, conf) {
		this.scene = scene;
		this.camera = camera;
		this.cycle = conf.cycle ?? 0;

		// The lighting is re-rendered from the sky whenever it's changed by this many hours (not every frame, the
		// sky changes slowly enough that nobody sees it step)
		this.environmentStep = 0.1;

		// Turned so the sun is up at noon, see above
		this.pivot = map.getObjectByName('SkyPivot');
		this.pivotAngle = this.pivot?.rotation.z ?? 0;

		// Where it's modelled is where it sits relative to the camera, see follow()
		this.pivotOffset = this.pivot?.getWorldPosition(new THREE.Vector3());

		// Coloured by setTime(). The sky's own shaders (dome and stars) ignore fog already
		if (conf.fog) {
			scene.fog = new THREE.FogExp2(0x000000, conf.fog);
		}

		// Turned by the pivot, so there are only stars when there's a sky that turns
		if (this.pivot) {
			this.stars = new Stars(scene, camera, this.pivot, conf.catalog, conf.date);
		}

		this.keyframes = Object.entries(conf.sky)
			.map(([hour, colors]) => ({hour: Number(hour), colors: colors.map(color => new THREE.Color(color))}))
			.sort((a, b) => a.hour - b.hour);

		this.stops = Math.min(MAX_STOPS, Math.max(...this.keyframes.map(({colors}) => colors.length)));
		this.material = new THREE.ShaderMaterial({
			...shader,
			uniforms: {
				colors: {value: Array.from({length: MAX_STOPS}, () => new THREE.Color())},
				count: {value: this.stops},
				ground: {value: 1}
			},
			side: THREE.BackSide,
			depthTest: false,
			depthWrite: false
		});

		// Drawn first and never in front of anything, so its size doesn't matter (as long as it's inside the
		// camera's draw distance). It moves with the camera, so the horizon never gets any closer
		this.mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.material);
		this.mesh.renderOrder = -1;
		this.mesh.frustumCulled = false;
		this.mesh.onBeforeRender = () => {
			this.mesh.position.copy(camera.position);
			this.mesh.updateMatrixWorld();
		};
		scene.add(this.mesh);

		// A copy of the sky on its own, with a darker ground, for rendering the lighting from (same colours)
		this.environmentScene = new THREE.Scene();
		this.environmentScene.add(new THREE.Mesh(this.mesh.geometry, new THREE.ShaderMaterial({
			...shader,
			uniforms: {...this.material.uniforms, ground: {value: 0.3}},
			side: THREE.BackSide,
			depthTest: false,
			depthWrite: false
		})));

		// The sky is rendered into a small cube (a smooth gradient needs no detail), then turned into the lighting
		// by the PMREM generator. Both targets are made once and reused, so the lighting texture never changes
		// identity: a new one would make every material re-check its shader
		this.renderer = renderer;
		this.cube = new THREE.WebGLCubeRenderTarget(64, {type: THREE.HalfFloatType});
		this.cubeCamera = new THREE.CubeCamera(0.1, 1000, this.cube);
		this.pmrem = new THREE.PMREMGenerator(renderer);
		scene.environmentIntensity = conf.environment ?? 1;

		this.setTime(conf.time ?? 0);
	}

	// Moves the time on when there's a day/night cycle. Call after the camera has moved
	step (deltaTime) {
		this.follow();

		if (this.cycle) {
			this.setTime(this.time + 24 * deltaTime / this.cycle);
		}
	}

	// The sky is infinitely far away, so SkyPivot moves with the camera (up/down and sideways, it stays as far
	// in front as it's modelled) and the sun and moon never drift, just like the dome and the stars
	follow () {
		if (!this.pivot) {
			return;
		}

		const {x, y} = this.camera.position;

		this.pivot.position.copy(this.pivot.parent.worldToLocal(pivotPosition.set(x + this.pivotOffset.x, y + this.pivotOffset.y, this.pivotOffset.z)));
		this.pivot.updateMatrixWorld(true);
	}

	// Render the sky into the environment map. Only when the sky has changed, see environmentStep
	updateEnvironment () {
		this.cubeCamera.update(this.renderer, this.environmentScene);
		this.environment = this.pmrem.fromCubemap(this.cube.texture, this.environment);
		this.environmentTime = this.time;
		this.scene.environment = this.environment.texture;
	}

	// The map's sky.json (next to its .gltf), or null when it has none. A typo in the file is an error, not "no sky"
	static async load (mapSrc) {
		let text;

		try {
			text = await new THREE.FileLoader(SleekLoader.manager).loadAsync(mapSrc.replace(/[^/]+$/, 'sky.json'));
		}
		catch {
			return null;
		}

		return {...JSON.parse(text), catalog: await Stars.load()};
	}

	// Hours, 0-24
	setTime (hour) {
		const {keyframes} = this;
		const time = ((hour % 24) + 24) % 24;
		const nextIndex = keyframes.findIndex(keyframe => keyframe.hour > time);
		const next = keyframes[nextIndex === -1 ? 0 : nextIndex];
		const previous = keyframes[nextIndex === -1 ? keyframes.length - 1 : (nextIndex - 1 + keyframes.length) % keyframes.length];

		// How far from the previous keyframe to the next, counting hours past midnight when it wraps
		const span = (next.hour - previous.hour + 24) % 24 || 24;
		const blend = ((time - previous.hour + 24) % 24) / span;

		this.time = time;

		// A loop with scratch colours, it runs every frame with a day/night cycle
		for (let i = 0; i < this.stops; i++) {
			const height = i / (this.stops - 1);

			this.material.uniforms.colors.value[i].lerpColors(Sky.sample(previous.colors, height, from), Sky.sample(next.colors, height, to), blend);
		}

		this.stars?.setSky(this.material.uniforms.colors.value[this.stops - 1]);
		this.scene.fog?.color.copy(this.material.uniforms.colors.value[0]);

		// A whole turn a day, anticlockwise as seen from the camera (rising on the left), sun up at noon
		if (this.pivot) {
			this.pivot.rotation.z = this.pivotAngle + (12 - time) / 24 * Math.PI * 2;
			this.pivot.updateMatrixWorld(true);
		}

		// How far the sky has moved since the lighting was last made from it, the short way round midnight
		const since = Math.abs(((time - (this.environmentTime ?? -99) + 36) % 24) - 12);

		if (since >= this.environmentStep) {
			this.updateEnvironment();
		}
	}

	// The colour at `height` (0-1) up a gradient, so gradients with different numbers of colours can blend
	static sample (colors, height, target = new THREE.Color()) {
		if (colors.length === 1) {
			return target.copy(colors[0]);
		}

		const position = height * (colors.length - 1);
		const index = Math.min(colors.length - 2, Math.floor(position));

		return target.lerpColors(colors[index], colors[index + 1], position - index);
	}
}
