import * as THREE from 'three';

/*
	Every collider as Rapier sees it, drawn as lines over the scene: what actually collides, which isn't
	always the mesh you see (a wheel that's a ball, boxes that are cuboids, the terrain's triangles).
	Only for debugging: it's redrawn every frame, and the terrain alone is a lot of lines
*/
export default class SleekPhysicsDebug {
	static LAYER = 31;

	constructor (scene, physics) {
		this.physics = physics;
		this.geometry = new THREE.BufferGeometry();
		this.lines = new THREE.LineSegments(this.geometry, new THREE.LineBasicMaterial({vertexColors: true, transparent: true, depthTest: false}));

		// On top of everything, and it moves all over the place
		this.lines.renderOrder = 999;
		this.lines.frustumCulled = false;

		// Also on a layer of its own, so a camera can be set to see nothing but these (see SleekPhysicsDebug.LAYER)
		this.lines.layers.enable(SleekPhysicsDebug.LAYER);
		scene.add(this.lines);
		this.allocate(1024);
	}

	// Room for this many line ends. The buffers are reused, and only swapped for bigger ones when they're full
	allocate (count) {
		this.size = count;
		this.geometry.dispose();
		this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
		this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage));
	}

	// Call after the physics has stepped
	update () {
		const {vertices, colors} = this.physics.world.debugRender();
		const count = vertices.length / 3;

		if (count > this.size) {
			this.allocate(Math.max(count, this.size * 2));
		}

		const {position, color} = this.geometry.attributes;

		position.array.set(vertices);
		color.array.set(colors);
		position.needsUpdate = true;
		color.needsUpdate = true;
		this.geometry.setDrawRange(0, count);
	}
}
