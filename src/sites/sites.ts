import * as sherlock from './sherlock.json';
import * as trace from './trace.json';

/** Properties present on JSON site definitions from Sherlock. */
interface SherlockSite {
  errorType: string; // status_code, message, or response_url
  url: string; // url for website profile page
  urlMain: string; // url for website home page
  username_claimed: string; // username that is claimed on the website
  username_unclaimed: string; // username that is not claimed on the website
  errorMsg?: string | string[]; // if errorType = message, this message will pop up if the profile doesn't exist
  regexCheck?: string; // regex for valid usernames on the website
  errorUrl?: string; // if errorType = response_url, this is the url that the use will be redirected to if the profile doesn't exist
  urlProbe?: string; // alternate profile page test url for sites where profiles aren't publicly facing
  noPeriod?: string; // ???
  headers?: {}; // headers to send with the request if needed
  request_head_only?: boolean; // for status_code errorType website -- use a GET request instead of a HEAD request
}

interface SherlockSiteList {
  [key: string]: SherlockSite;
}

/** Properties added in the TRACE JSON overlay. */
interface TraceSite {
  prettyUrl?: string; // Host/pretty formatted version of the site's URL
  logoClass?: string; // FontAwesome CSS class for the logo (for use in frontend)
  logoColor?: string; // Optional value to be assigned to the CSS 'color' property
  omit?: boolean; // tells program to not process the site
  tags?: string[];
}

interface TraceSiteList {
  [key: string]: TraceSite | SherlockSite;
}

type _MergedSite = SherlockSite & TraceSite;
export interface Site extends _MergedSite {
  name: string;
  tags: string[];
}

export interface SiteList {
  [key: string]: Site;
}

/** Keys required in a site definition. */
export const REQUIRED_KEYS = ['errorType', 'url', 'username_claimed', 'username_unclaimed'];

// Copy Sherlock as the base
const mergedSites = JSON.parse(JSON.stringify(sherlock)) as SiteList;
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

  mergedSites[siteName].logoClass = mergedSites[siteName].logoClass || 'fas fa-question fa-sm';
  mergedSites[siteName].tags = mergedSites[siteName].tags || ['Untagged'];
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

/** All tags available on TRACE sites. */
export const tags = Object.keys(tagSet).sort();

/** Contains all sites, including unsupported ones. */
export const allSites: SiteList = mergedSites;

export function filterSitesByTags(sites: SiteList, tagsToInclude: string[]) {
  return Object.values(sites).filter(site => site.tags.some(tag => tagsToInclude.includes(tag)));
}
