// Small helpers shared by the game

// A random item of a list
export function randomItem (list) {
	return list[Math.floor(Math.random() * list.length)];
}

// A random item of a list where weightOf(item) is how likely each one is compared to the others (2 is twice as
// likely as 1)
export function pickWeighted (list, weightOf) {
	let roll = Math.random() * list.reduce((sum, item) => sum + weightOf(item), 0);

	// The last one if rounding leaves a sliver of the roll over
	return list.find(item => (roll -= weightOf(item)) < 0) ?? list.at(-1);
}

// A meter (fuel, ammo, health) that comes back by itself: once `since` (seconds since it was last used up) is
// past refillDelay, it goes from empty to full (capacity) in refillTime seconds. Never without a refillTime
export function refill (value, since, {capacity, refillDelay, refillTime}, deltaTime) {
	return refillTime && since > refillDelay ? Math.min(capacity, value + capacity / refillTime * deltaTime) : value;
}
