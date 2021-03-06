const webpack = require('webpack');
const path = require('path');
const app = require('./package.json');
const webpackDefines = require('./webpack.defines');

// Add this plugin so that we can use baseUrl in tsconfig.json
// https://github.com/TypeStrong/ts-loader#baseurl--paths-module-resolution
const { TsconfigPathsPlugin } = require('tsconfig-paths-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

// Library configuration is based on
// https://webpack.js.org/configuration/output/ and
// https://marcobotto.com/blog/compiling-and-bundling-typescript-libraries-with-webpack/

// Can't do string interpolation in object keys
const entries = {};
entries[`${app.name}`] = './src/index.ts';
entries[`${app.name}.min`] = './src/index.ts';

const config = {
  entry: entries,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'umd',
    library: 'TraceSearch',
    umdNamedDefine: true,
    globalObject: 'this', // Support DOM and Node https://webpack.js.org/configuration/output/#outputglobalobject
  },
  module: {
    rules: [
      {
        test: /\.ts(x)?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*', '!index.html'],
    }),
    new webpack.DefinePlugin(webpackDefines),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    plugins: [new TsconfigPathsPlugin({})],
    fallback: { crypto: false },
  },
};

module.exports = config;
