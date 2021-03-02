import { getDb, PouchDbId } from 'db';

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

    const exists = {
      message: () => `expected '${id}' to be present in the database`,
      pass: true,
    };
    const absent = {
      message: () => `expected '${id}' to be present in the database`,
      pass: false,
    };

    if (this.isNot) {
      exists.pass = !exists.pass;
      absent.pass = !absent.pass;
    }

    try {
      await db.get(id);
      return exists;
    } catch (e) {
      return absent;
    }
  },
});
