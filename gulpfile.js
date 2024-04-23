//This is where we write all our configuration for gulp

// Initialize modules
// In this section, we are importing all the npm packages that we just installed as modules into this file so we can access them and any functions they give us
const { src, dest, watch, series } = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const babel = require('gulp-babel');
const terser = require('gulp-terser');
const browsersync = require('browser-sync').create();

// Use dart-sass for @use ... setting the sass compiler to use dart-sass, for new syntax
//sass.compiler = require('dart-sass');

//Next, we have to compile our sass and js files
// Sass Task
function scssTask() {
  return src('./app/scss/styles.scss', { sourcemaps: true }) //takes the main sass file and does stuff to this file
    .pipe(sass())
    .pipe(postcss([autoprefixer(), cssnano()]))
    .pipe(dest('dist', { sourcemaps: '.' }));
}
// JavaScript Task
function jsTask() {
  return src('./app/js/script.js', { sourcemaps: true })
    .pipe(babel({ presets: ['@babel/preset-env'] }))
    .pipe(terser())
    .pipe(dest('dist', { sourcemaps: '.' }));
}

// Browsersync
function browserSyncServe(cb) {
  browsersync.init({
    server: {
      baseDir: '.',
    },
    notify: {
      styles: {
        top: 'auto',
        bottom: '0',
      },
    },
  });
  cb();
}
function browserSyncReload(cb) {
  browsersync.reload();
  cb();
}

// Watch Task
function watchTask() {
  watch('*.html', browserSyncReload);
  watch(
    ['./app/scss/**/*.scss', './app/**/*.js'],
    series(scssTask, jsTask, browserSyncReload)
  );
}

// Default Gulp Task
exports.default = series(scssTask, jsTask, browserSyncServe, watchTask);

// Build Gulp Task
//exports.build = series(scssTask, jsTask);