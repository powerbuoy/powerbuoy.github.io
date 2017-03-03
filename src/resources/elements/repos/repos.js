import {inject} from 'aurelia-framework';
import {HttpClient} from 'aurelia-fetch-client';

@inject(HttpClient)
export class Repos {
	constructor (http) {
		this.http = http;
		this.githubKey = 'client_id=7ca1827862d2dbc419f2&client_secret=eafbe0962b56d9ad1ab7495a03c71e797ce31638';
	}

	attached () {
		this.http.fetch('https://api.github.com/users/powerbuoy/repos?' + this.githubKey, {method: 'get'}).then(response => {
			return response.json();
		}).then(repos => {
			// Ignore some repos
			let ignore = ['fun', 'powerbuoy.github.io', 'SleekHTMLWidget'];

			repos = repos.filter(repo => ignore.indexOf(repo.name) === -1);

			// Fetch README files
			repos.forEach(repo => {
				this.http.fetch(
					'https://api.github.com/repos/powerbuoy/' + repo.name + '/contents/README.md?ref=master&' + this.githubKey,
					{method: 'get', headers: {Accept: 'application/vnd.github.raw'}}
				).then(data => {
					return data.text();
				}).then(readme => {
					repo.readme = readme;
				});
			});

			this.repos = repos;
		}).catch(error => {
			// ...
		});
	}
}
