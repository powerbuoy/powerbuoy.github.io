import gulp from 'gulp';
import globby from 'globby';
import rename from 'gulp-rename';
import svgstore from 'gulp-svgstore';
import svgmin from 'gulp-svgmin';
import path from 'path';
import project from '../aurelia.json';

export function svgMin () {
	return gulp.src(project.paths.assets + '**/*.svg')
	   .pipe(svgmin(function (file) {
		   var prefix = 'svg-' + path.basename(file.relative, path.extname(file.relative));

		   return {
				plugins: [{
					cleanupIDs: {
						prefix: prefix + '-',
						minify: true
					}
				}]
			};
		}))
		.pipe(gulp.dest(project.paths.output + 'assets/'));
}

export function svgStore () {
	return gulp.src(project.paths.assets + '**/*.svg')
		.pipe(svgmin(function (file) {
			var prefix = 'svg-' + path.basename(file.relative, path.extname(file.relative));

			return {
				plugins: [{
					cleanupIDs: {
						prefix: prefix + '-',
						minify: true
					}
				}]
			};
		}))
		.pipe(svgstore())
		.pipe(rename('svg-defs.svg'))
		.pipe(gulp.dest(project.paths.output + 'assets/'));
}

// TODO: This needs to return something else in order for it to work with the build...
export function svgCSS () {
	var css = '';

	globby.sync(project.paths.output + '**/*.svg').forEach(function (file) {
		var basename = path.basename(file);
		var className = 'svg-' + basename.substr(0, basename.length - path.extname(file).length);
		var paths = file.split('/');

		paths.shift();

		css += '.' + className + ':before {background-image: url(' + paths.join('/') + ')}\n';
	});

	return require('fs').writeFileSync(project.paths.sass + 'svg.scss', css);
}
