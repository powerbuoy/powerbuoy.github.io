import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

/*
	Answers "how high is the ground here?" for a map of any shape (hills, dips, steps),
	by casting a ray down onto the map's colliders, the same ones physics uses.

	Rapier rather than three.js: its triangle meshes are sorted into a search tree, so a ray only tests the
	few triangles it passes (three.js tests every one, ~6 ms a ray on a 100k triangle map, and the spawner
	casts several per prop). Each collider is asked directly rather than the world, which only knows where
	things are after the first physics step, and the first props are placed before that.
*/
export default class Ground {
	constructor (entity) {
		this.colliders = entity.colliders;
		this.ray = new RAPIER.Ray({x: 0, y: 0, z: 0}, {x: 0, y: -1, z: 0});

		const box = new THREE.Box3();

		entity.object3d.updateWorldMatrix(true, true);
		entity.shapeMeshes.forEach(mesh => box.expandByObject(mesh));
		this.bounds = box;
	}

	// Highest ground under (x, z), or null when there's no map there
	heightAt (x, z = 0) {
		const top = this.bounds.max.y + 1;
		let nearest = Infinity;

		this.ray.origin = {x, y: top, z};
		this.colliders.forEach(collider => {
			const distance = collider.castRay(this.ray, top - this.bounds.min.y + 1, true);

			// -1 when it misses
			if (distance >= 0 && distance < nearest) {
				nearest = distance;
			}
		});

		return nearest === Infinity ? null : top - nearest;
	}

	// Highest ground under something `width` wide centered on x, so it doesn't start half inside a slope.
	// Null if any part of it would hang off the map
	heightUnder (x, z, width) {
		const heights = [x - width / 2, x, x + width / 2].map(sampleX => this.heightAt(sampleX, z));

		return heights.includes(null) ? null : Math.max(...heights);
	}

	contains (x, margin = 0) {
		return x >= this.bounds.min.x + margin && x <= this.bounds.max.x - margin;
	}
}
