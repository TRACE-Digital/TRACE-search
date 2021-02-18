import app from '../package.json';

// https://stackoverflow.com/questions/9153571/is-there-a-way-to-get-version-from-package-json-in-nodejs-code#comment55397717_10855054
// TODO: Security concern since this possibly exposes all of package.json
// I don't know that this is dangerous for us, but we could move to Webpack DefinePlugin

export const NAME = app.name;
export const VERSION = app.version;
export const DESCRIPTION = app.description;

// Minimum version of the TRACE browser extension that we are compatible with
export const EXTENSION_MIN_VERSION = '0.0.0';
