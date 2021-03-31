import { AccountType, ConfidenceRating, DiscoveredAccountAction, SearchState } from 'search';
import { allSites, Site } from 'sites';
import { PouchDbId } from './types';

/**
 * Fields that all database objects contain.
 */
export interface BaseSchema {
  _id: PouchDbId;
  _rev: string;
  _deleted?: boolean;
}

////  Accounts  ////

/**
 * Allow a site definition directly on the object or as a
 * reference into the `allSites` map.
 *
 * See `deserializeSite()` for details.
 */
export interface AccountSchema extends BaseSchema {
  type: AccountType;
  createdAt: string;
  site?: Site; // TODO: Make this SiteSchema if we add functions to Site
  siteName?: string;
  userName: string;
}

export interface DiscoveredAccountSchema extends AccountSchema {
  confidence: ConfidenceRating;
  matchedFirstNames: string[];
  matchedLastNames: string[];
  actionTaken: DiscoveredAccountAction;
}

export interface ClaimedAccountSchema extends DiscoveredAccountSchema {
  claimedAt: string;
}

export interface RejectedAccountSchema extends DiscoveredAccountSchema {
  rejectedAt: string;
}

export interface ManualAccountSchema extends AccountSchema {
  lastEditedAt: string;
  site: Site;
}

// tslint:disable-next-line:no-empty-interface
export interface UnregisteredAccountSchema extends AccountSchema {}

/**
 * Deserialize the `site` or `siteName` packed in `AccountSchema`.
 *
 * `site` takes precedence over `siteName`.
 */
export function deserializeSite(data: AccountSchema): Site {
  if (data.site) {
    return data.site;
  } else if (data.siteName && data.siteName in allSites) {
    return allSites[data.siteName];
  } else {
    console.error(data);
    throw new Error(`Cannot deserialize account. No site definition found!`);
  }
}

////  Search  ////

export interface SearchDefinitionSchema extends BaseSchema {
  name: string;
  createdAt: string;
  lastEditedAt: string;
  includedSiteNames: string[];
  userNames: string[];
  firstNames: string[];
  lastNames: string[];
}

export interface SearchSchema extends BaseSchema {
  state: SearchState;
  startedAt: string | null;
  endedAt: string | null;
  definitionId: PouchDbId;
}
