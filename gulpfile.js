var gulp = require('gulp');
var plumber = require('gulp-plumber');
var rename = require('gulp-rename');
var concat = require('gulp-concat-util');
var jscs = require('gulp-jscs');
var uglify = require('gulp-uglify');
var webserver = require('gulp-webserver');

gulp.task('scripts', function() {
  gulp.src('assets/**/*')
    .pipe(gulp.dest('app/'));
  return gulp.src(['js/utils.js', 'js/**/*.js'])
    .pipe(plumber({
      errorHandler: function(error) {
        console.log(error.message);
      }}))
    .pipe(jscs())
    .pipe(jscs.reporter())
    .pipe(concat('lib.js'))
    .pipe(concat.header('(function(win, con, storage) {'))
    .pipe(concat.footer('})(window, console, localStorage);'))
    .pipe(gulp.dest('app/'))
    .pipe(gulp.dest('dist/'))
    .pipe(rename({suffix: '.min'}))
    .pipe(uglify())
    .pipe(gulp.dest('dist/'));
});

gulp.task('webserver', function() {
  gulp.src('app')
    .pipe(webserver({
      directoryListing: false,
      open: true,
      fallback: 'app/index.html'
    }));
});

gulp.task('default', ['scripts', 'webserver'], function() {
  gulp.watch('js/**/*.js', ['scripts']);
});
