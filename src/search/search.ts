/**
 * @fileoverview Classes and functions used for interacting with
 * TRACE searches.
 */

import { IDbStorable, getDb, PouchDbId, SearchDefinitionSchema, SearchSchema, toId, DbResponse } from 'db';
import { allSites, Site, SiteList } from 'sites';
import { DiscoveredAccount, ThirdPartyAccount, UnregisteredAccount } from './accounts';

const searchDefinitions: { [key: string]: SearchDefinition } = {};
const searches: { [key: string]: Search } = {};

/**
 * Parameters that define a repeatable `Search`.
 */
export class SearchDefinition implements IDbStorable {
  private static idForDefaultName = 0;

  public readonly id: PouchDbId;
  public rev: string = '';

  public name: string;
  public createdAt: Date = new Date();
  public lastEditedAt: Date = new Date();

  public includedSites: Site[] = [];

  public userNames: string[] = [];
  public firstNames: string[] = [];
  public lastNames: string[] = [];

  public history: Search[] = [];
  public get completedHistory() {
    return this.history.filter(execution => execution.state === SearchState.COMPLETED);
  }

  public get lastRun(): Search | null {
    // TODO: If this.history is sorted, we can simplify
    let result = null;
    for (const search of this.completedHistory) {
      if (result === null || (search.startedAt && result.startedAt && search.startedAt >= result.startedAt)) {
        result = search;
      }
    }
    return result;
  }

  public get lastRunAt(): Date | null {
    if (this.lastRun) {
      return this.lastRun.startedAt;
    }
    return null;
  }

  constructor(name?: string, siteNames?: string[]) {
    this.name = name || `Search #${++SearchDefinition.idForDefaultName}`;

    siteNames = siteNames || Object.keys(allSites);
    this.includedSites = siteNames.map(name => allSites[name]);

    this.id = toId(['searchDef', this.createdAt, this.name]);
  }

  /**
   * Return a fresh execution of this search.
   *
   * The search must still be started via `start()`.
   */
  public new() {
    const search = new Search(this);
    this.history.push(search);
    return search;
  }

  /**
   * Remove all executions of this search from history.
   */
  public clear() {
    console.warn('TODO: Remove from the database');
    this.history.length = 0;
  }

  /**
   * Delete this search definition and all executions.
   */
  public delete() {
    throw new Error('Not implemented yet!');
  }

  /**
   * Save/update this search definition in the database.
   *
   * Don't call this unless you've made changes!
   * Each call will create a revision and take up space.
   */
  public async save(): Promise<DbResponse> {
    const db = await getDb();
    const result = await db.put(this.serialize());
    if (result.ok) {
      this.rev = result.rev;
      return result;
    }

    console.error(result);
    throw new Error('Failed to save search definition!');
  }

  public serialize(): SearchDefinitionSchema {
    return {
      _id: this.id,
      _rev: this.rev,
      name: this.name,
      createdAt: this.createdAt.toJSON(),
      lastEditedAt: this.lastEditedAt.toJSON(),
      includedSiteNames: this.includedSites.map(site => site.name),
      userNames: this.userNames,
      firstNames: this.firstNames,
      lastNames: this.lastNames,
      historyIds: this.history.map(execution => execution.id),
    };
  }
}

/**
 * Single execution of a `SearchDefinition`.
 */
export class Search implements IDbStorable {

  public readonly id: PouchDbId;
  public rev: string = '';

  public state = SearchState.CREATED;
  public startedAt: Date | null = null;
  public endedAt: Date | null = null;

  public definition: SearchDefinition;
  public get progress() {
    if (this.definition.includedSites.length === 0) {
      return 100;
    }
    return Math.round((Object.values(this.results).length / this.definition.includedSites.length) * 100);
  }

  /**
   * `resultsDict` is the best structure for storing and checking results
   * internally during search, but is kind of messy to iterate over after.
   *
   * Provide flattened alternatives that make it easier to get the data.
   *
   * Since we don't really need to remove or reorder, this isn't too painful
   * to manage.
   *
   * If it's too memory intensive, we can reevaluate.
   */
  public results: ThirdPartyAccount[] = [];
  public resultsDict: SearchResults = {};
  public resultsBySite: SearchResultsBySite = {};
  public resultsByUser: SearchResultsByUser = {};
  public get discoveredResults() {
    return this.results.filter(account => account instanceof DiscoveredAccount) as DiscoveredAccount[];
  }
  public get unregisteredResults() {
    return this.results.filter(account => account instanceof UnregisteredAccount) as UnregisteredAccount[];
  }

