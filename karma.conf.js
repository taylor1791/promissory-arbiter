// Karma configuration

module.exports = function karmaConfig (config) {
  'use strict';

  config.set({

    basePath: '',

    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,

    autoWatch: true,
    singleRun: false,
    frameworks: ['jasmine'],
    browsers: ['PhantomJS'],
    reporters: ['progress', 'coverage'],

    files: [
      'node_modules/es6-promise/dist/es6-promise.js',
      'src/**/*.js'
    ],
    exclude: [],

    preprocessors: {
      'src/*.js': ['coverage']
    },

    coverageReporter: {
      type: 'html',
      dir: 'docs/coverage'
    }

  });
};
