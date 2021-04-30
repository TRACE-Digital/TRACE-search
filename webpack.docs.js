const path = require('path');

module.exports = {
  mode: 'none',
  entry: {
    'docs.html': './docs/index.html',
  },
  output: {},
  devServer: {
    static: path.resolve(__dirname, 'docs'),
    port: 8080,
  },
};
