import { BaseSchema, getDb, IDbStorable, PouchDbId } from 'db';
import { dumpAllDocs } from './util';

declare global {
  namespace jest {
    interface Matchers<R> {
      /**
       * Expect a database ID to be present in the database.
       */
      toBeInDatabase(db?: PouchDB.Database): Promise<CustomMatcherResult>;
    }
  }
}

expect.extend({
  async toBeInDatabase(docId: PouchDbId, db?: PouchDB.Database) {
    db = db || (await getDb());

    const allIds = (await dumpAllDocs(false)).map(row => row.id);
    const allIdsStr = allIds.map(id => `  ${id}\n`);

    const exists = {
      message: () => `expected '${docId}' to not be present in the database\n\nIDs present: \n${allIdsStr}`,
      pass: true,
    };
    const absent = {
      message: () => `expected '${docId}' to be present in the database\n\nIDs present: \n${allIdsStr}`,
      pass: false,
    };

    if (allIds.includes(docId)) {
      return exists;
    } else {
      return absent;
    }
  },
});
