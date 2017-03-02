import gulp from 'gulp';
import transpile from './transpile';
import copyAssets from './copy-assets';
import {downloadIcons, rewriteIconCSS, generateIconVars} from './process-icons';
import {svgMin, svgStore, svgCSS} from './process-svg';
import processMarkup from './process-markup';
import processCSS from './process-css';
import {build} from 'aurelia-cli';
import project from '../aurelia.json';

export default gulp.series(
	readProjectConfiguration,

	copyAssets,

	downloadIcons,
	rewriteIconCSS,
	generateIconVars,

	svgMin,
	svgStore,
	// svgCSS,

	gulp.parallel(
		transpile,
		processMarkup,
		processCSS
	),

	writeBundles
);

function readProjectConfiguration() {
	return build.src(project);
}

function writeBundles() {
	return build.dest();
}
