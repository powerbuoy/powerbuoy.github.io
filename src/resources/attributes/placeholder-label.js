import {inject} from 'aurelia-framework';

@inject(Element)
export class PlaceholderLabelCustomAttribute {
	constructor (el) {
		this.el = el;

		this.onChange = e => {
			if (this.input.value || document.activeElement == this.input) {
				this.el.classList.add('active');
			}
			else {
				this.el.classList.remove('active');
			}
		};
		this.onFocus = e => {
			this.el.classList.add('active');
		};
	}

	attached () {
		this.input = this.el.getElementsByTagName('input');
		this.input = this.input ? this.input[0] : false;

		if (!this.input) {
			this.input = this.el.getElementsByTagName('textarea');
			this.input = this.input ? this.input[0] : false;
		}

		if (this.input.value) {
			this.el.classList.add('active');
		}

		this.input.addEventListener('input', this.onChange);
		this.input.addEventListener('focus', this.onFocus);
		this.input.addEventListener('blur', this.onChange);
	}

	detached () {
		this.input.removeEventListener('input', this.onChange);
		this.input.removeEventListener('focus', this.onFocus);
		this.input.removeEventListener('blur', this.onChange);
	}
}
