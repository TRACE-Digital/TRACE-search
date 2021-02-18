const webpack = require('webpack');
const path = require('path');

// Add this plugin so that we can use baseUrl in tsconfig.json
// https://github.com/TypeStrong/ts-loader#baseurl--paths-module-resolution
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const config = {
  entry: './src/index.ts',
  mode: 'development',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.ts(x)?$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [
      '.tsx',
      '.ts',
      '.js'
    ],
    plugins: [new TsconfigPathsPlugin({})]
  },
  devServer: {
    contentBase: path.resolve(__dirname, 'dist'),
    compress: false,
    port: 8000,
  }
};

module.exports = config;