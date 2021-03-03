import * as sherlock from './sherlock.json';
import * as trace from './trace.json';

interface SherlockSite {
  errorType: string,            // status_code, message, or response_url
  url: string,                  // url for website profile page
  urlMain: string,              // url for website home page
  username_claimed: string,     // username that is claimed on the website
  username_unclaimed: string,   // username that is not claimed on the website
  errorMsg?: string | string[], // if errorType = message, this message will pop up if the profile doesn't exist
  regexCheck?: string,          // regex for valid usernames on the website
  errorUrl?: string,            // if errorType = response_url, this is the url that the use will be redirected to if the profile doesn't exist
  urlProbe?: string,            // alternate profile page test url for sites where profiles aren't publicly facing
  noPeriod?: string,            // ???
  headers?: {},                 // headers to send with the request if needed
  request_head_only?: boolean   // for status_code errorType website -- use a GET request instead of a HEAD request
}

interface SherlockSiteList {
  [key: string]: SherlockSite;
}

interface TraceSite {
  errorType?: string,           // status_code, message, or response_url
  url?: string,                 // url for website profile page
  urlMain?: string,             // url for website home page
  username_claimed?: string,    // username that is claimed on the website
  username_unclaimed?: string,  // username that is not claimed on the website
  errorMsg?: string | string[], // if errorType = message, this message will pop up if the profile doesn't exist
  regexCheck?: string,          // regex for valid usernames on the website
  errorUrl?: string,            // if errorType = response_url, this is the url that the use will be redirected to if the profile doesn't exist
  urlProbe?: string,            // alternate profile page test url for sites where profiles aren't publicly facing
  noPeriod?: string,            // ???
  headers?: {},                 // headers to send with the request if needed
  request_head_only?: boolean   // for status_code errorType website -- use a GET request instead of a HEAD request
  logoClass?: string;           // FontAwesome CSS class for the logo (for use in frontend)
  omit?: boolean                // tells program to not process the site
}

interface TraceSiteList {
  [key: string]: TraceSite;
}

export type MergedSites = SherlockSite & TraceSite
export interface Site extends MergedSites {
  name: string;
  tags: string[];
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

const tagSet: { [tagName: string]: boolean } = {};
export const supportedSites: SiteList = {};
export const unsupportedSites: SiteList = {};

// Store the name inside as well so we don't have to pass it separately
for (const siteName of Object.keys(mergedSites)) {
  mergedSites[siteName].name = siteName;

  mergedSites[siteName].logoClass = mergedSites[siteName].logoClass || "fa-question-circle"
  mergedSites[siteName].tags = mergedSites[siteName].tags || ['All Sites'];
  mergedSites[siteName].tags.map((tag: string) => {
    tagSet[tag] = true;
  });

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
 * All tags available on TRACE sites.
 */
export const tags = Object.keys(tagSet).sort();

/**
 * Contains all sites, including unsupported ones.
 */
export const allSites = mergedSites as SiteList;

export function filterSitesByTags(sites: SiteList, tagsToInclude: string[]) {
  return Object.values(sites).filter(site => site.tags.some(tag => tagsToInclude.includes(tag)));
}
