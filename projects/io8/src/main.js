import SleekPhysics from './sleek/physics.js';
import SleekLoader from './sleek/loader.js';
import App from './game/app.js';

const root = document.documentElement;
const loading = document.getElementById('loading');

SleekLoader.onProgress(progress => {
	loading.querySelector('output').value = `${Math.round(progress * 100)}%`;
});

await SleekPhysics.load();

const app = new App(document.getElementById('game'));

await app.init();

// html.loading is in the page from the start (so it applies before any script runs), until everything's in.
// The CSS shows and hides #loading by it
root.classList.remove('loading');

// The game starts paused behind the start menu (html.paused), with its first frame drawn
function setPaused (paused) {
	root.classList.toggle('paused', paused);

	if (paused) {
		app.pause();
	}
	else {
		app.play();
	}
}

app.step(0);
setPaused(true);

// The end screen (html.dead) shows over the game, which keeps running behind it
app.onExplode = () => root.classList.add('dead');

document.addEventListener('click', e => {
	if (e.target.closest('[data-action="play"]')) {
		setPaused(false);
	}

	// A fresh start, simplest done by loading the page again
	if (e.target.closest('[data-action="restart"]')) {
		location.reload();
	}
});

// Esc pauses, and resumes again from the menu
window.addEventListener('keydown', e => {
	if (e.code === 'Escape' && !e.repeat) {
		setPaused(app.isPlaying);
	}
});

// Handy in the console
window.app = app;
