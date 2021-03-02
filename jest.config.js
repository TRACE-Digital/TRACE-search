const webpackDefines = require('./webpack.defines');

const jestGlobals = JSON.parse(JSON.stringify(webpackDefines));
jestGlobals.__BUILD_TYPE__ = JSON.stringify('test');

// Jest doesn't require the same quoted format as Webpack define
for (const name of Object.keys(jestGlobals)) {
  jestGlobals[name] = JSON.parse(jestGlobals[name]);
}

module.exports = {
  globals: jestGlobals,
  moduleDirectories: ['node_modules', 'src'],
  testEnvironment: 'jsdom',
  transform: { '^.+\\.ts?$': 'ts-jest' },
  setupFilesAfterEnv: ['<rootDir>/src/tests/extensions.ts'],
  verbose: true,
};
