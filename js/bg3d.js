'use strict';

/////////
// Vendor
import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js';
// import { TransformControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/TransformControls.js';
import { EffectComposer } from 'https://unpkg.com/three@0.127.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.127.0/examples/jsm/postprocessing/RenderPass.js';
import { GlitchPass } from 'https://unpkg.com/three@0.127.0/examples/jsm/postprocessing/GlitchPass.js';
import { BokehPass } from 'https://unpkg.com/three@0.127.0/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.127.0/examples/jsm/postprocessing/UnrealBloomPass.js';

//////
// App
export default class Bg3d {
	//////////////
	// Constructor
	constructor (el, conf) {
		this.el = el;
		this.getParams = new URLSearchParams(window.location.search);
		this.config = Object.assign({
			background: false,
			scene: 'assets/alcom.glb',
			envMap: 'assets/envmap.jpg',

			fov: 50,
			easing: TWEEN.Easing.Quadratic.InOut,
			camTransDur: 1500,

			dev: false,
			cameraDataAttr: 'cameraPos',

			postProcessing: {
				glitch: false,
				bokeh: false,
				bloom: false
			}
		}, conf);

		// Glitch
		if (this.getParams.get('glitch')) {
			this.config.postProcessing.glitch = true;
		}

		// New version only
		if (this.getParams.get('new')) {
			this.config.cameraDataAttr = 'camera';
			this.config.fov = 5;
			this.config.background = true;
			this.config.postProcessing.bokeh = true;
			// this.config.postProcessing.bloom = true;
		}

		// Kick off
		this.init();
		this.load();
		this.loadEnv();
		this.lights();
		this.framerate();
		this.postProcessing();

		if (this.config.background) {
			document.documentElement.classList.add('bg3d-background');
			this.updateBgColor();
		}

		// Dev mode
		if (this.getParams.get('dev')) {
			this.config.dev = true;
			this.camera.position.z = 10;
			this.scene.add(new THREE.AxesHelper(500));
			this.controls = new OrbitControls(this.camera, this.renderer.domElement);

			document.documentElement.classList.add('dev');
		}
		// Not dev
		else {
			this.floor();
			this.cameraPos();

			if (!window.matchMedia('(hover: none)').matches) {
				this.mousePos();
			}
		}
	}

	///////////////////////
	// Copy camera position
	// Copies current camera position, used from console in dev mode and copied to different sections in index.html
	copyCameraPos () {
		const cameraPos = {
			x: this.camera.position.x,
			y: this.camera.position.y,
			z: this.camera.position.z,
			rx: this.camera.rotation.x,
			ry: this.camera.rotation.y,
			rz: this.camera.rotation.z,
			fov: this.camera.fov
		};

		if (this.postProcessing.bokehPass) {
			cameraPos.focus = this.postProcessing.bokehPass.materialBokeh.uniforms.focus.value;
		}

		console.log(JSON.stringify(cameraPos));
	}

	// Update the scene background whenever html.--body-bg changes
	updateBgColor () {
		this.scene.background = new THREE.Color(0x333333);

		const observer = new MutationObserver(muts => {
			console.dir(muts);
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class']
		});
	}

	///////
	// Init
	init () {
		// Store object references here
		this.objects = {};

		// Create scene, renderer etc
		this.deltaTime = 0.016;
		this.clock = new THREE.Clock();
		this.scene = new THREE.Scene();
		this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
		this.camera = new THREE.PerspectiveCamera(this.config.fov, this.el.clientWidth / this.el.clientHeight, 0.01, 5000);
		this.currentCameraPos = {x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0};

		this.clock.start();

		// Shadows
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

		// Render size
		this.renderer.setSize(this.el.clientWidth, this.el.clientHeight);
		// this.renderer.setPixelRatio(window.devicePixelRatio); // NOTE: Too performance heavy...
		this.el.appendChild(this.renderer.domElement);

		// Resize
		window.addEventListener('resize', e => {
			this.camera.aspect = this.el.clientWidth / this.el.clientHeight;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(this.el.clientWidth, this.el.clientHeight);
		});
	}

