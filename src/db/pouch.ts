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
import { BUILD_TYPE } from 'meta';
import { accounts, searchDefinitions, searches } from 'search';

let _localDb: PouchDB.Database | null = null;
let _remoteDb: PouchDB.Database | null = null;
let _replicator: PouchDB.Replication.Replication<any> | null = null;

export const DB_NAME = 'trace';
export const DB_OPTIONS: PouchDB.Configuration.LocalDatabaseConfiguration = {};
export const REMOTE_DB = 'https://couchdb.tracedigital.tk:6984/trace';
export const REMOTE_DB_PASSWORD = '';

if (REMOTE_DB_PASSWORD.length === 0) {
  throw new Error('Fill out the database password in pouch.ts');
}

// Don't mess with the filesystem when we're testing
// Assume that the test suite will add the pouchdb-adapter-memory for us
if (BUILD_TYPE === 'test') {
  DB_OPTIONS.adapter = 'memory';
  console.log(`Using in-memory database '${DB_NAME}' for BUILD_TYPE === '${BUILD_TYPE}'`);
}

export async function getDb() {
  if (_localDb) {
    return _localDb;
  }
  return await setupDb();
}

/**
 * Remove all data in the database.
 */
export async function clearDb() {
  await _devNukeDb();
  console.log('Cleared database');
}

/**
 * Initializes or returns the PouchDB instance.
 */
async function setupDb() {
  if (_localDb) {
    return _localDb;
  }

  // If you need a fresh db
  // await _devNukeDb();

  console.debug(`Browser: ${isBrowser} \nNode: ${isNode} \nJSDOM: ${isJsDom()}`);

  _localDb = new PouchDB(DB_NAME, DB_OPTIONS);
  if (BUILD_TYPE !== 'test') console.debug(_localDb);

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
 * Setup replication to and from the remote CouchDB server.
 */
export async function setupReplication() {
  if (_remoteDb && _replicator) {
    console.log('Replication already setup');
    return;
  }

  console.log('Setting up replication...');

  const localDb = await getDb();
  let remoteDb;
  try {
    remoteDb = new PouchDB(REMOTE_DB, {
      auth: {
        username: 'admin',
        password: REMOTE_DB_PASSWORD,
      }
    });
  } catch (e) {
    throw new Error('Could not connect to CouchDB!');
  }

  console.log('Connected to remote database');

  let replicator;
  try {
    replicator = localDb.replicate.to(remoteDb, {
      live: true,
      since: 0
    }).on('active', () => {
      console.log('Replication is active');
    }).on('paused', (info) => {
      console.log('Replication is paused');
      console.log(info);
    }).on('denied', (info) => {
      console.warn('Replication denied!');
      console.warn(info);
    }).on('change', (change) => {
      console.log('Replicating change...');
    }).on('complete', (info) => {
      console.log('Replication complete');
      console.log(info);
    }).on('error', (e) => {
      console.error('Replication error!');
      console.error(e);
    });
  } catch (e) {
    throw new Error('Could not replicate to CouchDB!');
  }

  console.log('Replication setup');

  _remoteDb = remoteDb;
  _replicator = replicator;

  // Return as an object because something with the Promises gets messed up
  return { 'TODO_replication': _replicator }
}

/**
 * Stop replication.
 */
export async function teardownReplication() {
  console.log('Tearing down replication...');

  const remoteDb = _remoteDb;
  _remoteDb = null;

  try {
    if (_replicator) {
      _replicator.cancel();
      _replicator = null;
      console.log('Cancelled replication');
    }
  } catch (e) {
    console.error('Could not cancel replication');
    console.error(e);
  }

  if (remoteDb) {
    try {
      const result = await remoteDb.allDocs();
      result.rows.map(async (row) => {
        await remoteDb.remove(row.id, row.value.rev);
      });
      console.log('Cleaned remote database');
    } catch (e) {
      console.error('Could not clean up remote database');
      console.error(e);
    }

    try {
      await remoteDb.close();
      console.log('Closed remote database');
    } catch (e) {
      console.error('Could not close remote database');
      console.error(e);
    }
  }
}

/**
 * Nuke the database.
 */
export async function _devNukeDb(dbName: string = DB_NAME) {
  if (_localDb && _localDb.name === dbName) {
    await _localDb.destroy();
    _localDb = null;
  } else {
    const db = new PouchDB(dbName, DB_OPTIONS);
    await db.destroy();
  }

  // Clear the caches as well
  for (const cache of [accounts, searches, searchDefinitions]) {
    for (const prop of Object.getOwnPropertyNames(cache)) {
      delete cache[prop];
    }
  }
}
