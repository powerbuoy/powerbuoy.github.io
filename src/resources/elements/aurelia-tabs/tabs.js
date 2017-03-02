import {inject, bindable, inlineView} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';
import velocity from 'velocity-animate';

@inlineView('<template><slot></slot></template>')
@inject(Element, EventAggregator)
export class Tabs {
	@bindable active = false;

	constructor (el, ea) {
		this.el = el;
		this.ea = ea;

		this.onResize = e => {
			this.setActiveTab(this.active);
		};
	}

	attached () {
		// Switch to potentially manually set active tab
		if (this.active) {
			let target = this.el.querySelector('#' + this.active);

			if (target) {
				velocity(target, 'scroll', {
					duration: 0,
					container: this.el,
					axis: 'x'
				});
			}
		}

		// Listen to outside requests to activate a tab
		this.tabOpenSubscription = this.ea.subscribe('tab:open', tabName => {
			this.setActiveTab(tabName);
		});

		// Re-position tab on resize
		window.addEventListener('resize', this.onResize);
	}

	detached () {
		this.tabOpenSubscription.dispose();
		window.removeEventListener('resize', this.onResize);
	}

	setActiveTab (name) {
		let target = this.el.querySelector('#' + name);

		if (target) {
			this.active = name;

			velocity(target, 'scroll', {
				duration: 200,
				container: this.el,
				axis: 'x'
			});
		}
	}
}
