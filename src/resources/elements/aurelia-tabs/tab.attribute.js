import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';

@inject(Element, EventAggregator)
export class TabCustomAttribute {
	constructor (el, ea) {
		this.el = el;
		this.ea = ea;

		this.onClick = e => {
			this.ea.publish('tab:open', this.el.getAttribute('tab'));
		};
	}

	attached () {
		this.el.addEventListener('click', this.onClick);
	}

	detached () {
		this.el.removeEventListener('click', this.onClick);
	}
}
