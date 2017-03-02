import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';

@inject(EventAggregator)
export class App {
	constructor (ea) {
		this.ea = ea;

		// Add loading class
		this.loadingSubscription = this.ea.subscribe('router:navigation:processing', event => {
			document.documentElement.classList.add('loading');
		});

		// Remove loading class
		this.navigationSubscription = this.ea.subscribe('router:navigation:success', event => {
			document.documentElement.classList.remove('loading');
		});
	}

	configureRouter (config, router) {
		config.title = 'AndreasLagerkvist.com';
		config.options.pushState = true;
		config.options.hashChange = false;
		config.options.root = '/';

		config.map([
			{
				route: [''],
				name: 'home',
				moduleId: 'resources/elements/front-page/front-page',
				title: '',
				// layoutView: 'resources/layouts/default.html'
			}
		]);
	}
}
