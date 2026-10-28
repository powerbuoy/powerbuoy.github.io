import {DESPAWN} from './spawner.js';

/*
	Explosions whose debris is left lying about (a drone shot down, a mine gone off, io8). Their pieces make impact sounds,
	and once io8 has left them far behind (or they're far ahead) they're removed, like the spawner's props
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

	// Every frame, `x` is where io8 is (or blew up)
	step (deltaTime, x) {
		this.explosions = this.explosions.filter(explosion => {
			const dx = explosion.center.x - x;

			if (dx > -DESPAWN.behind && dx < DESPAWN.ahead) {
				explosion.step(deltaTime);

				return true;
			}

			this.impacts.unregister(explosion.pieces.map(piece => piece.body.collider(0)));
			explosion.destroy();

			return false;
		});
	}
}
