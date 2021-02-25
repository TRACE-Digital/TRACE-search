/**
 * @fileoverview Interfaces, classes, etc., associated with the database.
 */

import { BaseSchema } from './schema';

export type PouchDbId = string[];

export interface DbStorable {
  id: PouchDbId;
  rev: string;
  serialize: () => BaseSchema;
}
