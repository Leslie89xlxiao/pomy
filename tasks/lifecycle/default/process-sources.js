'use strict';

var
  gulp = require('gulp'),
  bowerFiles = require('main-bower-files'),
  bowerNormalizer = require('gulp-bower-normalize'),
  dest = global.settings.dest;

gulp.task('process-sources', ['generate-sources'], function() {
  var root = global.getRootPath();
  var pomy = global.getPomyPath();

  var directory = pomy + 'bower_components';

  var bowerJson = pomy + 'bower.json';

  return gulp.src(bowerFiles({
      paths: {
        bowerDirectory: directory,
        bowerJson: bowerJson
      }
    }), {
      base: directory
    })
    .pipe(bowerNormalizer({
      bowerJson: bowerJson
    }))
    .pipe(gulp.dest(root + dest.lib));
});