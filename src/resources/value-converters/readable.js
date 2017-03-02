export class ReadableValueConverter {
	toView (value) {
		value = value.replace(/\-/g, ' ');
		value = value.replace(/\b\w/g, str => {
			return this.capitalize(str);
		});
		value = value.replace(/(CSS|JS|WP)/ig, str => str.toUpperCase());

		return this.capitalize(value.replace(/\-/, ' '));
	}

	capitalize (str) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}
