const webpack = require('webpack');
const common = require('./webpack.common.js');
const { merge } = require('webpack-merge');
const path = require('path');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  optimization: {
    minimize: false
  },
  plugins: [
    new webpack.DefinePlugin({
      __BUILD_TYPE__: JSON.stringify('dev'),
    }),
  ],
  devServer: {
    contentBase: path.resolve(__dirname, 'dist'),
    port: 8000,
  }
});