'use strict';

const getParams = new URLSearchParams(window.location.search);

///////
// Bg3d
import Bg3d from './bg3d.js';

const bg3dParams = {
	dev: getParams.get('dev') ? true : false,
	postProcessing: {
		glitch: getParams.get('glitch') ? true : false,
		bokeh: getParams.get('beta') ? true : false,
		// bloom: getParams.get('beta') ? true : false
	}
};

// Store on window so we can play in console
window.bg3d = new Bg3d(document.getElementById('bg'), bg3dParams);

var bg3dRunning = true;

// Render function
function render () {
	window.bg3d.render();

	if (bg3dRunning) {
		requestAnimationFrame(render);
	}
}

render();

/////////////
// Camera pos
// NOTE: Different data-attribute for new version 😬
const cameraAttrName = (getParams.get('beta') ? 'camera' : 'cameraPos');

// Change camera position as user scrolls into a new [data-camera-pos] element
const cameraPosObserver = new IntersectionObserver(entries => entries.forEach(entry => {
	if (entry.isIntersecting) {
		window.bg3d.tweenCameraPos(JSON.parse(entry.target.dataset[cameraAttrName]));
	}
}), {threshold: 0.25});

document.querySelectorAll('[data-camera-pos]').forEach((el, index) => {
	// Start on first el's camera pos
	if (index === 0) {
		window.bg3d.setCameraPos(JSON.parse(el.dataset[cameraAttrName]));
	}

	cameraPosObserver.observe(el);
});

////////////////////////////////////
// Change background on theme change
if (bg3dParams.postProcessing.bokeh || bg3dParams.postProcessing.bloom) {
	const bg3dBgobserver = new MutationObserver(muts => {
		const bodyBg = window.getComputedStyle(document.documentElement).getPropertyValue('--body-bg').trim().substr(1);

		window.bg3d.tweenBg(parseInt(bodyBg, 16));
	});

	bg3dBgobserver.observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
}

////////////////
// Allow pausing
document.querySelectorAll('[data-toggle-bg3d]').forEach(el => {
	el.addEventListener('click', e => {
		e.preventDefault();

		bg3dRunning = !bg3dRunning;

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

////////////////////////////
// Move around on mouse move
// Naw
if (!window.matchMedia('(hover: none)').matches) {
	document.body.addEventListener('mousemove', e => {
		const x = (e.clientX / window.innerWidth) * 2 - 1;
		const y = (e.clientY / window.innerHeight) * 2 - 1;

		window.bg3d.camera.rotation.z = window.bg3d.currentCameraPos.rz + (0.05 * x);
		window.bg3d.camera.fov = window.bg3d.currentCameraPos.fov + (0.75 * y);

		window.bg3d.camera.updateProjectionMatrix(); // NOTE: Needed after FOV change
	});
}

///////////////////////
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
