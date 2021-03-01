const webpackDefines = require('./webpack.defines');

const jestGlobals = JSON.parse(JSON.stringify(webpackDefines));
jestGlobals.__BUILD_TYPE__ = JSON.stringify('test');

module.exports = {
  globals: jestGlobals,
  moduleDirectories: ['node_modules', 'src'],
  testEnvironment: 'jsdom',
  transform: { '^.+\\.ts?$': 'ts-jest' },
};
