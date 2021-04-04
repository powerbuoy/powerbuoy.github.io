import gulp from 'gulp';
import project from '../aurelia.json';

export default function copyAssets () {
	return gulp.src([project.paths.assets + '**/*', '!' + project.paths.assets + '**/*.svg'])
		.pipe(gulp.dest(project.paths.output + 'assets'));
}
