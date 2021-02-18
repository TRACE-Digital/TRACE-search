import * as sherlock from './sherlock.json';
import * as trace from './trace.json';

interface SherlockSite {
    errorMsg?: string | string[],
    errorType: string,
    regexCheck?: string,
    url: string,
    urlMain: string,
    username_claimed: string,
    username_unclaimed: string
}

interface SherlockSiteList {
    [key: string]: SherlockSite
}

interface TraceSite {
    logoUrl: string
}

interface TraceSiteList {
    [key: string]: TraceSite
}

export interface Site extends SherlockSite, TraceSite {
}

export interface SiteList {
    [key: string]: Site
}

// Copy Sherlock as the base
const mergedSites = JSON.parse(JSON.stringify(sherlock));
export const sherlockSites: SherlockSiteList = sherlock;
export const traceSites: TraceSiteList = trace;

// Overlay the TRACE changes
for (let siteName in trace) {
    mergedSites[siteName] = Object.assign({}, mergedSites[siteName], traceSites[siteName]);
}

export const allSites: SiteList = mergedSites as SiteList;