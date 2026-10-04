/*
	Makes assets/stars.json from the Yale Bright Star Catalog (5th edition, every star you can see with the
	naked eye, http://tdc-www.harvard.edu/catalogs/bsc5.html). Only needs running again to change what's kept:

		node scripts/stars.mjs

	Each star is 4 numbers in one flat array: right ascension (hours), declination (degrees), magnitude
	(smaller is brighter) and B-V colour index (bluer below 0, redder above), see Stars
*/
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const SOURCE = 'http://tdc-www.harvard.edu/catalogs/bsc5.dat.gz';
const OUTPUT = path.join(import.meta.dirname, '../assets/stars.json');

const response = await fetch(SOURCE);
const text = zlib.gunzipSync(Buffer.from(await response.arrayBuffer())).toString('latin1');

// Fixed width columns (1-based in the catalog's readme, J2000 positions)
const field = (line, from, to) => line.slice(from - 1, to).trim();
const stars = [];

text.split('\n').forEach(line => {
	const ra = field(line, 76, 83);
	const mag = field(line, 103, 107);

	// A few entries (novae, things that turned out not to be stars) have no position
	if (!ra || !mag) {
		return;
	}

	const hours = +field(line, 76, 77) + field(line, 78, 79) / 60 + field(line, 80, 83) / 3600;
	const degrees = (+field(line, 85, 86) + field(line, 87, 88) / 60 + field(line, 89, 90) / 3600) * (field(line, 84, 84) === '-' ? -1 : 1);
	const bv = field(line, 110, 114);

	stars.push(+hours.toFixed(4), +degrees.toFixed(3), +mag, bv ? +bv : 0);
});

await fs.writeFile(OUTPUT, JSON.stringify(stars));

console.log(`${stars.length / 4} stars -> ${path.relative(process.cwd(), OUTPUT)}, ${Math.round(JSON.stringify(stars).length / 1024)} KB`);
