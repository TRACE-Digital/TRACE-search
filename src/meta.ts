// Make Typescript happy about variables defined by the Webpack DefinePlugin
declare var __NAME__: string;
declare var __VERSION__: string;
declare var __DESCRIPTION__: string;
declare var __BUILD_TYPE__: string;
declare var __BUILT_AT__: string;

export const NAME = __NAME__;
export const VERSION = __VERSION__;
export const DESCRIPTION = __DESCRIPTION__;
export const BUILD_TYPE = __BUILD_TYPE__;
export const BUILT_AT = __BUILT_AT__;

// Minimum version of the TRACE browser extension that we are compatible with
export const EXTENSION_MIN_VERSION = '0.0.0';
