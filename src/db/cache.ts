import EventEmitter from 'events';
import { IDbStorable } from './types';

/**
 * In-memory cache of items from the database that we're working with.
 *
 * Also contains an `EventEmitter` so that React can subscribe to changes
 * to items that it's working with.
 *
 * Modeled off of a JavaScript Set object.
 *
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
 */
export class DbCache<T extends IDbStorable = IDbStorable> {
  /**
   * All registered caches.
   */
  public static caches: DbCache[] = [];

  /**
   * Delete an item from all caches.
   */
  public static remove(id: IDbStorable['id']) {
    for (const cache of DbCache.caches) {
      cache.remove(id);
    }
  }

  /**
   * Clear all caches.
   */
  public static clear() {
    for (const cache of DbCache.caches) {
      cache.clear();
    }
  }

  /**
   * Items cached from the database.
   */
  public items: { [key: string]: T } = {};

  /**
   * Subscribe for updates to items in the cache.
   */
  public events = new EventEmitter();

  public constructor() {
    DbCache.caches.push(this);
  }

  /**
   * Add or update an item in the cache.
   */
  public add(item: T) {
    if (item.id in this.items) {
      if (this.items[item.id].rev !== item.rev) {
        this.events.emit('update', item.id);
      }
    } else {
      // TODO: Could do 'add' eventually
      this.events.emit('update', item.id);
    }

    this.items[item.id] = item;

    // TODO: Don't get fancy yet. Just emit a change for everything
    this.events.emit('change');
  }

  /**
   * Returns `true` if id is in the cache.
   */
  public has(id: IDbStorable['id']) {
    return id in this.items;
  }

  /**
   * Get an item from the cache.
   *
   * Returns `undefined` if not present.
   */
  public get(id: IDbStorable['id']) {
    return this.items[id];
  }

  /**
   * Remove an item from the cache.
   *
   * Doesn't care if it exists or not.
   */
  public remove(id: IDbStorable['id']) {
    if (id in this.items) {
      delete this.items[id];
      this.events.emit('remove', id);
    }

    // TODO: Don't get fancy yet. Just emit a change for everything
    this.events.emit('change');
  }

  /**
   * Clear the cache.
   */
  public clear() {
    for (const prop of Object.getOwnPropertyNames(this.items)) {
      delete this.items[prop];
    }
    this.events.emit('clear');

    // TODO: Don't get fancy yet. Just emit a change for everything
    this.events.emit('change');
  }

  /**
   * Do array-like filtering on the map of cached items.
   */
  public filter(predicate: (value: T) => boolean) {
    const result: { [key: string]: T } = {};
    for (const [k, v] of Object.entries(this.items)) {
      if (predicate(v)) {
        result[k] = v;
      }
    }
    return result;
  }
}
