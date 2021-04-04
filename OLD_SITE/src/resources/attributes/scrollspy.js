import {inject} from 'aurelia-framework';

@inject(Element)
export class ScrollspyCustomAttribute {
	constructor (el) {
		this.el = el;
		this.offset = 200;

		this.onScroll = e => {
			window.requestAnimationFrame(() => {
				this.spy();
			});
		};
	}

	attached () {
		window.addEventListener('scroll', this.onScroll);

		this.spy();
	}

	detached () {
		window.removeEventListener('scroll', this.onScroll);
	}

	// https://github.com/makotot/scrollspy/blob/master/src/js/modules/scrollspy.js
	isInView () {
		var winH = window.innerHeight,
			scrollTop = document.documentElement.scrollTop || document.body.scrollTop,
			scrollBottom = scrollTop + winH,
			rect = this.el.getBoundingClientRect(),
			elTop = rect.top + scrollTop,
			elBottom = elTop + this.el.offsetHeight;

		return ((elTop + this.offset) < scrollBottom) && (elBottom > scrollTop);
	}

	spy () {
		if (this.isInView()) {
			this.el.classList.add('in-view');
			this.el.classList.add('was-in-view');
		}
		else {
			this.el.classList.remove('in-view');
		}
	}
}
