import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';
import {Http} from 'resources/services/http';

@inject(EventAggregator, Http)
export class App {
	constructor (ea, http) {
		this.ea = ea;
		this.http = http;

		// Add loading class
		this.loadingSubscription = this.ea.subscribe('router:navigation:processing', event => {
			document.documentElement.classList.add('loading');
		});

		// Remove loading class
		this.navigationSubscription = this.ea.subscribe('router:navigation:success', event => {
			document.documentElement.classList.remove('loading');
		});
	}

	attached () {
		// Random unsplash image
		let unsplashKey = '4d6fb906f11c473986d67a17526e0949ed4f6b084565793cd88dd4615167cc62';

		this.http.get('https://api.unsplash.com/photos/random?client_id=' + unsplashKey).then(data => {
			this.setBg(data);
		}).catch(error => {
			this.setBg({
				urls: {regular: 'scripts/assets/bg/bg.jpg'},
				user: {
					urls: {html: 'https://unsplash.com/@grakozy'},
					name: 'Greg Rakozy'
				}
			});
		});
	}

	setBg (data) {
		let style = document.createElement('style');

		style.type = 'text/css';
		style.innerHTML = '.text--cutout, body {background-image: url(' + data.urls.regular + ')}';

		document.getElementsByTagName('head')[0].appendChild(style);

		// Credit text
		let credit = document.createElement('p');

		credit.classList.add('photo-credit');
		credit.innerHTML = 'Photo by <a href="' + data.user.urls.html + '">' + data.user.name + '</a>';

		document.body.appendChild(credit);
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
