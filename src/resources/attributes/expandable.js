import {inject} from 'aurelia-framework';
import imagesloaded from 'imagesloaded';
import velocity from 'velocity-animate';

@inject(Element)
export class ExpandTriggerCustomAttribute {
	constructor (el) {
		this.el = el;
		this.isOpen = false;

		this.onResize = e => {
			this.getTargetDim();
		};
		this.onClick = e => {
			e.preventDefault();

			if (this.isOpen) {
				this.close();
			}
			else {
				this.open();
			}
		};
	}

	attached () {
		this.target = document.getElementById(this.el.getAttribute('href').substr(1));

		// Wait for images to load
		imagesloaded(this.target, () => {
			this.getTargetDim();
		});

		// Hook up events
		this.el.addEventListener('click', this.onClick);
		window.addEventListener('resize', this.onResize);
	}

	detached () {
		this.el.removeEventListener('click', this.onClick);
		window.removeEventListener('resize', this.onResize);
	}

	getTargetDim () {
	//	this.target.style.maxHeight = 'none';
		this.targetDim = {height: this.target.scrollHeight}; // this.target.getBoundingClientRect() doesn't work in iOS (height is 0... not sure why, I tried setTimeout to wait for the animation to complete)

		if (this.isOpen) {
			this.target.style.maxHeight = this.targetDim.height + 'px';
		}
		else {
			this.target.style.maxHeight = '0';
		}
	}

	open () {
		this.target.style.maxHeight = this.targetDim.height + 'px';
		this.isOpen = true;
		this.el.classList.add('open');

		velocity(this.target, 'scroll', {
			duration: 800
		});
	}

	close () {
		this.target.style.maxHeight = '0';
		this.isOpen = false;
		this.el.classList.remove('open');

		velocity(this.el, 'scroll', {
			duration: 800
		});
	}
}
