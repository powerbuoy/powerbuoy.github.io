import * as THREE from 'three';

const position = new THREE.Vector3();

/*
	Explosions whose debris is left lying about (a drone shot down, a mine gone off, io8). Their pieces make impact
	sounds, and stay where they land: the map is all there is, nothing is rebuilt that they'd pile up under
*/
export default class Debris {
	explosions = [];

	constructor (impacts) {
		this.impacts = impacts;
	}

	// After explosion.shatter(). The pieces sound like the parts they came from when they land (see Impacts)
	add (explosion) {
		this.impacts.addPieces(explosion);
		this.explosions.push(explosion);
	}

	// Every frame. Anything that still manages to fall off the world is removed, rather than falling forever.
	// Asleep it's lying on something, so only the ones still moving are looked at
	step (deltaTime) {
		this.explosions.forEach(explosion => {
			explosion.step(deltaTime);

			// Backwards, as pieces are taken out of the list
			for (let i = explosion.pieces.length - 1; i >= 0; i--) {
				const piece = explosion.pieces[i];

				if (!piece.body.isSleeping() && piece.body.translation(position).y < -50) {
					this.impacts.unregister([piece.body.collider(0)]);
					explosion.remove(piece);
				}
			}
		});
	}
}
