// Base karma configuration
module.exports = function karmaConfig (karma) {
  'use strict';
  var config = getConfig();

  if (process.env.CI) {
    var customLaunchers = getCustomLaunchers();
    config.sauceLabs = {testName: 'Promissory Arbiter Browser Support'};
    config.reporters.push('saucelabs');
    config.customLaunchers = customLaunchers;
    config.browsers = config.browsers.concat(Object.keys(customLaunchers));
    config.coverageReporter.type = 'lcov';
  }

  karma.set(config);

  function getConfig() {
    return {
      basePath: '',

      port: 9876,
      colors: true,
      logLevel: karma.LOG_INFO,

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
    };
  }

  function getCustomLaunchers() {
    var launchers = {
      sl_ie8: {
        browserName: 'internet explorer', platform: 'Windows XP', version: '8.0'
      },
      sl_safari_windows: {
        browserName: 'safari', platform: 'Windows 7', version: '5.1'
      },
      sl_firefox_legacy: {
        browserName: 'firefox', platform: 'Windows XP', version: '4.0'
      },
      sl_chrome_legacy: {
        browserName: 'chrome', platform: 'Windows 7', version: '26'
      },
      sl_edge: {
        browserName: 'microsoftedge', platform: 'Windows 10', version: '20.10240'
      },
      sl_capitan: {
        browserName: 'safari', platform: 'OS X 10.11', version: '8.1'
      },
      sl_firefox: {
        browserName: 'firefox', platform: 'Linux', version: '41'
      },
      sl_chrome: {
        browserName: 'chrome', platform: 'Windows 8', version: '45'
      },
    };

    Object.keys(launchers).forEach(function(key) {
      launchers[key].base = 'SauceLabs';
    });

    return launchers;
  }
}

