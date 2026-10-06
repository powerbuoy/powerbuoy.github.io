import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const worldPos = new THREE.Vector3();
const worldQuat = new THREE.Quaternion();

/*
	Builds rigid bodies from a GLTF scene using the naming convention from Blender:

	Thing_RigidBody      <- direct child of the scene, becomes a rigid body. Custom props: mass, friction, restitution, collider
		Thing_Mesh       <- what you see
		Thing_Shape      <- hidden, every mesh inside becomes a collider on the same body

	_Shape is optional: without one the _Mesh itself is the collision shape (handy for a road or terrain where
	the collision should match what you see exactly). _Mesh is optional too, Thing_RigidBody can be the mesh
	itself, then every mesh in it collides. mass 0 (or missing) means a fixed body. Colliders default to a convex hull for
	dynamic bodies and a triangle mesh for fixed ones; set "collider" to override.
*/
export default class SleekEntity {
	bodies = {};
	colliders = [];

	// The first body, for position
	mainBody = null;

	// The meshes the colliders were made from (_Shape, or _Mesh when there's no _Shape)
	shapeMeshes = [];

	constructor (object3d, physics, conf = {}) {
		this.object3d = object3d;
		this.physics = physics;
		this.config = Object.assign({
			name: object3d.name,
			pos: {x: 0, y: 0, z: 0}
		}, conf);

		this.object3d.name = this.config.name;
		this.object3d.position.set(this.config.pos.x ?? 0, this.config.pos.y ?? 0, this.config.pos.z ?? 0);
		this.object3d.rotation.set(this.config.rot?.x ?? 0, this.config.rot?.y ?? 0, this.config.rot?.z ?? 0);
		this.object3d.updateWorldMatrix(true, true);

		this.createBodies();

		// Only entities that do something every physics step (io8) listen, plain props don't
		if (this.physicsStep !== SleekEntity.prototype.physicsStep) {
			this.stepListener = timestep => this.physicsStep(timestep);
			this.physics.onStep(this.stepListener);
		}
	}

	createBodies () {
		this.object3d.children.filter(obj => obj.name.endsWith('_RigidBody')).forEach(obj => {
			const name = obj.name.replace(/_RigidBody$/, '');
			const shape = obj.children.find(child => child.name.endsWith('_Shape'));
			const shapes = shape ?? obj.children.find(child => child.name.endsWith('_Mesh')) ?? obj;
			const mass = Number(obj.userData.mass ?? 0);

			obj.getWorldPosition(worldPos);
			obj.getWorldQuaternion(worldQuat);

			const bodyDesc = (mass > 0 ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed())
				.setTranslation(worldPos.x, worldPos.y, worldPos.z)
				.setRotation(worldQuat);

			const body = this.physics.world.createRigidBody(bodyDesc);
			const meshes = [];

			shapes.traverse(child => child.isMesh && meshes.push(child));

			if (meshes.length) {
				this.shapeMeshes.push(...meshes);

				if (shape) {
					shape.visible = false;
				}

				meshes.forEach(mesh => {
					const colliderDesc = SleekEntity.createColliderDesc(mesh, obj, mesh.userData.collider ?? obj.userData.collider ?? (mass > 0 ? 'hull' : 'trimesh'));

					// Spread the Blender mass over all colliders so the body ends up with exactly that
					if (mass > 0) {
						colliderDesc.setMass(mass / meshes.length);
					}

					colliderDesc.setFriction(Number(mesh.userData.friction ?? obj.userData.friction ?? 0.5));
					colliderDesc.setRestitution(Number(mesh.userData.restitution ?? obj.userData.restitution ?? 0));

					this.colliders.push(this.physics.world.createCollider(colliderDesc, body));
				});
			}
			else {
				console.warn(`${obj.name} has no meshes, it won't collide with anything`);
			}

			this.bodies[name] = body;
			this.mainBody ??= body;
			this.physics.link(obj, body);
		});
	}

	// Only call this between frames, never from inside a physics step
	destroy () {
		Object.values(this.bodies).forEach(body => {
			this.physics.unlink(body);
			this.physics.world.removeRigidBody(body);
		});

		if (this.stepListener) {
			this.physics.offStep(this.stepListener);
		}

		this.object3d.removeFromParent();
		this.bodies = {};
		this.mainBody = null;
		this.colliders = [];
		this.shapeMeshes = [];
	}

	// World position of the first body, handy for distance checks
	get position () {
		return this.mainBody?.translation() ?? this.object3d.position;
	}

	// Called every rendered frame
	step (deltaTime) {}

	// Called every fixed physics step, before the world steps
	physicsStep (timestep) {}

	// Vertices have to be relative to the rigid body, and include the shape's own offset, rotation and scale
	static createColliderDesc (mesh, bodyObj, type) {
		const toBody = new THREE.Matrix4().copy(bodyObj.matrixWorld).invert().multiply(mesh.matrixWorld);
		const geometry = mesh.geometry.clone().applyMatrix4(toBody);
		const position = geometry.getAttribute('position');
		const vertices = new Float32Array(position.count * 3);

		// getX/Y/Z rather than .array since GLTF attributes can be interleaved
		for (let i = 0; i < position.count; i++) {
			vertices[i * 3] = position.getX(i);
			vertices[i * 3 + 1] = position.getY(i);
			vertices[i * 3 + 2] = position.getZ(i);
		}

		if (type === 'trimesh') {
			// GLTF geometry is indexed, triangles are NOT just every three vertices in a row
			const indices = geometry.index
				? Uint32Array.from(geometry.index.array)
				: Uint32Array.from({length: position.count}, (v, i) => i);

			// Without FIX_INTERNAL_EDGES things rolling over the mesh snag on the edges between its triangles, even
			// flat ones (io8's wheel would stall at every crease of the road, worse one way than the other). It also
			// merges the duplicate vertices GLTF has along UV seams, so it knows which triangles are neighbours.
			// Costs ~20 ms when the map loads, nothing per step
			return RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES);
		}

		if (type === 'cuboid' || type === 'ball') {
			geometry.computeBoundingBox();

			const box = geometry.boundingBox;
			const center = box.getCenter(new THREE.Vector3());
			const size = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
			const desc = type === 'ball'
				? RAPIER.ColliderDesc.ball(Math.max(size.x, size.y, size.z))
				: RAPIER.ColliderDesc.cuboid(size.x, size.y, size.z);

			return desc.setTranslation(center.x, center.y, center.z);
		}

		return RAPIER.ColliderDesc.convexHull(vertices);
	}
}
