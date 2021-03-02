const app = require('./package.json');

// Export these so Webpack and Jest can use them
const webpackDefines = {
  __NAME__: JSON.stringify(app.name),
  __VERSION__: JSON.stringify(app.version),
  __DESCRIPTION__: JSON.stringify(app.description),
  __BUILT_AT__: JSON.stringify(new Date().toJSON()),
};

module.exports = webpackDefines;