	///////
	// Load
	// Load scene, enable shadows and store references to our objects
	load () {
		const loader = new GLTFLoader();

		loader.load(this.config.scene, glb => {
			glb.scene.traverse(node => {
				// Cast shadows on all meshes
				if (node.isMesh) {
					node.castShadow = true;
					node.receiveShadow = true;

					// And do this...? Anisotropic Filtering I guess?
					if (node.material.map) {
						node.material.map.anisotropy = 16;
					}
				}
				// Make lights cast shadows!
				else if (node.isLight) {
					node.castShadow = true;
					node.shadow.bias = -0.0002;
					node.shadow.mapSize.width = 512 * 8;
					node.shadow.mapSize.height = 512 * 8;
					node.shadow.camera.near = 1;
					node.shadow.camera.far = 1000;

					if (this.config.dev) {
						this.scene.add(new THREE.SpotLightHelper(node));
					}
				}
			});

			// Add scene
			this.scene.add(glb.scene);

			// Grab objects
			this.grabObjects();

			// Hide dev floor
			if (!this.config.dev) {
				const devFloor = this.scene.getObjectByName('dev_floor');

				if (devFloor) {
					devFloor.visible = false;
				}
			}
		});
	}

	////////////////////////
	// Load evnvironment map
	loadEnv () {
		const loader = new THREE.TextureLoader();

		loader.load(this.config.envMap, texture => {
			const renderTarget = new THREE.WebGLCubeRenderTarget(texture.image.height);

			renderTarget.fromEquirectangularTexture(this.renderer, texture);

			this.scene.environment = renderTarget.texture;
		});
	}

	/////////
	// Lights
	// NOTE: Lights are included in the GLTF scene so we only add an amblight
	lights () {
		this.ambLight = new THREE.AmbientLight(0xffffff, 0.5);
		this.scene.add(this.ambLight);
	}

	////////
	// Floor
	// Create a transparent shadow catcher
	// https://threejs.org/docs/#api/en/materials/ShadowMaterial
	floor () {
		const geometry = new THREE.PlaneGeometry(2000, 2000);
		geometry.rotateX(-Math.PI / 2);

		const material = new THREE.ShadowMaterial();
		material.opacity = 0.2;

		this.floor = new THREE.Mesh(geometry, material);
		this.floor.receiveShadow = true;
		this.scene.add(this.floor);
	}

	//////////////////
	// Post processing
	postProcessing () {
		this.composer = new EffectComposer(this.renderer);

		// Render
		this.composer.addPass(new RenderPass(this.scene, this.camera));

		// Bloom
		if (this.config.postProcessing.bloom) {
			this.postProcessing.bloomPass = new UnrealBloomPass({
				x: this.el.clientWidth,
				y: this.el.clientHeight
			}, 1.5, 0.5, 0.85);

			this.composer.addPass(this.postProcessing.bloomPass);
		}
		// Bokeh
		if (this.config.postProcessing.bokeh) {
			this.postProcessing.bokehPass = new BokehPass(this.scene, this.camera, {
				width: this.el.clientWidth,
				height: this.el.clientWidth,
				focus: 1.0,
				aperture: 0.025,
				maxblur: 1.0
			});

			this.composer.addPass(this.postProcessing.bokehPass);
		}
		// Glitch
		if (this.config.postProcessing.glitch) {
			this.composer.addPass(new GlitchPass());
		}
	}

	/////////////
	// Camera pos
	// Change position and rotation of camera as user scrolls into a new [data-camera-pos] element
	cameraPos () {
		const observer = new IntersectionObserver(entries => entries.forEach(entry => {
			if (entry.isIntersecting) {
				this.setCameraPos(JSON.parse(entry.target.dataset[this.config.cameraDataAttr]));
			}
		}), {threshold: 0.25});

		document.querySelectorAll('[data-camera-pos]').forEach(el => observer.observe(el));
	}

