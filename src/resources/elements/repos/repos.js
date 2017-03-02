import {inject} from 'aurelia-framework';
import {Http} from '../../services/http';

@inject(Http)
export class Repos {
	constructor (http) {
		this.http = http;
	}

	attached () {
		let ignore = ['fun', 'powerbuoy.github.io', 'SleekHTMLWidget'];

		// https://api.github.com/repos/powerbuoy/sleek/contents/README.md?ref=master
		this.http.get('https://api.github.com/users/powerbuoy/repos').then(data => {
			let repos = [];

			data.forEach(i => {
				if (ignore.indexOf(i.name) === -1) {
					repos.push(i);
				}
			});

			this.repos = repos;

			console.dir(repos);
		});
	}
}
