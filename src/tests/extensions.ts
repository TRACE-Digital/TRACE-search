import { getDb, PouchDbId } from 'db';
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
  async toBeInDatabase(id: PouchDbId, db?: PouchDB.Database) {
    db = db || (await getDb());

    const allIds = (await dumpAllDocs(false)).map(row => row.id);
    const allIdsStr = allIds.map(id => `  ${id}\n`);

    const exists = {
      message: () => `expected '${id}' to not be present in the database\n\nIDs present: \n${allIdsStr}`,
      pass: true,
    };
    const absent = {
      message: () => `expected '${id}' to be present in the database\n\nIDs present: \n${allIdsStr}`,
      pass: false,
    };

    if (allIds.includes(id)) {
      return exists;
    } else {
      return absent;
    }
  },
});