	setCameraPos (newPos) {
		this.currentCameraPos = newPos;

		const oldPos = {
			x: this.camera.position.x,
			y: this.camera.position.y,
			z: this.camera.position.z,
			rx: this.camera.rotation.x,
			ry: this.camera.rotation.y,
			rz: this.camera.rotation.z,
			fov: this.camera.fov,
			focus: 1.0
		};

		if (this.postProcessing.bokehPass) {
			oldPos.focus = this.postProcessing.bokehPass.materialBokeh.uniforms.focus.value;
		}

		new TWEEN.Tween(oldPos).to(newPos, this.config.camTransDur).easing(this.config.easing).start().onUpdate(() => {
			// Position
			this.camera.position.x = oldPos.x;
			this.camera.position.y = oldPos.y;
			this.camera.position.z = oldPos.z;

			// Rotation
			this.camera.rotation.x = oldPos.rx;
			this.camera.rotation.y = oldPos.ry;
			this.camera.rotation.z = oldPos.rz;

			// Focus
			if (newPos.focus && this.postProcessing.bokehPass) {
				this.postProcessing.bokehPass.materialBokeh.uniforms.focus.value = oldPos.focus;
			}

			// FOV
			if (newPos.fov) {
				this.camera.fov = oldPos.fov;

				// Need this for FOV change to take effect
				this.camera.updateProjectionMatrix();
			}
		});

		// Tween rotation with lookAt instead
		// https://stackoverflow.com/a/25278875/1074594
		/* const initRot = new THREE.Euler().copy(this.camera.rotation);

		// Look at new position temporarily
		this.camera.lookAt(newPos.lx, newPos.ly, newPos.lz);

		// Copy rotation of new lookAt
		const newRot = new THREE.Euler().copy(this.camera.rotation);

		// Go back to initial rotation
		this.camera.rotation.copy(initRot);

		// Now tween to new rotation
		new TWEEN.Tween(oldRot).to({x: newRot.x, y: newRot.y, z: newRot.z}, this.config.camTransDur).easing(this.config.easing).start().onUpdate(() => {
			this.camera.rotation.x = oldRot.x;
			this.camera.rotation.y = oldRot.y;
			this.camera.rotation.z = oldRot.z;
		}); */
	}

	////////////
	// Mouse pos
	mousePos () {
		document.body.addEventListener('mousemove', e => {
			const x = (e.clientX / window.innerWidth) * 2 - 1;
			const y = (e.clientY / window.innerHeight) * 2 - 1;

			this.camera.rotation.z = this.currentCameraPos.rz + (0.05 * x);
			this.camera.rotation.x = this.currentCameraPos.rx + (0.05 * y);
			// this.camera.fov = this.config.fov + (5 * y);
			this.camera.updateProjectionMatrix();
		});
	}

	///////////////////////////
	// Keep track of framerate
	framerate () {
		this.fpsEl = document.querySelector('[data-fps]');
		this.fps = 0;
		this.stableFps = 0;
		this.fpsRounding = 0.75;
		this.fpsDips = 0; // Number of dips
		this.fpsThreshold = 30; // Minimum FPS
		this.fpsDipsThreshold = 120; // Number of times FPS is allowed to dip below threshold
		this.trackFps = true;
		this.hasInformedFps = false;
	}

	trackFramerate () {
		this.fps = 1 / this.deltaTime;
		this.stableFps = this.fpsRounding * this.stableFps + (1 - this.fpsRounding) * this.fps;

		// Show FPS in dev mode
		if (this.config.dev) {
			this.fpsEl.textContent = Math.round(this.stableFps);
		}

		// Increase dips
		if (this.fps < this.fpsThreshold) {
			this.fpsDips++;
		}

		// If too many dips
		if (this.fpsDips > this.fpsDipsThreshold) {
			// Stop tracking
			if (!this.config.dev) {
				this.trackFps = false;
			}

			// Inform window
			if (!this.hasInformedFps) {
				document.body.dispatchEvent(new Event('bg3d/fps-dip'));

				this.hasInformedFps = true;
			}
		}
	}

	///////////////
	// Grab Objects
	// Save references to our objects and their original positions
	grabObjects () {
		const objects = [
			'flower_enemy', 'block_brick', 'block_brick_2', 'block_question', 'mushroom',
			'laptop_screen', 'espresso_crema', 'globe_holder', 'compass_arrow',
			'clock_hour_hand', 'clock_minute_hand', 'clock_bell_hammer', 'clock_bell_left', 'clock_bell_right',
			'skateboard', 'skateboard_wheel_back_left', 'skateboard_wheel_front_left', 'skateboard_wheel_back_right', 'skateboard_wheel_front_right',
			'r2d2_controller', 'r2d2_head', 'camera_lens'
		];

		objects.forEach(objName => {
			const obj = this.scene.getObjectByName(objName);

			if (obj) {
				obj.userData.origPos = {
					x: obj.position.x,
					y: obj.position.y,
					z: obj.position.z
				};
				obj.userData.origRot = {
					x: obj.rotation.x,
					y: obj.rotation.y,
					z: obj.rotation.z
				};

				this.objects[objName] = obj;
			}
		});
	}

