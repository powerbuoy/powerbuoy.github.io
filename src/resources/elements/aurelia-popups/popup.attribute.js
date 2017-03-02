import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';

@inject(Element, EventAggregator)
export class PopupCustomAttribute {
	constructor (el, ea) {
		this.el = el;
		this.ea = ea;

		this.onClick = e => {
			this.ea.publish('popup:open', this.el.getAttribute('popup'));
		};
	}

	attached () {
		this.el.addEventListener('click', this.onClick);
	}

	detached () {
		this.el.removeEventListener('click', this.onClick);
	}
}
