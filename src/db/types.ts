/**
 * @fileoverview Interfaces, classes, etc., associated with the database.
 */

import { BaseSchema } from './schema';

/**
 * JSON string representing a PouchDB document ID.
 */
export type PouchDbId = string;

/**
 * Convert `value` into a PouchDB document ID.
 */
export function toId(value: any): PouchDbId {
  return JSON.stringify(value);
}

export type DbResponse = PouchDB.Core.Response;

export interface IDbStorable {
  id: PouchDbId;
  rev: string;
  serialize: () => BaseSchema;
  save: () => Promise<DbResponse>;
}
