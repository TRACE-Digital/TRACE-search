/**
 * @fileoverview Utilities for interacting with PouchDB.
 *
 * Had to add the following to tsconfig.json to import PouchDB:
 * "compilerOptions": {
 *   "allowSyntheticDefaultImports": true
 * }
 */
import PouchDB from 'pouchdb';
// @ts-ignore
import CryptoPouch from 'crypto-pouch';
import { isNode, isJsDom, isBrowser } from 'browser-or-node';
import { doMigrations } from './migrations';
import { BUILD_TYPE } from 'meta';
import { DbCache } from './cache';
import { CognitoUserPartial } from './aws-amplify';
import { Search, SearchDefinition, ThirdPartyAccount } from 'search';
import { AccountSchema, ProfilePageSchema, SearchDefinitionSchema, SearchSchema } from './schema';
import { ProfilePage } from 'profile';

PouchDB.plugin(CryptoPouch);

let _localDb: PouchDB.Database | null = null;
let _remoteDb: PouchDB.Database | null = null;
let _remoteUser: CognitoUserPartial | undefined;
let _replicator: PouchDB.Replication.Replication<any> | null = null;

export const ENCRYPTION_KEY = 'thisisatestthatdoesntreallymatterfornow';

export const DB_NAME = 'trace';
export const DB_OPTIONS: PouchDB.Configuration.LocalDatabaseConfiguration = {};
export const REMOTE_DB_BASE_URL = 'https://couch.api.tracedigital.tk/all';
export const REMOTE_AUTH_HEADER_NAME = 'auth-token';
export const REMOTE_DB_DEFAULT_ID = 'trace';
export const REMOTE_DB_OPTIONS: PouchDB.Configuration.RemoteDatabaseConfiguration = {};

// Don't mess with the filesystem when we're testing
// Assume that the test suite will add the pouchdb-adapter-memory for us
if (BUILD_TYPE === 'test') {
  DB_OPTIONS.adapter = 'memory';
  REMOTE_DB_OPTIONS.adapter = 'memory';
  console.log(`Using in-memory database '${DB_NAME}' for BUILD_TYPE === '${BUILD_TYPE}'`);
}

if (ENCRYPTION_KEY.length === 0) {
  console.warn('No encryption key defined for PouchDB/CouchDB encryption!');
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
 * Set the remote user that will be used to connect to
 * the remote database.
 */
export const setRemoteUser = async (cognitoUser: CognitoUserPartial) => {
  if (_remoteUser?.attributes.sub === cognitoUser.attributes.sub) {
    console.debug(`Remote user was already set to '${cognitoUser.attributes.sub}'.`);
    return;
  }

  const open = _remoteDb;
  const replicating = _remoteDb && _replicator;

  if (replicating) {
    await teardownReplication();
  }
  if (open) {
    await closeRemoteDb();
  }

  _remoteUser = cognitoUser;

  if (replicating) {
    await setupReplication();
  }
  if (open) {
    await getRemoteDb();
  }
};

/**
 * Initialize or return the remote database instance (i.e. CouchDB).
 *
 * Passing `userId` sets the
 */
export const getRemoteDb = async () => {
  if (_remoteDb) {
    return _remoteDb;
  }

  const token = _remoteUser?.signInUserSession.idToken.jwtToken || '';
  if (token.length === 0) {
    console.warn('User is not set or does not have a token!');
  }

  const dbUrl = REMOTE_DB_BASE_URL;
  const options = {...REMOTE_DB_OPTIONS};
  options.fetch = (url, opts) => {
    opts = opts || {};
    opts.headers = new Headers(opts.headers);
    opts.headers.set(REMOTE_AUTH_HEADER_NAME, token);

    return PouchDB.fetch(url, opts);
  }

  console.debug(options);

  try {
    console.log(`Connecting to remote database ${dbUrl}...`);
    _remoteDb = new PouchDB(
      dbUrl,
      options
    );
    // @ts-ignore
    await _remoteDb.crypto(ENCRYPTION_KEY);
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

  DbCache.clear();
};

/**
 * Remove all data from the remote database.
 *
 * TODO: Figure out how to propagate this to any other synced devices
 * and to fully remove the old documents from the CouchDB instance
 */
export const resetRemoteDb = async () => {
  const db = await getRemoteDb();
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
    console.debug('Remote database was not open');
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
    // @ts-ignore
    await _localDb.crypto(ENCRYPTION_KEY);
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

  // Register for the change feed to keep everything updated
  // Updates made in other tabs should appear via this feed
  // Updates made to the remote database via replication should also appear
  // _localDb.changes({
  //   since: 'now',
  //   live: true,
  //   include_docs: true,
  // }).on('change', async (change) => {
  //   if (change.deleted) {
  //     DbCache.remove(change.id);
  //   } else {
  //     if (change.doc === undefined) {
  //       console.error(`Change did not contain key 'doc'. Did you pass 'include_docs: true'?`);
  //       return;
  //     }

  //     // Deserialize onto the object already in the cache or create a new object
  //     if (change.id.startsWith('account')) {
  //       console.debug(`Change '${change.id}' matched account`);
  //       const existing = ThirdPartyAccount.accountCache.get(change.id);
  //       await ThirdPartyAccount.deserialize(change.doc as AccountSchema, existing);
  //     } else if (change.id.match('^searchDef/.*/searchResult')) {
  //       console.debug(`Change '${change.id}' matched searchResult`);
  //       const existing = ThirdPartyAccount.resultCache.get(change.id);
  //       await ThirdPartyAccount.deserialize(change.doc as AccountSchema, existing);
  //     } else if (change.id.match('^searchDef/.*/search')) {
  //       console.debug(`Change '${change.id}' matched search`);
  //       const existing = Search.cache.get(change.id);
  //       await Search.deserialize(change.doc as SearchSchema, existing);
  //     } else if (change.id.match('^searchDef')) {
  //       console.debug(`Change '${change.id}' matched search definition`);
  //       const existing = SearchDefinition.cache.get(change.id);
  //       await SearchDefinition.deserialize(change.doc as SearchDefinitionSchema, existing);
  //     } else if (change.id.match('^profile')) {
  //       console.debug(`Change '${change.id}' matched profile page`);
  //       const existing = ProfilePage.cache.get(change.id);
  //       await ProfilePage.deserialize(change.doc as ProfilePageSchema, existing);
  //     } else {
  //       console.warn(`Change '${change.id}' did not match any cache!`);
  //     }
  //   }
  // }).on('error', (e) => {
  //   console.error('Change feed error:')
  //   console.error(e);
  // }).on('complete', () => {
  //   console.log('Change feed complete');
  // });

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
      .on('change', changes => {
        console.log('Replication changes');
        console.log(changes);
      })
      .on('denied', info => {
        console.warn('Replication denied!');
        console.warn(info);
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

  DbCache.clear();
}
