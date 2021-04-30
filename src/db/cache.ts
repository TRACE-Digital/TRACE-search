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
   * Number of callers that requested updates to be blocked.
   */
  private static blockEventCount = 0;

  /**
   * Returns true if events should be emitted.
   */
  private static get shouldEmit() {
    return DbCache.blockEventCount === 0;
  }

  /**
   * Temporarily block events from being emitted.
   *
   * This is useful for performance when doing bulk changes.
   *
   * The call that unblocks events will emit a generic `change`
   * event from all `DbCache` objects.
   *
   * Inspired by https://doc.qt.io/qt-5/qobject.html#blockSignals
   */
  public static blockEvents(block: boolean) {
    if (block) {
      DbCache.blockEventCount++;
    } else {
      DbCache.blockEventCount--;
    }

    if (DbCache.blockEventCount < 0) {
      console.warn('Mismatched DbCache.blockEvents(false) call! Count went negative');
    }

    // If we've just come back from blocking events,
    // emit a generic change event for all caches
    if (DbCache.shouldEmit) {
      for (const cache of DbCache.caches) {
        cache.events.emit('change');
      }
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
        if (DbCache.shouldEmit) this.events.emit('update', item.id);
      }
    } else {
      // TODO: Could do 'add' eventually
      if (DbCache.shouldEmit) this.events.emit('update', item.id);
    }

    this.items[item.id] = item;

    // TODO: Don't get fancy yet. Just emit a change for everything
    if (DbCache.shouldEmit) this.events.emit('change');
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
      if (DbCache.shouldEmit) this.events.emit('remove', id);
    }

    // TODO: Don't get fancy yet. Just emit a change for everything
    if (DbCache.shouldEmit) this.events.emit('change');
  }

  /**
   * Clear the cache.
   */
  public clear() {
    for (const prop of Object.getOwnPropertyNames(this.items)) {
      delete this.items[prop];
    }
    if (DbCache.shouldEmit) this.events.emit('clear');

    // TODO: Don't get fancy yet. Just emit a change for everything
    if (DbCache.shouldEmit) this.events.emit('change');
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
