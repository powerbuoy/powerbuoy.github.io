import {inject} from 'aurelia-framework';
import velocity from 'velocity-animate';

@inject(Element)
export class SmoothScrollCustomAttribute {
	constructor (el) {
		this.el = el;

		this.onClick = e => {
			e.preventDefault();
			this.scroll();
		};
	}

	attached () {
		this.el.addEventListener('click', this.onClick);
		this.target = document.getElementById(this.el.getAttribute('href').substr(1));
	}

	detached () {
		this.el.removeEventListener('click', this.onClick);
	}

	scroll () {
		velocity(this.target, 'scroll', {
			duration: 800,
			offset: -100
		});
	}
}
