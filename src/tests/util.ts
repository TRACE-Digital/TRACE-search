import { BaseSchema, getDb, IDbStorable } from 'db';

export const dumpAllDocs = async (includeDocs = false) => {
  const db = await getDb();

  const result = await db.allDocs({
    include_docs: includeDocs,
  });

  return result.rows;
};

export const checkSaveResponse = (response: PouchDB.Core.Response, item: IDbStorable) => {
  expect(response).toBeDefined();
  expect(response.ok).toBeTruthy();
  expect(response.id).toEqual(item.id);

  expect(item.rev).toEqual(response.rev);
};

/**
 * Return a promise that resolves when `doc` is observed in the database's
 * sync events.
 *
 * Awaiting this is useful to prevent the test from ending before the doc
 * syncs.
 */
export const waitForDoc = async (sync: PouchDB.Replication.Sync<any>, doc: PouchDB.Core.IdMeta) => {
  return new Promise<void>((resolve, reject) => {
    sync.on('change', async syncEvent => {
      // Find our doc
      let found = null;
      for (const changedDoc of syncEvent.change.docs) {
        const resolvedChangedDoc = await changedDoc;
        if (resolvedChangedDoc._id === doc._id) {
          found = true;
          break;
        }
      }

      // Complete the promise
      if (found) {
        resolve();
      }
    });
  });
};

/**
 * Return a promise that resolves when the database fires the
 * `eventName` event.
 *
 * Awaiting this is useful to prevent the test from ending the db wraps up.
 *
 * Event types from `@types\pouchdb-replication\index.d.ts`.
 */
export const waitForSyncState = async (
  sync: PouchDB.Replication.Sync<any>,
  eventName: 'change' | 'paused' | 'denied' | 'error' | 'active' | 'complete',
) => {
  const eventNameNoType = eventName as any;
  return new Promise<void>((resolve, reject) => {
    sync.on(eventNameNoType, () => {
      resolve();
    });
  });
};
