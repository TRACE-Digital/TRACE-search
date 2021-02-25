import * as sherlock from './sherlock.json';
import * as trace from './trace.json';

interface SherlockSite {
<<<<<<< Updated upstream
    errorMsg?: string | string[],
    errorType: string,
    regexCheck?: string,
    url: string,
    urlMain: string,
    username_claimed: string,
    username_unclaimed: string
=======
  errorMsg?: string | string[];
  errorType: string;
  errorUrl?: string;
  regexCheck?: string;
  url: string;
  urlMain: string;
  username_claimed: string;
  username_unclaimed: string;
>>>>>>> Stashed changes
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

interface Site {
    url: string,
    logoUrl: string
}

interface SiteList {
    [key: string]: Site
}

// Copy Sherlock as the base
const mergedSites = JSON.parse(JSON.stringify(sherlock));
const sherlockSites: SherlockSiteList = sherlock;
const traceSites: TraceSiteList = trace;

// Overlay the TRACE changes
for (let siteName in trace) {
    mergedSites[siteName] = Object.assign({}, mergedSites[siteName], traceSites[siteName]);
}

const sites: SiteList = mergedSites as SiteList;

export default {
    all: sites,
    trace: traceSites,
    sherlock: sherlockSites
};