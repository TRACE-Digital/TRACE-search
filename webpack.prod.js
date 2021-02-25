const webpack = require('webpack');
const common = require('./webpack.common.js');
const { merge } = require('webpack-merge');

module.exports = merge(common, {
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimize: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      __BUILD_TYPE__: JSON.stringify('prod'),
    }),
  ],
});