  constructor(definition: SearchDefinition) {
    this.definition = definition;

    // Copy the definition ID and add our pieces
    const idBase = JSON.parse(this.definition.id);
    this.id = toId(idBase.concat(['search', new Date()]));
  }

  /**
   * Start the search.
   */
  public start() {
    let logAction = '';

    if (this.state === SearchState.CREATED) {
      logAction = 'Starting';
    } else if (this.state === SearchState.PAUSED) {
      logAction = 'Resuming';
    } else {
      throw new Error(`Cannot call start() while state is '${this.state}'!`);
    }

    console.groupCollapsed(`${logAction} search...`);

    this.state = SearchState.IN_PROGRESS;
    this.startedAt = new Date();

    // TODO: This is synchronous right now
    // Should probably devise something async
    try {
      this.doSearch();
    } catch (e) {
      console.error(`Search failed!:`);
      console.error(e);

      this.fail();
    }

    console.groupEnd();
  }

  /**
   * Cancel the search.
   */
  public cancel() {
    let logState = '';

    if (this.state === SearchState.IN_PROGRESS) {
      logState = 'active';
    } else if (this.state === SearchState.PAUSED) {
      logState = 'paused';
    } else {
      throw new Error(`Cannot call cancel() while state is '${this.state}'!`);
    }

    console.log(`Cancelling ${logState} search...`);

    this.state = SearchState.CANCELLED;

    // TODO: Interrupt doSearch() if we make it async
  }

  /**
   * Perform the search for each `definition.includedSites`.
   *
   * This is incremental. It won't duplicate sites that already have results.
   */
  protected doSearch() {
    const resultIdPrefix = JSON.parse(this.id).concat('searchResult');

    for (const site of this.definition.includedSites) {
      for (const userName of this.definition.userNames) {
        // Ignore sites that we already have results for
        if (site.name in this.resultsDict) {
          if (this.definition.name in this.resultsDict[site.name]) {
            continue;
          }
        }

        if (site.name === 'default') {
          console.log(site);
        }

        console.log(`Checking ${site.name}...`);

        const account = new DiscoveredAccount(site, userName, resultIdPrefix);

        // TODO: Actually search

        // Store in multiple formats. See note above member initialization
        this.results.push(account);
        this.resultsDict[site.name] = this.resultsDict[site.name] || {};
        this.resultsDict[site.name][userName] = account;
        this.resultsBySite[site.name] = this.resultsBySite[site.name] || [];
        this.resultsBySite[site.name].push(account);
        this.resultsByUser[userName] = this.resultsByUser[userName] || [];
        this.resultsByUser[userName].push(account);
      }
    }

    this.complete();
  }

  /**
   * Mark this search as completed.
   */
  protected complete() {
    console.assert(this.progress === 100, 'Finished search did not have 100% progress!');

    this.state = SearchState.COMPLETED;
    this.endedAt = new Date();
  }

  /**
   * Mark this search as failed.
   */
  protected fail() {
    this.state = SearchState.FAILED;
    this.endedAt = new Date();
  }

  /**
   * Save/update this search in the database.
   *
   * Don't call this unless you've made changes!
   * Each call will create a revision and take up space.
   */
  public async save(): Promise<DbResponse> {
    const db = await getDb();
    const result = await db.put(this.serialize());
    if (result.ok) {
      this.rev = result.rev;
      return result;
    }

    console.error(result);
    throw new Error('Failed to save search definition!');
  }

  public serialize(): SearchSchema {
    return {
      _id: this.id,
      _rev: this.rev,
      state: this.state,
      startedAt: this.startedAt ? this.startedAt.toJSON() : null,
      endedAt: this.endedAt ? this.endedAt.toJSON() : null,
      definitionId: this.definition.id,
      resultIds: this.results.map(result => result.id),
    };
  }
}

/**
 * State associated with a `Search`.
 */
export enum SearchState {
  CREATED = 'Created',
  IN_PROGRESS = 'In progress',
  PAUSED = 'Paused',
  CANCELLED = 'Cancelled',
  COMPLETED = 'Completed',
  FAILED = 'Failed',
}

/**
 * Dictionary keyed by site name, containing a dictionary keyed by user
 * name, containing the account.
 *
 * This is kind of messy. Keying by site name isn't unique
 * since we can match on multiple user names, so we nest the
 * usernames.
 *
 * But the nesting makes iteration hard.
 */
export interface SearchResults {
  [siteName: string]: {
    [userName: string]: ThirdPartyAccount;
  };
}

export interface SearchResultsBySite {
  [siteName: string]: ThirdPartyAccount[];
}

export interface SearchResultsByUser {
  [userName: string]: ThirdPartyAccount[];
}
