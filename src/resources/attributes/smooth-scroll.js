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

		// Find the target element
		this.target = document.getElementById(this.el.getAttribute('href').substr(1));

		// Find the scroll parent of the target element
		this.scrollParent = this.findScrollableParent(this.target);
		this.scrollParent = this.scrollParent == document.documentElement ? false : this.scrollParent;
	}

	detached () {
		this.el.removeEventListener('click', this.onClick);
	}

	scroll () {
		velocity(this.target, 'scroll', {
			duration: 800,
			container: this.scrollParent
		});
	}

	findScrollableParent (node) {
		if (node === null) {
			return null;
		}

		if ((node.scrollHeight - 10) > node.clientHeight) {
			return node;
		}
		else {
			return this.findScrollableParent(node.parentNode);
		}
	}
}
