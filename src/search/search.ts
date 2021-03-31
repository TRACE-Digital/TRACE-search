/**
 * @fileoverview Classes and functions used for interacting with
 * TRACE searches.
 */

import { EventEmitter } from 'events';
import {
  IDbStorable,
  getDb,
  PouchDbId,
  SearchDefinitionSchema,
  SearchSchema,
  toId,
  DbResponse,
  throwIfIdMismatch,
  UTF_MAX,
  DbCache,
} from 'db';
import { allSites, Site } from 'sites';
import { AutoSearchAccount, AutoSearchAccountAction, searchResults, ThirdPartyAccount } from './accounts';
import { findAccount } from './findAccount';

/**
 * Parameters that define a repeatable `Search`.
 */
export class SearchDefinition implements IDbStorable {
  public static cache = new DbCache<SearchDefinition>();
  public get definitions() {
    return SearchDefinition.cache.items;
  }
  private static idForDefaultName = 0;

  /**
   * Load all `SearchDefinition`s from the database into
   * the `SearchDefinition.cache`.
   *
   * Returns an array of the requested definitions. All loaded definitions
   * (including ones loaded by other requests) can be accessed
   * via `SearchDefinition.cache`.
   */
  public static async loadAll(idPrefix?: string) {
    const db = await getDb();
    const response = await db.allDocs<SearchDefinitionSchema>({
      include_docs: true,
      startkey: toId(['searchDef'], idPrefix),
      endkey: toId(['searchDef', UTF_MAX], idPrefix),
    });
    console.debug(response);

    const results = [];
    for (const row of response.rows) {
      const doc = row.doc;

      if (doc === undefined) {
        console.error('Received undefined document! Did you pass include_docs: true?');
        continue;
      }

      // TODO: See if there is a way to restrict the query better
      // Query will also match searches since their key is an extension of ours
      // Skip these by checking a field that only SearchDefinition will have
      if (doc.includedSiteNames === undefined) {
        continue;
      }

      const existing = SearchDefinition.cache.get(doc._id);
      if (existing) {
        results.push(existing);
      } else {
        try {
          const searchDef = await SearchDefinition.deserialize(doc);
          results.push(searchDef);
        } catch (e) {
          console.debug(doc);
          console.debug(e);
          console.warn(`Skipping search definition '${doc._id}'.\nFailed to deserialize:\n${e}`);
          continue;
        }
      }
    }

    return results;
  }

  public static async deserialize(data: SearchDefinitionSchema, existingInstance?: SearchDefinition) {
    throwIfIdMismatch(data, existingInstance);

    const instance = existingInstance || new SearchDefinition(data.name, data.includedSiteNames);

    // TODO: Trust the constructor to get this right? Yes, probably
    // instance.includedSites

    instance.id = data._id;
    instance.name = data.name;
    instance.rev = data._rev;
    instance.createdAt = new Date(data.createdAt);
    instance.lastEditedAt = new Date(data.lastEditedAt);
    instance.userNames = data.userNames;
    instance.firstNames = data.firstNames;
    instance.lastNames = data.lastNames;

    // IMPORTANT: Add our instance before we create search history so that
    // each entry can look us up and won't try to go to the db
    SearchDefinition.cache.add(instance);

    const results = await Search.loadAll(instance.id);

    // Clear the history so we don't have to worry about duplicates
    instance.history.length = 0;
    for (const result of results) {
      instance.history.push(result);
    }

    return instance;
  }

  public id: PouchDbId;
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
    for (const siteName of siteNames) {
      if (siteName in allSites) {
        this.includedSites.push(allSites[siteName]);
      } else {
        console.warn(`Could not add site '${siteName}'. No definition found!`);
      }
    }

    this.id = toId(['searchDef', this.createdAt.toJSON(), this.name]);
  }

  /**
   * Return a fresh execution of this search.
   *
   * The search must still be started via `start()`.
   */
  public async new() {
    const search = new Search(this);
    this.history.push(search);
    await search.save();
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
    console.debug(`Saving search definition ${this.id}...`);

    const db = await getDb();
    const result = await db.put(this.serialize());

    if (result.ok) {
      this.rev = result.rev;
      SearchDefinition.cache.add(this);
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
    };
  }
}

/**
 * Single execution of a `SearchDefinition`.
 */
export class Search implements IDbStorable {
  public static cache = new DbCache<Search>();
  public get searches() {
    return Search.cache.items;
  }

