import {inject} from 'aurelia-framework';
import {Http} from '../../services/http';

@inject(Http)
export class About {
	constructor (http) {
		this.http = http;
	}

	attached () {
		this.http.get('https://api.github.com/users/powerbuoy').then(user => {
			this.user = user;
		});
	}
}
