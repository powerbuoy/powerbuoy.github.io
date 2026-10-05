import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();
const dir = new THREE.Vector3();

// Debris ignores other debris for a moment, so parts that start inside each other (rim in tyre,
// screws in rim) drift apart instead of being fired off at crazy speeds by the solver
const DEBRIS_GROUP = 0x0004;
const MIN_HALF = 0.02;

// Hulls are built from the outermost point in this many directions instead of every vertex. Near enough the
// same shape, but Rapier builds a hull from 48 points in no time, while ~30 pieces with up to ~1,400 vertices
// each took ~25 ms, a visible hitch at the moment of the blast
const HULL_DIRECTIONS = Array.from({length: 48}, (v, i) => {
	// Evenly spread over a sphere (Fibonacci sphere)
	const y = 1 - (i + 0.5) / 24;
	const r = Math.sqrt(1 - y * y);
	const a = i * Math.PI * (3 - Math.sqrt(5));

	return [Math.cos(a) * r, y, Math.sin(a) * r];
});

// Collider shapes per piece, worked out once (see shapeOf())
const shapes = new WeakMap();
const DEBRIS_GROUPS = (DEBRIS_GROUP << 16) | (0xFFFF & ~DEBRIS_GROUP);

/*
	The physics of a blast at a point: shatter() to turn a model into flying debris, and shockwave() to
	shove everything else nearby. Doesn't know about io8, so anything can be blown up with it. What it
	looks like (fire, sparks...) is up to Blasts in blast/
*/
export default class Explosion {
	age = 0;
	pieces = [];

	constructor (scene, physics, center, conf = {}) {
		this.scene = scene;
		this.physics = physics;
		this.center = new THREE.Vector3().copy(center);
		this.config = Object.assign({
			// Shockwave: bodies within radius get up to `impulse` (N·s) per m² of them facing the blast, less the
			// further away they are. A 30 cm, 1 kg cardboard box faces it with 0.09 m², so 67 sends it off at 6 m/s
			radius: 3,
			impulse: 67,

			// Debris: outward speed range (m/s), max spin (rad/s), extra upward kick, how much it spreads
			// towards/away from the camera (0-1, more = more pieces fly at the screen), and how long (s)
			// debris ignores other debris
			speed: [3, 8],
			spin: 20,
			lift: 2,
			depth: 0.4,
			separate: 0.4,

			// kg/m³, so bigger pieces weigh more (wood is ~600)
			density: 600
		}, conf);
	}

	// Shove every dynamic body nearby away from the center. Like a real blast it hits everything with the same
	// pressure, so what moves is what's big and light: cardboard flies, something heavy and compact (io8, or
	// anything with the weight power-up) barely budges. Call after shatter(), debris already has its own outward
	// speed so it's skipped
	shockwave () {
		const {radius, impulse} = this.config;
		const debris = new Set(this.pieces.map(({body}) => body.handle));

		this.physics.world.bodies.forEach(body => {
			if (!body.isDynamic() || debris.has(body.handle)) {
				return;
			}

			dir.copy(body.translation()).sub(this.center);

			const distance = dir.length();

			if (distance > radius) {
				return;
			}

			// Straight up when it's right on top of the blast, otherwise away from it with a bit of lift
			dir.normalize();
			dir.y += 0.5;
			dir.normalize().multiplyScalar(impulse * (1 - distance / radius) * Explosion.areaOf(body));

			body.applyImpulse(dir, true);
		});
	}

	// Roughly how much of a body faces a blast (m²): a cube's side for its volume. Masses set in Blender (or by the
	// weight power-up) don't change it, so they decide how much it moves
	static areaOf (body) {
		let volume = 0;

		for (let i = 0; i < body.numColliders(); i++) {
			volume += body.collider(i).volume();
		}

		return volume ** (2 / 3);
	}

	/*
		Turn every visible mesh in object3d into its own piece of debris with a collider made from
		its shape. velocityOf(mesh) says how fast that part was already moving (so debris keeps momentum).
		An object with a "debris: whole" custom property in Blender flies as one piece with everything under it
		(e.g. on RobotHead_Mesh to keep the whole head intact).
		Lights and other non-mesh children just come along with their piece
	*/
	shatter (object3d, velocityOf = () => null) {
		Explosion.findPieces(object3d).forEach(root => {
			const velocity = velocityOf(root);

			// Keeps its world position, and everything under it (lights, parts of a "whole" piece) comes along
			this.scene.attach(root);
			this.pieces.push(this.createPiece(root, velocity));
		});

		return this.pieces;
	}

	// Work out the debris shapes when the model loads rather than at the moment of the blast
	static prepare (object3d) {
		Explosion.findPieces(object3d).forEach(piece => {
			piece.matrixWorld.decompose(pos, quat, scale);
			Explosion.shapeOf(piece, scale);
		});
	}

	// The objects that fly off as separate pieces (see shatter())
	static findPieces (object3d) {
		const roots = new Set();
		const visit = obj => {
			// Hidden things (collision shapes, flames when not thrusting) don't become debris
			if (!obj.visible) {
				return;
			}

			// One piece for this and everything under it, so don't look any deeper
			if (obj !== object3d && obj.userData.debris === 'whole') {
				roots.add(obj);

				return;
			}

			if (obj.isMesh) {
				roots.add(Explosion.isPrimitive(obj, object3d) ? obj.parent : obj);
			}

			obj.children.forEach(visit);
		};

		object3d.updateWorldMatrix(true, true);
		visit(object3d);

		return roots;
	}

