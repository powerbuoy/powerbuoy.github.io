import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export default class SleekScene {
	isPlaying = false;

	constructor (el, conf = {}) {
		this.el = el;
		this.config = Object.assign({
			fov: 50,
			far: 500,
			pixelRatio: 1,
			bloom: {strength: 0.25, radius: 0.1, threshold: 0.85}
		}, conf);

		this.timer = new THREE.Timer();
		this.scene = new THREE.Scene();
		// Keep near/far reasonably tight instead of using logarithmicDepthBuffer, which kills early depth testing (halved fps on an M1)
		this.camera = new THREE.PerspectiveCamera(this.config.fov, 1, 0.1, this.config.far);

		// No antialias: everything is drawn through the composer (bloom) into its own render target, so the
		// canvas's multisampling would never reach the 3D scene, it would only cost memory
		this.renderer = new THREE.WebGLRenderer();
		// Retina at full res is 4x the pixels, roughly halves fps. Try 1.5 or window.devicePixelRatio on a fast GPU
		this.renderer.setPixelRatio(this.config.pixelRatio);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.el.appendChild(this.renderer.domElement);

		this.initPostProcessing();

		// Observe the element rather than the window so the canvas can live anywhere
		new ResizeObserver(() => this.resize()).observe(this.el);
		this.resize();
	}

	// OutputPass does tone mapping and color space conversion, so it must always be last
	initPostProcessing () {
		this.composer = new EffectComposer(this.renderer);
		this.composer.addPass(new RenderPass(this.scene, this.camera));

		if (this.config.bloom) {
			const {strength, radius, threshold} = this.config.bloom;

			this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), strength, radius, threshold));
		}

		this.composer.addPass(new OutputPass());
	}

	resize () {
		const width = this.el.clientWidth;
		const height = this.el.clientHeight;

		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
		this.composer.setSize(width, height);

		// Resizing clears the canvas, and while paused nothing else redraws it
		if (!this.isPlaying) {
			this.composer.render();
		}
	}

	play () {
		this.isPlaying = true;
		this.timer.reset();
		// No timestamp to update(), rAF's is from a different clock than reset() and can go negative
		this.renderer.setAnimationLoop(() => {
			this.timer.update();
			this.step(this.timer.getDelta());
		});
	}

	pause () {
		this.isPlaying = false;
		this.renderer.setAnimationLoop(null);
	}

	step (deltaTime) {
		this.composer.render(deltaTime);
	}
}
