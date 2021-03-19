/**
 * @fileoverview Utilities for interacting with PouchDB.
 *
 * Had to add the following to tsconfig.json to import PouchDB:
 * "compilerOptions": {
 *   "allowSyntheticDefaultImports": true
 * }
 */
import PouchDB from 'pouchdb';
import CryptoPouch from 'crypto-pouch';
import { isNode, isJsDom, isBrowser } from 'browser-or-node';
import { doMigrations } from './migrations';
import { BUILD_TYPE } from 'meta';
import { accounts, searchDefinitions, searches } from 'search';

PouchDB.plugin(CryptoPouch);

let _localDb: PouchDB.Database | null = null;
let _remoteDb: PouchDB.Database | null = null;
let _replicator: PouchDB.Replication.Replication<any> | null = null;

const ENCRYPTION_PASSWORD = ""

export const DB_NAME = 'trace';
export const DB_OPTIONS: PouchDB.Configuration.LocalDatabaseConfiguration = {};
export const REMOTE_DB_URL = 'https://couchdb.tracedigital.tk:6984/trace';
export const REMOTE_DB_OPTIONS: PouchDB.Configuration.RemoteDatabaseConfiguration = {
  auth: {
    username: 'admin',
    password: '',
  },
};

// Don't mess with the filesystem when we're testing
// Assume that the test suite will add the pouchdb-adapter-memory for us
if (BUILD_TYPE === 'test') {
  DB_OPTIONS.adapter = 'memory';
  REMOTE_DB_OPTIONS.adapter = 'memory';
  REMOTE_DB_OPTIONS.auth = REMOTE_DB_OPTIONS.auth || {};
  REMOTE_DB_OPTIONS.auth.password = 'not needed';
  console.log(`Using in-memory database '${DB_NAME}' for BUILD_TYPE === '${BUILD_TYPE}'`);
}

if (ENCRYPTION_PASSWORD.length === 0) {
  console.warn('No encryption password defined for PouchDB/CouchDB encryption!')
}

/**
 * Initialize or return the PouchDB instance.
 */
export const getDb = async () => {
  if (_localDb) {
    return _localDb;
  }
  return await setupDb();
};

/**
 * Initialize or return the remote database instance (i.e. CouchDB).
 */
export const getRemoteDb = async () => {
  if (_remoteDb) {
    return _remoteDb;
  }

  REMOTE_DB_OPTIONS.auth = REMOTE_DB_OPTIONS.auth || {};
  REMOTE_DB_OPTIONS.auth.password = REMOTE_DB_OPTIONS.auth.password || '';
  if (REMOTE_DB_OPTIONS.auth.password.length === 0) {
    console.warn('No remote database password is present!');
  }

  try {
    _remoteDb = new PouchDB(REMOTE_DB_URL, REMOTE_DB_OPTIONS);
    await _remoteDb.crypto(ENCRYPTION_PASSWORD)
  } catch (e) {
    throw new Error(`Could not connect to remote database!: ${e}`);
  }

  try {
    const info = await _remoteDb.info();
    console.debug('Remote database information:');
    console.debug(info);
  } catch (e) {
    console.error(`Could not get remote database information!`);
    throw e;
  }

  return _remoteDb;
};

/**
 * Remove all data in the local database and re-run setup.
 *
 * This also clears the in-memory cache of all objects.
 */
export const resetDb = async () => {
  const db = await getDb();
  await resetDbCommon(db);
  await setupDb();

  clearDbCache();
};

/**
 * Remove all data from the remote database.
 *
 * TODO: Figure out how to propagate this to any other synced devices
 * and to fully remove the old documents from the CouchDB instance
 */
export const resetRemoteDb = async () => {
  const db = await getRemoteDb();
  db
  await resetDbCommon(db);
};

/**
 * Remove all documents in `db`.
 */
const resetDbCommon = async (db: PouchDB.Database) => {
  try {
    const result = await db.allDocs();
    result.rows.map(async row => {
      await db.remove(row.id, row.value.rev);
    });
    console.log('Cleared database');
  } catch (e) {
    throw new Error(`Could not clear database: ${e}`);
  }
};

/**
 * Close the local database connection.
 *
 * This creates a new instance of the singleton
 * on the next call to `getDb()`.
 */
export const closeDb = async () => {
  if (_localDb) {
    await _localDb.close();
    _localDb = null;
    console.log('Closed local database');
  } else {
    console.warn('Local database was not open');
  }
};

/**
 * Close the remote database connection.
 *
 * This creates a new instance of the singleton
 * on the next call to `getRemoteDb()`.
 */
export const closeRemoteDb = async () => {
  if (_remoteDb) {
    await _remoteDb.close();
    _remoteDb = null;
    console.log('Closed remote database');
  } else {
    console.warn('Remote database was not open');
  }
};

/**
 * Initializes the PouchDB instance.
 */
const setupDb = async () => {
  // If you need a fresh db
  // await _devNukeDb();

  console.debug(`Browser: ${isBrowser} \nNode: ${isNode} \nJSDOM: ${isJsDom()}`);

  if (_localDb === null) {
    _localDb = new PouchDB(DB_NAME, DB_OPTIONS);
    console.log("encrypting local db...")
    await _localDb.crypto(ENCRYPTION_PASSWORD)
  }
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
};

/**
 * Setup replication to and from the remote CouchDB server.
 */
export const setupReplication = async () => {
  if (_remoteDb && _replicator) {
    console.log('Replication already setup');
    return { TODO_replication: _replicator };
  }

  console.log('Setting up replication...');

  const localDb = await getDb();
  const remoteDb = await getRemoteDb();

  console.log('Connected to remote database');

  let replicator;
  try {
    replicator = localDb.replicate
      .to(remoteDb, {
        live: true,
        since: 0,
      })
      .on('active', () => {
        console.log('Replication is active');
      })
      .on('paused', info => {
        console.log('Replication is paused');
        console.debug(info);
      })
      .on('denied', info => {
        console.warn('Replication denied!');
        console.warn(info);
      })
      .on('change', change => {
        console.log('Replicating change...');
      })
      .on('complete', info => {
        console.log('Replication complete');
        console.log(info);
      })
      .on('error', e => {
        console.error('Replication error!');
        console.error(e);
      });
  } catch (e) {
    throw new Error('Could not replicate to CouchDB!');
  }

  console.log('Replication setup');

  _replicator = replicator;

  // Return as an object because something with the Promises gets messed up
  return { TODO_replication: _replicator };
};

/**
 * Stop replication.
 */
export const teardownReplication = async () => {
  console.log('Tearing down replication...');

  try {
    if (_replicator) {
      _replicator.cancel();
      _replicator = null;
      console.log('Cancelled replication');
    }
  } catch (e) {
    throw new Error(`Could not cancel replication: ${e}`);
  }

  // TODO: Do this only when a user requests deletion
  // await clearRemoteDb();

  // TODO: Should this go here?
  // await closeRemoteDb();
};

/**
 * Clear the in-memory database caches.
 */
const clearDbCache = () => {
  // Clear the caches as well
  for (const cache of [accounts, searches, searchDefinitions]) {
    for (const prop of Object.getOwnPropertyNames(cache)) {
      delete cache[prop];
    }
  }
};

/**
 * Nuke the database.
 */
async function _devNukeDb(dbName: string = DB_NAME) {
  if (_localDb && _localDb.name === dbName) {
    await _localDb.destroy();
    _localDb = null;
  } else {
    const db = new PouchDB(dbName, DB_OPTIONS);
    await db.destroy();
  }

  clearDbCache();
}