  /**
   * This won't return anything unless you pass a searchDefinition prefix!
   *
   * Load all `Search`s from the database into
   * the `Search.cache`.
   *
   * Returns an array of the requested searches. All loaded searches
   * (including ones not loaded by this request) can be accessed
   * via `Search.cache`.
   */
  public static async loadAll(idPrefix?: string) {
    const db = await getDb();
    const response = await db.allDocs<SearchSchema>({
      include_docs: true,
      startkey: toId(['search'], idPrefix),
      endkey: toId(['search', UTF_MAX], idPrefix),
    });
    console.debug(response);

    const results = [];
    for (const row of response.rows) {
      const doc = row.doc;

      if (doc === undefined) {
        console.error('Received undefined document! Did you pass include_docs: true?');
        continue;
      }

      // TODO: See if there is a way to restrict the query better
      // Query will also match search results since their key is an extension of ours
      // Skip these by checking a field that only Search will have
      if (doc.definitionId === undefined) {
        continue;
      }

      const existing = Search.cache.get(doc._id);
      if (existing) {
        results.push(existing);
      } else {
        try {
          const search = await Search.deserialize(doc);
          results.push(search);
        } catch (e) {
          console.debug(doc);
          console.debug(e);
          console.warn(`Skipping search '${doc._id}'.\nFailed to deserialize:\n${e}`);
          continue;
        }
      }
    }

    return results;
  }

  public static async deserialize(data: SearchSchema, existingInstance?: Search) {
    throwIfIdMismatch(data, existingInstance);

    const db = await getDb();

    // We need the search definition to construct a new search
    let definition = SearchDefinition.cache.get(data.definitionId);
    if (existingInstance) {
      definition = existingInstance.definition;
    } else if (!(definition)) {
      try {
        const definitionSchema = await db.get<SearchDefinitionSchema>(data.definitionId);
        definition = await SearchDefinition.deserialize(definitionSchema);
      } catch (e) {
        console.debug(e);
        throw new Error(`Failed to deserialize search definition '${data.definitionId}': ${e}`);
      }

      // Deserializing the search definition should create the Search instance for us
      const search = Search.cache.get(data._id);
      if (!(search)) {
        throw new Error(`SearchDefinition.deserialize() did not create search '${data._id}'!`);
      }

      return search;
    }

    console.assert(definition, `Could not find definition '${data.definitionId}' for '${data._id}'!`);

    const instance = existingInstance || new Search(definition);

    instance.id = data._id;
    instance.rev = data._rev;
    instance.definition = definition;
    instance.state = data.state;
    instance.startedAt = data.startedAt ? new Date(data.startedAt) : null;
    instance.endedAt = data.endedAt ? new Date(data.endedAt) : null;

    Search.cache.add(instance);

    // Load the search results, but don't load them into the global accounts map
    const prefix = toId(['searchResult'], instance.id);
    const results = await ThirdPartyAccount.loadAll(prefix) as AutoSearchAccount[];

    for (const result of results) {
      console.assert(result instanceof AutoSearchAccount, 'Search result was not an instance of AutoSearchAccount!');
      instance.storeResult(result);
    }

    return instance;
  }

  public id: PouchDbId;
  public rev: string = '';

  public state = SearchState.CREATED;
  public startedAt: Date | null = null;
  public endedAt: Date | null = null;

  public definition: SearchDefinition;
  public get progress() {
    const denominator = this.definition.includedSites.length * this.definition.userNames.length;
    if (denominator === 0) {
      return 100;
    }
    return Math.round((Object.values(this.results).length / denominator) * 100);
  }

  public events = new EventEmitter();

  /**
   * `resultsMap` is the best structure for storing and checking results
   * internally during search, but is kind of messy to iterate over after.
   *
   * Provide flattened alternatives that make it easier to get the data.
   *
   * Since we don't really need to remove or reorder, this isn't too painful
   * to manage.
   *
   * If it's too memory intensive, we can reevaluate.
   */
  public results: AutoSearchAccount[] = [];
  public resultsById: SearchResultsById = {};
  public resultsMap: SearchResults = {};
  public resultsBySite: SearchResultsBySite = {};
  public resultsByUser: SearchResultsByUser = {};
  /** Search results that have not been claimed/rejected. */
  public get unevaluatedResults() {
    return this.results.filter(account => account.actionTaken === AutoSearchAccountAction.NONE);
  }
  /** Search results that have already been claimed/rejected */
  public get evaluatedResults() {
    return this.results.filter(account => account.actionTaken !== AutoSearchAccountAction.NONE);
  }

