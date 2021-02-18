const webpack = require('webpack');
const path = require('path');
const app = require('./package.json');

// Add this plugin so that we can use baseUrl in tsconfig.json
// https://github.com/TypeStrong/ts-loader#baseurl--paths-module-resolution
const { TsconfigPathsPlugin } = require('tsconfig-paths-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

// Library configuration is based on
// https://webpack.js.org/configuration/output/ and
// https://marcobotto.com/blog/compiling-and-bundling-typescript-libraries-with-webpack/

// Can't do string interpolation in object keys
const entries = {}
entries[`${app.name}`] = './src/index.ts';
entries[`${app.name}.min`] = './src/index.ts';

const config = {
  entry: entries,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'umd',
    library: 'traceSearch',
    umdNamedDefine: true,
    globalObject: 'this',     // Support DOM and Node https://webpack.js.org/configuration/output/#outputglobalobject
  },
  module: {
    rules: [
      {
        test: /\.ts(x)?$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      },
    ]
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [
        '**/*',
        '!index.html'
      ]
    }),
    new webpack.DefinePlugin({
      __NAME__: JSON.stringify(app.name),
      __VERSION__: JSON.stringify(app.version),
      __DESCRIPTION__: JSON.stringify(app.description),
      __BUILT_AT__: JSON.stringify((new Date()).toJSON())
    })
  ],
  resolve: {
    extensions: [
      '.tsx',
      '.ts',
      '.js'
    ],
    plugins: [
      new TsconfigPathsPlugin({})
    ]
  }
};

module.exports = config;