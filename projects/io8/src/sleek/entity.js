import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const worldPos = new THREE.Vector3();
const worldQuat = new THREE.Quaternion();
const nearest = new THREE.Vector3();

/*
	Builds rigid bodies from a GLTF scene using the naming convention from Blender:

	Thing_RigidBody      <- becomes a rigid body. Custom props: mass, kinematic, friction, restitution, collider, angular_damping
		Thing_Mesh       <- what you see
		Thing_Shape      <- hidden, every mesh inside becomes a collider on the same body

	_Shape is optional: without one the _Mesh itself is the collision shape (handy for a road or terrain where
	the collision should match what you see exactly). _Mesh is optional too, Thing_RigidBody can be the mesh
	itself, then every mesh in it collides. mass 0 (or missing) means a fixed body, kinematic 1 one the code moves (it pushes
	things out of its way, nothing pushes it). Colliders default to a convex hull for dynamic and kinematic bodies and a
	triangle mesh for fixed ones; set "collider" to override. Rapier has no rolling resistance, so a ball rolls forever
	(rocking in a dip, speeding up down a slope): angular_damping slows its spin a little every step instead.

	A _RigidBody can be anywhere in the scene, just not inside another one (its parts are its own business), so
	the copies a collection instance brings along work too. So do the endings copies get: Blender's ".001" (three
	drops the dot) and three's "_1", "_2" for names it has already seen (every instance repeats them)
*/
export default class SleekEntity {
	bodies = {};
	colliders = [];

	// Each body's _RigidBody object, for its custom properties
	bodyObjects = new Map();

	// The first body, for position
	mainBody = null;
	bodyPosition = new THREE.Vector3();

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
		SleekEntity.findRigidBodies(this.object3d).forEach(obj => {
			const name = SleekEntity.nameOf(obj);
			const shape = obj.children.find(child => SleekEntity.is(child, 'Shape'));
			const shapes = shape ?? obj.children.find(child => SleekEntity.is(child, 'Mesh')) ?? obj;
			const mass = Number(obj.userData.mass ?? 0);
			const kinematic = Number(obj.userData.kinematic ?? 0) > 0;

			obj.getWorldPosition(worldPos);
			obj.getWorldQuaternion(worldQuat);

			const bodyDesc = (kinematic ? RAPIER.RigidBodyDesc.kinematicPositionBased() : mass > 0 ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed())
				.setTranslation(worldPos.x, worldPos.y, worldPos.z)
				.setRotation(worldQuat)
				.setAngularDamping(Number(obj.userData.angular_damping ?? 0));

			const body = this.physics.world.createRigidBody(bodyDesc);
			const meshes = [];

			shapes.traverse(child => child.isMesh && meshes.push(child));

			if (meshes.length) {
				this.shapeMeshes.push(...meshes);

				if (shape) {
					shape.visible = false;
				}

				meshes.forEach(mesh => {
					const colliderDesc = SleekEntity.createColliderDesc(mesh, obj, mesh.userData.collider ?? obj.userData.collider ?? (SleekEntity.moves(obj) ? 'hull' : 'trimesh'));

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
			this.bodyObjects.set(body, obj);
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
		this.bodyObjects.clear();
		this.mainBody = null;
		this.colliders = [];
		this.shapeMeshes = [];
	}

	// World position of the first body, handy for distance checks. The same vector every time (it's read for every
	// prop every frame), copy it to keep it
	get position () {
		return this.mainBody?.translation(this.bodyPosition) ?? this.object3d.position;
	}

	// How far (m) `point` is from the nearest bit of it (any of its colliders), 0 if it's inside it
	distanceTo (point) {
		let distance = Infinity;

		this.colliders.forEach(collider => {
			distance = Math.min(distance, nearest.copy(collider.projectPoint(point, true).point).distanceTo(point));
		});

		return distance;
	}

	// Called every rendered frame
	// A custom property from the first of its _RigidBodies that has it, undefined if none does. Read it before
	// the entity is destroyed
	property (key) {
		for (const obj of this.bodyObjects.values()) {
			if (obj.userData[key] !== undefined) {
				return obj.userData[key];
			}
		}

		return undefined;
	}

	step (deltaTime) {}

	// Called every fixed physics step, before the world steps
	physicsStep (timestep) {}

	// Whether obj is a Thing_<part> (RigidBody, Mesh or Shape), copy endings and all
	static is (obj, part) {
		return new RegExp(`_${part}[\\d_]*$`).test(obj.name);
	}

	// Whether a _RigidBody moves: it has a mass, or is kinematic (the code moves it)
	static moves (obj) {
		return Number(obj.userData.mass ?? 0) > 0 || Number(obj.userData.kinematic ?? 0) > 0;
	}

	// Whether obj is called `name`, copy endings and all
	static isNamed (obj, name) {
		return new RegExp(`^${name}[\\d_]*$`).test(obj.name);
	}

	// Thing, from Thing_RigidBody (or a copy of it)
	static nameOf (obj) {
		return obj.name.replace(/_RigidBody[\d_]*$/, '');
	}

	// Every _RigidBody in object3d that isn't inside another one
	static findRigidBodies (object3d) {
		const found = [];
		const visit = obj => obj.children.forEach(child => SleekEntity.is(child, 'RigidBody') ? found.push(child) : visit(child));

		visit(object3d);

		return found;
	}

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

		if (type === 'cuboid' || type === 'sphere') {
			geometry.computeBoundingBox();

			const box = geometry.boundingBox;
			const center = box.getCenter(new THREE.Vector3());
			const size = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
			const desc = type === 'sphere'
				? RAPIER.ColliderDesc.ball(Math.max(size.x, size.y, size.z))
				: RAPIER.ColliderDesc.cuboid(size.x, size.y, size.z);

			return desc.setTranslation(center.x, center.y, center.z);
		}

		return RAPIER.ColliderDesc.convexHull(vertices);
	}
}
