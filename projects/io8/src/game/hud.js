/*
	Anything in the page with a data-stat attribute is a HUD item the game can update by name, e.g.

		<label data-stat="fuel">Fuel <meter></meter></label>

	The game only calls set('fuel', 0.5), it never touches the page itself. The level (0-1) goes into the
	<meter> or <progress> inside (or the element itself if it is one), mapped onto its own min-max.
	null hides the whole item (e.g. a power-up that isn't running).

	An element with data-val inside is text to fill in with a value, %s marks where it goes:

		<label data-stat="speed">Super speed <span data-val>(%s seconds)</span> <meter></meter></label>

		set('speed', 0.5, 5) → "Super speed (5 seconds)"
*/
export default class Hud {
	constructor (root = document) {
		this.stats = new Map([...root.querySelectorAll('[data-stat]')].map(item => {
			const val = item.querySelector('[data-val]');

			return [item.dataset.stat, {
				item,
				meter: item.matches('meter, progress') ? item : item.querySelector('meter, progress'),
				val,
				template: val?.textContent
			}];
		}));
		this.last = new Map();
	}

	set (name, level, value = null) {
		const stat = this.stats.get(name);

		// Only touch the page when it actually changes (it's called every frame)
		if (!stat || this.last.get(name) === `${level} ${value}`) {
			return;
		}

		this.last.set(name, `${level} ${value}`);
		stat.item.hidden = level === null;

		if (stat.val && value !== null) {
			stat.val.textContent = stat.template.replace('%s', value);
		}

		if (level !== null && stat.meter) {
			const min = Number(stat.meter.min || 0);
			const max = Number(stat.meter.max || 1);

			stat.meter.value = min + level * (max - min);
		}
	}
}