	//////////
	// Animate
	animate () {
		const elapsedTime = this.clock.getElapsedTime();

		if (this.controls && this.controls.update) {
			this.controls.update();
		}

		// About
		if (this.objects.skateboard) {
			this.objects.skateboard.rotation.x = this.objects.skateboard.userData.origRot.x + (Math.sin(elapsedTime * 2) / 16);
		}

		if (this.objects.skateboard_wheel_front_left) {
			this.objects.skateboard_wheel_front_left.rotation.z = -(elapsedTime / 2);
		}

		if (this.objects.skateboard_wheel_front_right) {
			this.objects.skateboard_wheel_front_right.rotation.z = -(elapsedTime / 3);
		}

		if (this.objects.skateboard_wheel_back_right) {
			this.objects.skateboard_wheel_back_right.rotation.z = -elapsedTime;
		}

		if (this.objects.skateboard_wheel_back_left) {
			this.objects.skateboard_wheel_back_left.rotation.z = -(elapsedTime * 20);
		}

		if (this.objects.r2d2_controller) {
			this.objects.r2d2_controller.rotation.y = -(elapsedTime / 3);
		}

		if (this.objects.r2d2_head) {
			this.objects.r2d2_head.rotation.y = this.objects.r2d2_head.userData.origRot.y + (Math.sin(elapsedTime));
		}

		if (this.objects.camera_lens) {
			this.objects.camera_lens.rotation.z = this.objects.camera_lens.userData.origRot.z + (Math.sin(elapsedTime) / 2);
			this.objects.camera_lens.position.z = this.objects.camera_lens.userData.origPos.z + (Math.sin(elapsedTime) / 16);
		}

		// Play
		if (this.objects.block_brick && this.objects.block_brick_2 && this.objects.block_question) {
			this.objects.block_brick.position.y = this.objects.block_brick.userData.origPos.y + (Math.sin(elapsedTime * 2) / 500);
			this.objects.block_question.position.y = this.objects.block_question.userData.origPos.y + (Math.sin((elapsedTime + 0.5) * 2) / 500);
			this.objects.block_brick_2.position.y = this.objects.block_brick.userData.origPos.y + (Math.sin((elapsedTime + 1) * 2) / 500);
		}

		if (this.objects.flower_enemy) {
			this.objects.flower_enemy.position.y = this.objects.flower_enemy.userData.origPos.y - (Math.sin(elapsedTime) / 15 + this.objects.flower_enemy.userData.origPos.y / 3);
			this.objects.flower_enemy.rotation.y = elapsedTime / 2;
		}

		if (this.objects.mushroom) {
			this.objects.mushroom.position.y = this.objects.mushroom.userData.origPos.y - (Math.sin(elapsedTime) / 30);
			this.objects.mushroom.rotation.y = -(elapsedTime * 4);
		}

		// Work
		if (this.objects.laptop_screen) {
			this.objects.laptop_screen.rotation.x = this.objects.laptop_screen.userData.origRot.x + (Math.sin(elapsedTime / 1) / 5);
		}

		if (this.objects.espresso_crema) {
			this.objects.espresso_crema.rotation.y = -(elapsedTime / 4);
		}

		if (this.objects.lamp_head) {
			this.objects.lamp_head.rotation.y = this.objects.lamp_head.userData.origRot.y + (Math.sin(elapsedTime / 2.5) / 4);
		}

		// Contact
		if (this.objects.globe_holder) {
			this.objects.globe_holder.rotation.y = elapsedTime / 4;
		}

		if (this.objects.compass_arrow) {
			this.objects.compass_arrow.rotation.y = this.objects.compass_arrow.userData.origRot.y + (Math.sin(elapsedTime));
		}

		// End
		if (this.objects.clock_bell_hammer) {
			this.objects.clock_bell_hammer.rotation.z = this.objects.clock_bell_hammer.userData.origRot.z + (Math.sin(elapsedTime * 35) / 2);
		}

		if (this.objects.clock_bell_left && this.objects.clock_bell_right) {
			this.objects.clock_bell_left.rotation.z = this.objects.clock_bell_left.userData.origRot.z + (Math.sin(elapsedTime * 50) / 50);
			this.objects.clock_bell_right.rotation.z = this.objects.clock_bell_right.userData.origRot.z + (Math.sin(elapsedTime * 50) / 50);
		}

		if (this.objects.clock_minute_hand) {
			this.objects.clock_minute_hand.rotation.z = -(elapsedTime);
		}

		if (this.objects.clock_hour_hand) {
			this.objects.clock_hour_hand.rotation.z = -(elapsedTime / 12);
		}

		TWEEN.update();
	}

	/////////
	// Render
	render () {
		this.deltaTime = this.clock.getDelta();

		this.animate();
		// this.renderer.render(this.scene, this.camera);
		this.composer.render();

		if (this.trackFps) {
			this.trackFramerate();
		}
	}
}
