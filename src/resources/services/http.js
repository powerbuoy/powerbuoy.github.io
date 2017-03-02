import {inject} from 'aurelia-framework';
import {HttpClient} from 'aurelia-fetch-client';

@inject(HttpClient)
export class Http {
	constructor (http) {
		this.http = http;
		this.baseUrl = 'http://ment.ioioio.se/api/';
	}

	/**
	 * Wrapper for GET calls
	 */
	get (url, data) {
		// TODO: Support for data (use serialize() below)

		let config = {
			method: 'get',
			credentials: 'include',
			Accept: 'application/json'
		};

		return this.http.fetch(this.baseUrl + url, config)
			.then(response => {
				return response.json();
			})
			.then(json => {
				return json.data;
			});
	}

	/**
	 * Wrapper for POST calls
	 */
	post (url, data) {
		let config = {
			method: 'post',
			credentials : 'include',
			Accept: 'application/json'
		};

		// If no body is specified, stringify the data object
		if (data && !data.body) {
			config.body = JSON.stringify(data);
		}
		// A body is specifically specified, pass it in raw
		else if (data && data.body) {
			config.body = data.body;
		}

		return this.http.fetch(this.baseUrl + url, config)
			.then(response => {
				return response.json();
			})
			.then(json => {
				return json.data;
			});
	}

	/**
	 * Serialize JSON to querys tring
	 * (This was taken from SO but can't find the URL now)
	 * TODO: Is this really the best way to do this??
	 */
	serialize (obj, prefix) {
		var str = [];

		for (var p in obj) {
			if (obj.hasOwnProperty(p)) {
				var k = prefix ? prefix + '[' + (Array.isArray(obj) ? '' : p) + ']' : p, v = obj[p];

				str.push(typeof v == 'object' ? this.serialize(v, k) : encodeURIComponent(k) + '=' + encodeURIComponent(v));
			}
		}

		return str.join('&');
	}
}
