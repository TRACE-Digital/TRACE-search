/**
 * @fileoverview Classes and functions used for interacting with
 * TRACE searches.
 */

import {
  IDbStorable,
  getDb,
  PouchDbId,
  SearchDefinitionSchema,
  SearchSchema,
  toId,
  DbResponse,
  throwIfIdMismatch,
  ID_SEPARATOR,
  AccountSchema,
  UTF_MAX,
} from 'db';
import { allSites, Site } from 'sites';
import { accounts, DiscoveredAccount, ThirdPartyAccount, UnregisteredAccount } from './accounts';

/** Collection of search definitions that have already been pulled out of the database. */
const searchDefinitions: { [key: string]: SearchDefinition } = {};
/** Collection of searches that have already been pulled out of the database. */
const searches: { [key: string]: Search } = {};

/**
 * Parameters that define a repeatable `Search`.
 */
export class SearchDefinition implements IDbStorable {
  private static idForDefaultName = 0;

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
    searchDefinitions[instance.id] = instance;

    const db = await getDb();
    const response = await db.allDocs<SearchSchema>({
      include_docs: true,
      startkey: instance.id + ID_SEPARATOR,
      endkey: toId(['search', UTF_MAX], instance.id),
    });
    console.debug(response);

    // Clear the history so we don't have to worry about duplicates
    instance.history.length = 0;

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

      if (doc._id in searches) {
        instance.history.push(searches[doc._id]);
      } else {
        try {
          const search = await Search.deserialize(doc);
          instance.history.push(search);
        } catch (e) {
          console.debug(doc);
          console.debug(e);
          console.warn(`Skipping search '${doc._id}'.\nFailed to deserialize:\n${e}`);
          continue;
        }
      }
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
    this.includedSites = siteNames.map(siteName => allSites[siteName]);

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
  public static async deserialize(data: SearchSchema, existingInstance?: Search) {
    throwIfIdMismatch(data, existingInstance);

    const db = await getDb();

    // We need the search definition to construct a new search
    let definition: SearchDefinition;
    if (existingInstance) {
      definition = existingInstance.definition;
    } else if (data.definitionId in searchDefinitions) {
      definition = searchDefinitions[data.definitionId];
    } else {
      const definitionSchema = await db.get<SearchDefinitionSchema>(data.definitionId);
      definition = await SearchDefinition.deserialize(definitionSchema);

      // Deserializing the search definition should create the instance for us
      const search = searches[data._id];
      console.assert(search, `SearchDefinition.deserialize() did not create search '${data._id}'!`);
      return search;
    }

    const instance = existingInstance || new Search(definition);

    instance.id = data._id;
    instance.rev = data._rev;
    instance.definition = definition;
    instance.state = data.state;
    instance.startedAt = data.startedAt ? new Date(data.startedAt) : null;
    instance.endedAt = data.endedAt ? new Date(data.endedAt) : null;

    const response = await db.allDocs<AccountSchema>({
      include_docs: true,
      startkey: instance.id + ID_SEPARATOR,
      endkey: toId(['searchResult', UTF_MAX], instance.id),
    });

    // Clear the results so we don't have to worry about duplicates
    instance.results.length = 0;

    for (const row of response.rows) {
      const doc = row.doc;

      if (doc === undefined) {
        console.error('Received undefined document! Did you pass include_docs: true?');
        continue;
      }

      // TODO: See if there is a way to restrict the query better
      // Query will also match any new objects whose key is an extension of ours
      // We don't really need this yet since we don't have any objects that do this,
      // but still be safe and skip these by checking a field that only accounts should have
      if (doc.userName === undefined) {
        continue;
      }

      if (doc._id in accounts) {
        instance.storeResult(accounts[doc._id]);
      } else {
        try {
          const account = await ThirdPartyAccount.deserialize(doc);
          instance.storeResult(account);
        } catch (e) {
          console.debug(doc);
          console.debug(e);
          console.warn(`Skipping account '${doc._id}'.\nFailed to deserialize:\n${e}`);
          continue;
        }
      }
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
    if (this.definition.includedSites.length === 0) {
      return 100;
    }
    return Math.round((Object.values(this.results).length / this.definition.includedSites.length) * 100);
  }

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
  public results: ThirdPartyAccount[] = [];
  public resultsMap: SearchResults = {};
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
    const resultIdPrefix = toId(['searchResult'], this.id);

    for (const site of this.definition.includedSites) {
      for (const userName of this.definition.userNames) {
        // Ignore sites that we already have results for
        if (site.name in this.resultsMap) {
          if (userName in this.resultsMap[site.name]) {
            continue;
          }
        }

        console.log(`Checking ${site.name}...`);

        // TODO: Actually search

        const account = new DiscoveredAccount(site, userName, resultIdPrefix);
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
  protected storeResult(account: ThirdPartyAccount) {
    const site = account.site;

    // If it's in the map, assume it's everywhere
    // Prevents pushing duplicates into `results`
    if (site.name in this.resultsMap) {
      if (account.userName in this.resultsMap[site.name]) {
        return;
      }
    }

    this.results.push(account);
    this.resultsMap[site.name] = this.resultsMap[site.name] || {};
    this.resultsMap[site.name][account.userName] = account;
    this.resultsBySite[site.name] = this.resultsBySite[site.name] || [];
    this.resultsBySite[site.name].push(account);
    this.resultsByUser[account.userName] = this.resultsByUser[account.userName] || [];
    this.resultsByUser[account.userName].push(account);
  }

  /**
   * Save/update this search in the database.
   *
   * Don't call this unless you've made changes!
   * Each call will create a revision and take up space.
   */
  public async save(): Promise<DbResponse> {
    console.debug(`Saving search ${this.id}...`);

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

export interface SearchResultsBySite {
  [siteName: string]: ThirdPartyAccount[];
}

export interface SearchResultsByUser {
  [userName: string]: ThirdPartyAccount[];
}
