// Base karma configuration
module.exports = function karmaConfig (karma) {
  'use strict';
  var config = getConfig();

  if (process.env.CI) {
    var customLaunchers = getCustomLaunchers();
    config.concurrency = 5;
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
      sl_ie9: {
        browserName: 'internet explorer', platform: 'Windows 7', version: '9.0'
      },
      sl_ie10: {
        browserName: 'internet explorer', platform: 'Windows 8', version: '10.0'
      },
      sl_ie11: {
        browserName: 'internet explorer', platform: 'Windows 8.1', version: '11.0'
      },
      sl_edge: {
        browserName: 'microsoftedge', platform: 'Windows 10', version: '20.10240'
      },
      sl_safari_windows: {
        browserName: 'safari', platform: 'Windows 7', version: '5.1'
      },
      sl_mountain_lion: {
        browserName: 'safari', platform: 'OS X 10.8', version: '6'
      },
      sl_mavericks: {
        browserName: 'safari', platform: 'OS X 10.9', version: '7'
      },
      sl_yosemite: {
        browserName: 'safari', platform: 'OS X 10.10', version: '8'
      },
      sl_capitan: {
        browserName: 'safari', platform: 'OS X 10.11', version: '9'
      },
      sl_firefox_legacy: {
        browserName: 'firefox', platform: 'Windows XP', version: '4.0'
      },
      sl_firefox_prev: {
        browserName: 'firefox', platform: 'Linux', version: '44'
      },
      sl_firefox_curr: {
        browserName: 'firefox', platform: 'Linux', version: '45'
      },
      // sl_firefox_beta: {
      //   browserName: 'firefox', platform: 'Linux', version: 'beta'
      // },
      // sl_firefox_dev: {
      //   browserName: 'firefox', platform: 'Linux', version: 'dev'
      // },
      sl_chrome_legacy: {
        browserName: 'chrome', platform: 'Windows 7', version: '26'
      },
      sl_chrome_prev: {
        browserName: 'chrome', platform: 'Windows 10', version: '52'
      },
      sl_chrome_curr: {
        browserName: 'chrome', platform: 'Windows 10', version: '53'
      },
      // sl_chrome_beta: {
      //   browserName: 'chrome', platform: 'Linux', version: 'beta'
      // },
      // sl_chrome_dev: {
      //   browserName: 'chrome', platform: 'OS X 10.11', version: 'dev'
      // },
    };

    Object.keys(launchers).forEach(function(key) {
      launchers[key].base = 'SauceLabs';
    });

    return launchers;
  }
}

