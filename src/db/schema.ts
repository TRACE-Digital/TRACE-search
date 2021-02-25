import { AccountType, SearchState } from 'search';
import { PouchDbId } from './types';

/**
 * Fields that all database objects contain.
 */
export interface BaseSchema {
  _id: PouchDbId;
  _rev: string;
}

/**
 * Accounts
 */

export interface AccountSchema extends BaseSchema {
  type: AccountType;
  createdAt: string;
  siteName: string;
  userName: string;
}

export interface DiscoveredAccountSchema extends AccountSchema {
  confidence: number;
  matchedFirstNames: string[];
  matchedLastNames: string[];
}

export interface ClaimedAccountSchema extends DiscoveredAccountSchema {
  claimedAt: string;
}

export interface RejectedAccountSchema extends DiscoveredAccountSchema {
  rejectedAt: string;
}

export interface ManualAccountSchema extends AccountSchema {
  lastEditedAt: string;
}

/**
 * Search
 */

export interface SearchDefinitionSchema extends BaseSchema {
  name: string;
  createdAt: string;
  lastEditedAt: string;
  includedSiteNames: string[];
  userNames: string[];
  firstNames: string[];
  lastNames: string[];
  historyIds: PouchDbId[];
}

export interface SearchSchema extends BaseSchema {
  state: SearchState;
  startedAt: string | null;
  endedAt: string | null;
  definitionId: PouchDbId;
  resultIds: PouchDbId[];
}
