import * as sherlock from './sherlock.json';
import * as trace from './trace.json';

interface SherlockSite {
  errorMsg?: string | string[];
  errorType: string;
  regexCheck?: string;
  url: string;
  urlMain: string;
  username_claimed: string;
  username_unclaimed: string;
}

interface SherlockSiteList {
  [key: string]: SherlockSite;
}

interface TraceSite {
  logoUrl: string;
  prettyUrl: string;
}

interface TraceSiteList {
  [key: string]: TraceSite;
}

export interface Site extends SherlockSite, TraceSite {
  name: string;
}

export interface SiteList {
  [key: string]: Site;
}

// Copy Sherlock as the base
const mergedSites = JSON.parse(JSON.stringify(sherlock));
export const sherlockSites: SherlockSiteList = sherlock;
export const traceSites: TraceSiteList = trace;

// Overlay the TRACE changes
for (const siteName of Object.keys(trace)) {
  mergedSites[siteName] = Object.assign({}, mergedSites[siteName], traceSites[siteName]);
}

export const supportedSites: SiteList = {};
export const unsupportedSites: SiteList = {};

// Store the name inside as well so we don't have to pass it separately
for (const siteName of Object.keys(mergedSites)) {
  mergedSites[siteName].name = siteName;

  if (mergedSites[siteName].urlMain) {
    const url = new URL(mergedSites[siteName].urlMain);
    mergedSites[siteName].prettyUrl = url.hostname;
  }

  if (mergedSites[siteName].omit) {
    unsupportedSites[siteName] = mergedSites[siteName];
  } else {
    supportedSites[siteName] = mergedSites[siteName];
  }
}

// TODO: Not really sure how this gets here, but it's a nested copy of
// everything. Might need to check hasOwnProperty() or something
// tslint:disable-next-line:no-string-literal
delete mergedSites['default'];
// tslint:disable-next-line:no-string-literal
delete supportedSites['default'];
// tslint:disable-next-line:no-string-literal
delete unsupportedSites['default'];

/**
 * Contains all sites, including unsupported ones.
 */
export const allSites = mergedSites as SiteList;
