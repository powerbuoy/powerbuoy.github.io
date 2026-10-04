import SleekPhysics from './sleek/physics.js';
import SleekLoader from './sleek/loader.js';
import App from './game/app.js';

const loading = document.getElementById('loading');

SleekLoader.onProgress(progress => {
	loading.querySelector('output').value = `${Math.round(progress * 100)}%`;
});

await SleekPhysics.load();

const app = new App(document.getElementById('game'));

await app.init();

loading.hidden = true;
app.play();

// Handy in the console
window.app = app;
