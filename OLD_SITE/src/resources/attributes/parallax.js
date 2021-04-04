import {inject} from 'aurelia-framework';

@inject(Element)
export class ParallaxCustomAttribute {
	constructor (el) {
		this.el = el;
		this.parallaxAmount = 1.5;

		this.onResize = e => {
			this.winDim = this.getWindowDimensions();
		};
		this.onScroll = e => {
			window.requestAnimationFrame(() => {
			//	this.img.style.transform = 'translate(-50%, ' + this.calculateImgPosition() + 'px)';
				this.el.style.backgroundPosition = '50% calc(100% + ' + this.calculateImgPosition() + 'px)';
			});
		};
	}

	attached () {
		// Store window size
		this.winDim = this.getWindowDimensions();

		// Background image version
		this.el.style.backgroundImage = 'url(' + this.el.getAttribute('parallax') + ')';
		this.el.style.backgroundRepeat = 'no-repeat';
		this.el.style.backgroundSize = 'auto ' + (100 * this.parallaxAmount) + '%';
		this.el.style.backgroundPosition = '50% calc(100% + ' + this.calculateImgPosition() + 'px)';

		// Make sure container doesn't have a background of its own
	/*	this.el.style.background = 'transparent';
		this.el.style.overflow = 'hidden';

		// Create image element
		this.img = this.createImg(this.el.getAttribute('parallax'));

		// Add image to container
		this.el.appendChild(this.img);

		// Calculate image position
		this.img.style.transform = 'translate(-50%, ' + this.calculateImgPosition() + 'px)'; */

		// Only do this in high res... (actually no, seems to run well)
		if (true || window.matchMedia('(min-width: 800px)').matches) {
			// Hook up events
			window.addEventListener('scroll', this.onScroll);
			window.addEventListener('resize', this.onResize);
		}
	}

	detached () {
		window.removeEventListener('resize', this.onResize);
		window.removeEventListener('scroll', this.onScroll);
	}

	createImg (src) {
		// Create the image
		let img = document.createElement('img');

		img.src = src;

		// For potential styling
		img.classList.add('parallax');

		// Position the image
		img.style.position = 'absolute';
		img.style.left = '50%';
		img.style.bottom = '0';
		img.style.zIndex = '-1';
		img.style.pointerEvents = 'none';
		img.style.width = 'auto';
		img.style.height = 'auto';
		img.style.minWidth = '100%';
		img.style.minHeight = (100 * this.parallaxAmount) + '%';
		img.style.maxWidth = 'none';
		img.style.maxHeight = 'none';
		img.style.transform = 'translate(-50%, 0px)';

		return img;
	}

	calculateImgPosition () {
		let elDim = this.el.getBoundingClientRect();
		let percent = 0;

		// Calculate the % of image movement that should be applied
		if (elDim.top >= this.winDim.height) {
			percent = 0;
		}
		else if ((elDim.top + elDim.height) <= 0) {
			percent = 1;
		}
		else {
			let totalScrollDistance = this.winDim.height + elDim.height;
			let scrolledSoFar = totalScrollDistance - elDim.bottom;

			percent = scrolledSoFar / totalScrollDistance;
		}

		let imageExcess = elDim.height * this.parallaxAmount - elDim.height;
		let translateY = imageExcess * percent;

		return translateY;
	}

	getWindowDimensions () {
		// https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollY#Notes
	/*	var supportPageOffset = window.pageXOffset !== undefined;
		var isCSS1Compat = ((document.compatMode || '') === 'CSS1Compat');

		var x = supportPageOffset ? window.pageXOffset : isCSS1Compat ? document.documentElement.scrollLeft : document.body.scrollLeft;
		var y = supportPageOffset ? window.pageYOffset : isCSS1Compat ? document.documentElement.scrollTop : document.body.scrollTop;

		// http://stackoverflow.com/questions/5484578/how-to-get-document-height-and-width-without-using-jquery
		var w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth; */
		var h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

		return {
		/*	top: x,
			left: y,
			width: w, */
			height: h
		};
	}
}