	// The visible meshes a piece is made of: itself, its per-material meshes, or everything under a "whole" piece
	static meshesOf (piece) {
		if (piece.userData.debris === 'whole') {
			const meshes = [];

			piece.traverseVisible(obj => obj.isMesh && meshes.push(obj));

			return meshes;
		}

		return piece.isMesh ? [piece] : piece.children.filter(child => child.isMesh && Explosion.isPrimitive(child));
	}

	createPiece (piece, velocity) {
		const {speed, spin, lift, depth, density} = this.config;

		piece.matrixWorld.decompose(pos, quat, scale);

		const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
			.setTranslation(pos.x, pos.y, pos.z)
			.setRotation(quat)
			.setCcdEnabled(true));

		this.physics.world.createCollider(Explosion.colliderFor(Explosion.shapeOf(piece, scale)).setDensity(density).setCollisionGroups(DEBRIS_GROUPS), body);

		// Away from the blast, plus whatever speed the part already had
		dir.copy(pos).sub(this.center);
		dir.set(dir.x + (Math.random() - 0.5), dir.y + (Math.random() - 0.5) + 0.3, (dir.z + (Math.random() - 0.5) * 2) * depth).normalize();
		dir.multiplyScalar(speed[0] + Math.random() * (speed[1] - speed[0]));
		dir.y += lift;

		if (velocity) {
			dir.add(velocity);
		}

		body.setLinvel(dir, true);
		body.setAngvel({x: (Math.random() - 0.5) * spin, y: (Math.random() - 0.5) * spin, z: (Math.random() - 0.5) * spin}, true);

		this.physics.link(piece, body);

		return {object3d: piece, body};
	}

	step (deltaTime) {
		this.age += deltaTime;

		// Anything that still manages to fall off the world is removed, rather than falling forever
		this.pieces = this.pieces.filter(piece => {
			if (piece.body.translation().y > -50) {
				return true;
			}

			this.physics.unlink(piece.body);
			this.physics.world.removeRigidBody(piece.body);
			piece.object3d.removeFromParent();

			return false;
		});

		// Let debris hit other debris again once it's had a moment to spread out
		if (!this.separated && this.age > this.config.separate) {
			this.separated = true;
			this.pieces.forEach(({body}) => body.collider(0).setCollisionGroups(0xFFFFFFFF));
		}
	}

	// Collision shape from the mesh itself (scale baked in, since bodies can't be scaled).
	// Flat things (stickers, the license plate) have no volume for a hull, so they get a thin box
	static colliderFor ({points, center, half}) {
		// Tiny or paper thin pieces (stickers, the license plate, screws) slip through the ground in a single
		// step, so anything thinner than MIN_HALF gets a box that's at least that thick instead of a hull
		if (Math.min(half.x, half.y, half.z) >= MIN_HALF) {
			const hull = RAPIER.ColliderDesc.convexHull(points);

			if (hull) {
				return hull;
			}
		}

		return RAPIER.ColliderDesc.cuboid(Math.max(half.x, MIN_HALF), Math.max(half.y, MIN_HALF), Math.max(half.z, MIN_HALF))
			.setTranslation(center.x, center.y, center.z);
	}

	// What a piece's collider is built from: the outermost points of its meshes (scale baked in, since bodies
	// can't be scaled) and its bounding box. Walking every vertex takes ~10 ms for all of io8, so it's worked
	// out once and remembered (see prepare())
	static shapeOf (piece, scale) {
		if (shapes.has(piece)) {
			return shapes.get(piece);
		}

		const box = new THREE.Box3();
		const points = [];
		const point = new THREE.Vector3();
		const toPiece = new THREE.Matrix4();

		piece.updateWorldMatrix(true, true);

		const pieceInverse = new THREE.Matrix4().copy(piece.matrixWorld).invert();

		// Every mesh's vertices where they sit relative to the piece, then scaled like the piece
		Explosion.meshesOf(piece).forEach(mesh => {
			const position = mesh.geometry.getAttribute('position');

			toPiece.multiplyMatrices(pieceInverse, mesh.matrixWorld);

			for (let i = 0; i < position.count; i++) {
				point.fromBufferAttribute(position, i).applyMatrix4(toPiece).multiply(scale);
				points.push(point.x, point.y, point.z);
				box.expandByPoint(point);
			}
		});

		const shape = {
			points: Explosion.outermostPoints(points),
			center: box.getCenter(new THREE.Vector3()),
			half: box.getSize(new THREE.Vector3()).multiplyScalar(0.5)
		};

		shapes.set(piece, shape);

		return shape;
	}

	// The furthest point in each of HULL_DIRECTIONS, from a flat [x, y, z, x, y, z, ...] list
	static outermostPoints (points) {
		const picked = new Set();

		HULL_DIRECTIONS.forEach(([dx, dy, dz]) => {
			let best = 0;
			let bestDot = -Infinity;

			for (let i = 0; i < points.length; i += 3) {
				const dot = points[i] * dx + points[i + 1] * dy + points[i + 2] * dz;

				if (dot > bestDot) {
					bestDot = dot;
					best = i;
				}
			}

			picked.add(best);
		});

		return new Float32Array([...picked].flatMap(i => [points[i], points[i + 1], points[i + 2]]));
	}

	// A mesh with several materials arrives from the GLTF loader as a group of one mesh per material,
	// which should fly as one piece (and lights hang off the group, not the meshes)
	static isPrimitive (mesh, root) {
		const parent = mesh.parent;

		return !!parent && parent !== root && !parent.isMesh && !/_(Mesh|RigidBody|Shape)$/.test(parent.name) &&
			mesh.position.lengthSq() === 0 && mesh.quaternion.equals(new THREE.Quaternion()) && mesh.scale.equals(new THREE.Vector3(1, 1, 1));
	}
}
