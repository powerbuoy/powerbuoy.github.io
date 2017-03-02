export function configure (config) {
	config.globalResources([
		// Attributes
		'resources/attributes/parallax',
		'resources/attributes/scrollspy',
		'resources/attributes/smooth-scroll',
		'resources/attributes/expandable',
		'resources/attributes/placeholder-label',

		// Elements
		'resources/elements/aurelia-popups/popup',
		'resources/elements/aurelia-popups/popup.attribute',
		'resources/elements/aurelia-popups/alert',
		'resources/elements/aurelia-popups/confirm',

		'resources/elements/aurelia-tabs/tabs',
		'resources/elements/aurelia-tabs/tab.attribute'
	]);
}
