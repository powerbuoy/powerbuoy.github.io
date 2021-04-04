import {inject} from 'aurelia-framework';
import {HttpClient} from 'aurelia-fetch-client';

@inject(HttpClient)
export class About {
	constructor (http) {
		this.http = http;
		this.githubKey = 'client_id=7ca1827862d2dbc419f2&client_secret=eafbe0962b56d9ad1ab7495a03c71e797ce31638';
	}

	attached () {
		this.http.fetch('https://api.github.com/users/powerbuoy?' + this.githubKey, {method: 'get'}).then(response => {
			return response.json();
		}).then(user => {
			this.user = user;
		}).catch(error => {
			// ...
		});
	}
}