  constructor(definition: SearchDefinition) {
    this.definition = definition;

    // Copy the definition ID and add our pieces
    this.id = toId(['search', new Date().toJSON()], this.definition.id);
  }

  /**
   * Start the search.
   */
  public async start() {
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
      await this.doSearch();

      console.assert(this.progress === 100, 'Finished search did not have 100% progress!');

      this.state = SearchState.COMPLETED;
    } catch (e) {
      console.error(`Search failed!:`);
      console.error(e);

      this.state = SearchState.FAILED;
    }

    this.endedAt = new Date();
    await this.save();

    console.groupEnd();
  }

  /**
   * Cancel the search.
   */
  public async cancel() {
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
    this.endedAt = new Date();

    // TODO: Interrupt doSearch() if we make it async

    await this.save();
  }

  /**
   * Perform the search for each `definition.includedSites`.
   *
   * This is incremental. It won't duplicate sites that already have results.
   */
  protected async doSearch() {
    for (const site of this.definition.includedSites) {
      for (const userName of this.definition.userNames) {
        // Ignore sites that we already have results for
        if (site.name in this.resultsMap) {
          if (userName in this.resultsMap[site.name]) {
            continue;
          }
        } else if (site.omit) {
          // Skip over sites that we are explicitly told to omit
          console.warn(`${site.name} omitted.`);
          continue;
        }

        console.log(`Checking ${site.name}...`);

        // Search for the account and store results
        const account = await findAccount(site, userName, this);
        await account.save();

        // Store in multiple formats. See note above result* member initialization
        this.storeResult(account);
      }
    }
  }

  /**
   * Store the resulting account where it needs to go.
   *
   * Won't overwrite/duplicate accounts whose keys already appear in `resultsMap`
   * (noop for those).
   */
  protected storeResult(account: AutoSearchAccount) {
    const site = account.site;

    // If it's in the map, assume it's everywhere
    // Prevents pushing duplicates into `results`
    if (site.name in this.resultsMap) {
      if (account.userName in this.resultsMap[site.name]) {
        return;
      }
    }

    this.results.push(account);
    this.resultsById[account.id] = account;
    this.resultsMap[site.name] = this.resultsMap[site.name] || {};
    this.resultsMap[site.name][account.userName] = account;
    this.resultsBySite[site.name] = this.resultsBySite[site.name] || [];
    this.resultsBySite[site.name].push(account);
    this.resultsByUser[account.userName] = this.resultsByUser[account.userName] || [];
    this.resultsByUser[account.userName].push(account);

    ThirdPartyAccount.resultCache.add(account);

    this.events.emit('result', account.id);
  }

  /**
   * Save/update this search in the database.
   *
   * Don't call this unless you've made changes!
   * Each call will create a revision and take up space.
   */
  public async save(): Promise<DbResponse> {
    // Save our definition if it hasn't been saved yet
    if (this.definition.rev.length === 0) {
      await this.definition.save();
    }

    console.debug(`Saving search ${this.id}...`);

    const db = await getDb();
    const result = await db.put(this.serialize());

    if (result.ok) {
      this.rev = result.rev;
      Search.cache.add(this);
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
 * But the nesting makes iteration hard. See `Search.results` for a flattened version.
 */
export interface SearchResults {
  [siteName: string]: {
    [userName: string]: ThirdPartyAccount;
  };
}

export interface SearchResultsById {
  [id: string]: ThirdPartyAccount;
}

export interface SearchResultsBySite {
  [siteName: string]: ThirdPartyAccount[];
}

export interface SearchResultsByUser {
  [userName: string]: ThirdPartyAccount[];
}

/**
 * **DEPRECATED**
 * @deprecated Use `SearchDefinition.cache` instead.
 *
 * Collection of search definitions that have already been pulled out of the database.
 */
export const searchDefinitions: { [key: string]: SearchDefinition } = SearchDefinition.cache.items;
/**
 * **DEPRECATED**
 * @deprecated Use `Search.cache` instead.
 *
 * Collection of searches that have already been pulled out of the database.
 */
export const searches: { [key: string]: Search } = Search.cache.items;
