import * as THREE from 'three';

import SleekLoader from '../sleek/loader.js';

const CONFIG = {
	// Made by scripts/stars.mjs
	catalog: './assets/stars.json',

	// The faintest stars in the catalog (magnitude), and how bright a star has to be (magnitude) to get full brightness
	magnitude: [6.5, 1],

	// How much of each star's real colour to use, they look washed out to the eye (0 is all white)
	saturation: 0.6,

	// A sphere of stars around the camera (m), past everything on the map but inside the draw distance (see App)
	radius: 4000,

	// Point sizes in pixels
	size: [1, 3],

	// How bright the sky straight up (its luminance) can be before even the brightest star is lost in it
	daylight: 0.03
};

const shader = {
	vertexShader: `
		attribute float size;
		attribute vec3 color;
		attribute float brightness;

		varying vec3 vColor;
		varying float vBrightness;

		void main () {
			vColor = color;
			vBrightness = brightness;
			gl_PointSize = size;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`,
	fragmentShader: `
		uniform float daylight;

		varying vec3 vColor;
		varying float vBrightness;

		void main () {
			// Round, with a soft edge (smoothstep's edges have to go up, the other way round is undefined in GLSL
			// and some GPUs return garbage, which bloom spreads into black squares)
			float edge = 1.0 - smoothstep(0.2, 0.5, length(gl_PointCoord - 0.5));

			// The sky drowns out the faint stars first, so the bright ones come out first at dusk
			float visible = max(0.0, vBrightness - daylight);

			gl_FragColor = vec4(vColor * visible * edge, 1.0);
		}
	`
};

/*
	The real night sky, every star you can see with the naked eye, turned like SkyPivot so they move with the
	sun and moon. They're always there, the sky's own brightness hides them (see Sky.setTime), faintest first.
	They follow the camera like the sky dome, so they're infinitely far away and the constellations keep
	their real shapes.

	SkyPivot's axis (its Z, pointing out of the screen) is the celestial north pole, behind the camera, so the
	camera looks south and the sky is as seen from the equator. Tilt SkyPivot in Blender (around its X, the
	axis across the screen) by a latitude to see the sky from there instead, the sun and moon tilt with it.

	Which stars are up at night depends on the time of year, `date` in sky.json ("MM-DD", optional, the
	March equinox if it's left out)
*/
export default class Stars {
	constructor (scene, camera, pivot, catalog, date = '03-20') {
		const {radius, size, magnitude, saturation} = CONFIG;
		const count = catalog.length / 4;
		const positions = new Float32Array(count * 3);
		const colors = new Float32Array(count * 3);
		const sizes = new Float32Array(count);
		const brightness = new Float32Array(count);
		const color = new THREE.Color();
		const white = new THREE.Color(1, 1, 1);

		// The sun's right ascension (hours), roughly: 0 at the March equinox, a whole turn a year. SkyPivot is
		// modelled at noon with the sun straight up, so that's what's straight up on the pivot
		const [month, day] = date.split('-').map(Number);
		const sun = (Date.UTC(2001, month - 1, day) - Date.UTC(2001, 2, 20)) / 864e5 / 365.25 * 24;

		for (let i = 0; i < count; i++) {
			const [ra, dec, mag, bv] = catalog.slice(i * 4, i * 4 + 4);

			// Round the pole from straight up, anticlockwise from the camera, so stars that rise later (bigger
			// right ascension) are further left (east), the same way round as SkyPivot turns
			const angle = (ra - sun) / 24 * Math.PI * 2;
			const declination = THREE.MathUtils.degToRad(dec);

			positions.set([
				-Math.sin(angle) * Math.cos(declination) * radius,
				Math.cos(angle) * Math.cos(declination) * radius,
				Math.sin(declination) * radius
			], i * 3);

			// Magnitudes are already logarithmic, like the eye, so a straight line from faint to bright looks right
			brightness[i] = 0.2 + 0.8 * THREE.MathUtils.clamp(THREE.MathUtils.inverseLerp(...magnitude, mag), 0, 1);
			sizes[i] = THREE.MathUtils.lerp(...size, brightness[i]);

			Stars.colorOf(bv, color).lerp(white, 1 - saturation);
			colors.set([color.r, color.g, color.b], i * 3);
		}

		const geometry = new THREE.BufferGeometry();

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
		geometry.setAttribute('brightness', new THREE.BufferAttribute(brightness, 1));

		this.material = new THREE.ShaderMaterial({
			...shader,
			uniforms: {daylight: {value: 0}},
			blending: THREE.AdditiveBlending,
			transparent: true,
			depthWrite: false
		});

		this.points = new THREE.Points(geometry, this.material);
		this.points.frustumCulled = false;
		this.points.onBeforeRender = () => {
			this.points.position.copy(camera.position);
			pivot.getWorldQuaternion(this.points.quaternion);
			this.points.updateMatrixWorld();
		};
		scene.add(this.points);
	}

	static async load () {
		return JSON.parse(await new THREE.FileLoader(SleekLoader.manager).loadAsync(CONFIG.catalog));
	}

	// A star's colour from its B-V colour index: its temperature (Ballesteros' formula), then the colour of
	// something glowing that hot (Tanner Helland's fit), normalised so the brightest channel is 1
	static colorOf (bv, color) {
		const kelvin = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
		const t = kelvin / 100;
		const r = t <= 66 ? 255 : 329.7 * (t - 60) ** -0.1332;
		const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * (t - 60) ** -0.0755;
		const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
		const channels = [r, g, b].map(channel => THREE.MathUtils.clamp(channel, 0, 255));
		const max = Math.max(...channels);

		return color.setRGB(...channels.map(channel => channel / max), THREE.SRGBColorSpace);
	}

	// sky is the colour straight up
	setSky (sky) {
		const luminance = 0.2126 * sky.r + 0.7152 * sky.g + 0.0722 * sky.b;

		this.points.visible = luminance < CONFIG.daylight;
		this.material.uniforms.daylight.value = luminance / CONFIG.daylight;
	}
}
