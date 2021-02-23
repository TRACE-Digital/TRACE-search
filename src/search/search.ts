/**
 * @fileoverview Classes and functions used for interacting with
 * TRACE searches.
 */

import { DbStorable } from 'db';
import { Site } from 'sites';
import { DiscoveredAccount, ThirdPartyAccount, UnregisteredAccount } from './accounts';

/**
 * Parameters that define a repeatable `Search`.
 */
export class SearchDefinition implements DbStorable {

  public id: string[] = [];
  public createdAt: Date = new Date();
  public lastEditedAt: Date = new Date();

  public includedSites: Site[] = [];

  public userNames: string[] = [];
  public firstNames: string[] = [];
  public lastNames: string[] = [];

  public history: Search[] = [];

  public get lastRun(): Search | null {
    // TODO: If this.history is sorted, we can simplify
    let result = null;
    for (const search of this.history) {
      if (result === null || search.startedAt >= result.startedAt) {
        result = search;
      }
    }
    return result;
  };

  public get lastRunAt(): Date | null {
    if (this.lastRun) {
      return this.lastRun.startedAt;
    }
    return null;
  };

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
}

/**
 * Single execution of a `SearchDefinition`.
 */
export class Search implements DbStorable {

  public id: string[] = [];
  public startedAt: Date = new Date();
  public completedAt: Date | null = null;

  public definition: SearchDefinition;
  public state = SearchState.CREATED;
  public progress: number = 0;

  public results: ThirdPartyAccount[] = [];
  public get discoveredResults() {
    return this.results.filter(account => account instanceof DiscoveredAccount);
  }
  public get unregisteredResults() {
    return this.results.filter(account => account instanceof UnregisteredAccount);
  }

  constructor(definition: SearchDefinition) {
    this.definition = definition;
  }

  /**
   * Start the search.
   */
  public start() {
    const validStates = [
      SearchState.CREATED,
      SearchState.PAUSED
    ];
    if (! validStates.includes(this.state)) {
      throw new Error(`Cannot call start() while state is '${this.state}'!`);
    }

    this.state = SearchState.IN_PROGRESS;
  }

  /**
   * Cancel the search.
   */
  public cancel() {
    const validStates = [
      SearchState.IN_PROGRESS,
      SearchState.PAUSED
    ];
    if (! validStates.includes(this.state)) {
      throw new Error(`Cannot call cancel() while state is '${this.state}'!`);
    }

    this.state = SearchState.CANCELLED;
  }

  private doSearch() {

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
