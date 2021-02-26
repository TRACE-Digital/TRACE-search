/**
 * @fileoverview Interfaces, classes, etc., associated with the database.
 */

import { BaseSchema } from './schema';

/**
 * JSON string representing a PouchDB document ID.
 */
export type PouchDbId = string;

/**
 * High value Unicode sentinel for use with `endkey` in PouchDB queries.
 *
 * https://pouchdb.com/api.html#prefix-search
 *
 * https://docs.couchdb.org/en/latest/ddocs/views/collation.html#string-ranges
 */
export const UTF_MAX = '\ufff0';

/**
 * Convert `value` into a PouchDB document ID.
 *
 * We don't currently support converting the ID back into whatever it came from.
 */
export function toId(value: string[], prefix?: PouchDbId): PouchDbId {
  if (prefix) {
    value = [prefix].concat(value);
  }
  // return value.map(v => JSON.stringify(v.replace('/', '\\/'))).join('/');
  return value.join('/');
}

export type DbResponse = PouchDB.Core.Response;

/** Name this type from `bulkGet()` so we can use it. */
export interface DbDocError { error: PouchDB.Core.Error };

/**
 * Type guard for narrowing type on `bulkGet()` response.
 *
 * https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards
 */
export function isDbDocError<T>(doc: PouchDB.Core.BulkGetResponse<T>['results'][0]['docs'][0]): doc is DbDocError {
  return (doc as DbDocError).error !== undefined;
}

export interface IDbStorable {
  id: PouchDbId;
  rev: string;
  serialize: () => BaseSchema;
  save: () => Promise<DbResponse>;
}

/**
 * Throw an error if the ID on the database object `data` does
 * not match the ID on `existingInstance`.
 *
 * This is helpful during deserialization.
 *
 * If this happens, we're doing something wrong and will probably break the database.
 */
export function throwIfIdMismatch(data: BaseSchema, existingInstance?: IDbStorable) {
  if (existingInstance && existingInstance.id !== data._id) {
    console.error(`ID mismatch: ${existingInstance.id} !== ${data._id}`);
    throw new Error('Illegal operation! Deserialization onto this instance would change its id');
  }
}
