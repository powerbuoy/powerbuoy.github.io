'use strict';

///////
// Bg3d
import Bg3d from './bg3d.js';

const ourBg3d = new Bg3d(document.getElementById('bg'));

var bg3dRunning = true;

// Render function
function render () {
	ourBg3d.render();

	if (bg3dRunning) {
		requestAnimationFrame(render);
	}
}

// Wait a tick before we call it
requestAnimationFrame(render);

// Change stuff with ?GET
const getParams = new URLSearchParams(window.location.search);

// Dev
if (getParams.get('glitch')) {
	ourBg3d.config.dev = true;
}
// Beta
if (getParams.get('beta')) {
	ourBg3d.config.beta = true;
}
// Glitch
if (getParams.get('glitch')) {
	ourBg3d.config.postProcessing.glitch = true;
}

// Allow pausing
document.querySelectorAll('[data-toggle-bg3d]').forEach(el => {
	el.addEventListener('click', e => {
		e.preventDefault();

		bg3dRunning = !bg3dRunning;

		// TODO: Don't use events, use ourBg3d.methods()
		if (bg3dRunning) {
			document.body.dispatchEvent(new Event('bg3d/enabled'));
			document.documentElement.classList.remove('bg3d-disabled');
			requestAnimationFrame(render);
		}
		else {
			document.body.dispatchEvent(new Event('bg3d/disabled'));
			document.documentElement.classList.add('bg3d-disabled');
		}
	});
});

// Performance observer
document.body.addEventListener('bg3d/fps-dip', () => {
	document.getElementById('performance-notice').classList.add('active');
});

document.body.addEventListener('bg3d/disabled', () => {
	document.getElementById('performance-notice').classList.remove('active');
});

////////////
// Splitting
Splitting({
	target: 'h1, h2',
	by: 'chars'
});

//////////
// 3D Tilt
/* import ThreedTilt from './threed-tilt.js';

document.querySelectorAll('#work article').forEach(el => {
	new ThreedTilt(el).mount();
}); */

////////////
// Scrollspy
const scrollspyObserver = new IntersectionObserver(entries => entries.forEach(entry => {
	if (entry.isIntersecting) {
		entry.target.classList.add('in-view');
	}
	else {
		entry.target.classList.remove('in-view');
	}
}), {threshold: 0.25});

document.querySelectorAll('section').forEach(el => {
	scrollspyObserver.observe(el);
});

////////////
// Set theme
var autoThemeEnabled = true;
const allThemes = [];
const allThemeButtons = document.querySelectorAll('[data-set-theme]');

allThemeButtons.forEach(el => {
	const theme = el.dataset.setTheme;

	allThemes.push(theme);

	if (document.documentElement.classList.contains('theme-' + theme)) {
		el.classList.add('active');
	}

	el.addEventListener('click', e => {
		// NOTE: If manually triggered click (most likely...)
		if (e.x !== 0 && e.y !== 0) {
			autoThemeEnabled = false;
		}

		allThemes.forEach(t => document.documentElement.classList.remove('theme-' + t));
		allThemeButtons.forEach(tb => tb.classList.remove('active'));

		document.documentElement.classList.add('theme-' + theme);
		el.classList.add('active');
	});
});

// Auto theme
const autoThemeObserver = new IntersectionObserver(entries => entries.forEach(entry => {
	if (entry.isIntersecting && autoThemeEnabled) {
		var theme = entry.target.dataset.autoTheme;

		if (theme === 'random') {
			theme = allThemes[Math.floor(Math.random() * allThemes.length)]
		}

		const active = Array.from(allThemeButtons).filter(tb => tb.dataset.setTheme === theme);

		if (active) {
			active[0].click();
		}
	}
}), {threshold: 0.25});

document.querySelectorAll('[data-auto-theme]').forEach(el => {
	autoThemeObserver.observe(el);
});

////////////////////
// Highlight visible
document.querySelectorAll('[data-highlight-visible]').forEach(el => {
	const links = el.querySelectorAll('a[href^="#"]');
	const targets = document.querySelectorAll(Array.from(links).map(link => link.getAttribute('href')).join(', '));
	const observer = new IntersectionObserver(entries => entries.forEach(entry => {
		const target = Array.from(links).filter(l => l.getAttribute('href') === '#' + entry.target.id)[0];

		if (entry.isIntersecting) {
			links.forEach(l => l.classList.remove('active'));
			target.classList.add('active');
		}
		else {
			target.classList.remove('active');
		}
	}), {threshold: 0.25});

	targets.forEach(t => observer.observe(t));
});

document.documentElement.classList.add('loaded');
