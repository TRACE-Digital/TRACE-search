/**
 * @fileoverview Utilities for interacting with PouchDB.
 *
 * Had to add the following to tsconfig.json to import PouchDB:
 * "compilerOptions": {
 *   "allowSyntheticDefaultImports": true
 * }
 */
import PouchDB from 'pouchdb';
import { isNode, isJsDom, isBrowser } from 'browser-or-node';
import { doMigrations } from './migrations';

let _localDb: PouchDB.Database | null = null;
let _remoteDb: PouchDB.Database | null = null;
_remoteDb = null;

export const DB_NAME = 'trace';

export async function getDb() {
  if (_localDb) {
    return _localDb;
  }
  return await setupDb();
}

/**
 * Initializes or returns the PouchDB instance.
 */
async function setupDb() {
  if (_localDb) {
    return _localDb;
  }

  // If you need a fresh db
  await _devNukeDb();

  console.debug(`Browser: ${isBrowser} \nNode: ${isNode} \nJSDOM: ${isJsDom()}`);

  _localDb = new PouchDB(DB_NAME);
  console.debug(_localDb);

  // Typing module doesn't have .adapter since its unofficial, but you can
  // check what it is in the other log output
  // console.log(`PouchDB using adapter: ${_localDb.adapter}`);

  try {
    const localInfo = await _localDb.info();
    console.debug('Local database information:');
    console.debug(localInfo);
  } catch (e) {
    console.error(`Could not get local database information!`);
    throw e;
  }

  try {
    await doMigrations(_localDb);
  } catch (e) {
    console.error('Database migrations failed!');
    throw e;
  }

  return _localDb;
}

/**
 * Nuke the database.
 */
export async function _devNukeDb(dbName: string = DB_NAME) {
  if (_localDb && _localDb.name === dbName) {
    await _localDb.destroy();
    _localDb = null;
  } else {
    const db = new PouchDB(dbName);
    await db.destroy();
  }
}
