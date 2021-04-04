import gulp from 'gulp';
import sourcemaps from 'gulp-sourcemaps';
import sass from 'gulp-sass';
import sassGlob from 'gulp-sass-glob';
import project from '../aurelia.json';
import {build} from 'aurelia-cli';
import autoprefixer from 'gulp-autoprefixer';

export default function processCSS () {
	return gulp.src(project.cssProcessor.source)
		.pipe(sourcemaps.init())
		.pipe(sassGlob())
		.pipe(sass().on('error', sass.logError))
		.pipe(autoprefixer())
		.pipe(build.bundle());
}
