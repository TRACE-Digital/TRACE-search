import { isBrowser, isNode } from 'browser-or-node';

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

export const perfLog = BUILD_TYPE === 'dev';

declare global {
  interface Window {
    __TRACE_EXTENSION_HOOK__: {
      getVersion: () => { major: string; minor: string; rev: string };
      getVersionStr: () => string;
    };
  }
}

// Minimum version of the TRACE browser extension that we are compatible with
export const EXTENSION_MIN_VERSION = '0.0.1';
export let EXTENSION_VERSION: string;
export const checkExtensionVersion = () => {
  EXTENSION_VERSION = window?.__TRACE_EXTENSION_HOOK__?.getVersionStr();

  // Don't need the extension in Node
  if (!isNode) {
    if (EXTENSION_VERSION && EXTENSION_VERSION >= EXTENSION_MIN_VERSION) {
      console.log(`Detected compatible TRACE browser extension v${EXTENSION_VERSION}`);
    } else if (EXTENSION_VERSION) {
      console.warn(
        `Extension version ${EXTENSION_VERSION} is below minimum supported version ${EXTENSION_MIN_VERSION}`,
      );
    } else {
      console.warn('TRACE browser extension is not installed. Some features may not work!');
    }
  }
};

checkExtensionVersion();
