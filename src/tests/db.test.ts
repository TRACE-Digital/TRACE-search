import PouchDB from 'pouchdb';
import {
  BaseSchema,
  DEFAULT_SETTINGS,
  getDb,
  ID_SEPARATOR,
  DB_OPTIONS,
  SETTINGS_KEY,
  toId,
  setupReplication,
  teardownReplication,
  getRemoteDb,
  closeDb,
  resetDb,
  resetRemoteDb,
  closeRemoteDb,
  setRemoteUser,
  getEncryptionKey,
  generateEncryptionKey,

} from 'db';
import { doMigrations } from 'db/migrations';
import { VERSION } from 'meta';
import { CognitoUserPartial } from 'db/aws-amplify';
import { waitForDoc, waitForSyncState } from './util';

const COGNITO_USER1: CognitoUserPartial = {
  attributes: {
    sub: '01-test-user-id',
    email: 'test123@example.test',
    email_verified: false,
  },
  signInUserSession: {
    idToken: {
      jwtToken: 'hello',
      payload: {
        sub: '01-test-user-id',
      },
    },
  },
};
const COGNITO_USER2: CognitoUserPartial = {
  attributes: {
    sub: '02-test-user-id',
    email: 'notTest123@example.test',
    email_verified: false,
  },
  signInUserSession: {
    idToken: {
      jwtToken: 'hello2222',
      payload: {
        sub: '02-test-user-id',
      },
    },
  },
};

generateEncryptionKey("testing123", COGNITO_USER1.attributes.sub)

describe('PouchDB', () => {
  let db: PouchDB.Database;

  beforeEach(async () => {
    db = await getDb();
    await resetDb();
  });

  it('opens', async () => {
    expect(db).toBeDefined();
  });

  it('is a singleton', async () => {
    const db2 = await getDb();
    expect(db2).toBe(db);
  });

  it('closes', async () => {
    await closeDb();
    const db2 = await getDb();
    expect(db2).not.toBe(db);
  });

  it('does migrations', async () => {
    const rawDb = new PouchDB('db.test.ts', DB_OPTIONS);
    // @ts-ignore
    await rawDb.crypto(getEncryptionKey());
    await doMigrations(rawDb);
  });

  it('has settings', async () => {
    await expect(SETTINGS_KEY).toBeInDatabase(db);
    console.log(await db.allDocs());
  });

  it('has a matching version', async () => {
    const settings = await db.get<typeof DEFAULT_SETTINGS>(SETTINGS_KEY);
    expect(settings.version).toEqual(VERSION);
  });

  it('stores and retrieves', async () => {
    const id = 'this is a test';
    const doc: BaseSchema = {
      _id: id,
      _rev: '',
    };

    const result = await db.put(doc);
    expect(result.ok).toBeTruthy();

    doc._rev = result.rev;

    const retrievedDoc = await db.get(id);
    expect(retrievedDoc).toEqual(doc);
  });
});

describe('Database IDs', () => {
  const PREFIX = 'prefix1';
  const ID_SINGLE = ['test'];
  const ID_MULTI = ['test1', 'test2', 'test3'];

  it('accepts single word', () => {
    const id = toId(ID_SINGLE);
    expect(id).toEqual(ID_SINGLE[0]);
    expect(id).not.toContain(ID_SEPARATOR);
  });

  it('accepts multiple words', () => {
    const id = toId(ID_MULTI);

    expect(id).toContain(ID_SEPARATOR);

    for (const idPart of ID_MULTI) {
      expect(id).toContain(idPart);
    }
  });

  it('accepts a prefix', () => {
    let id = toId(ID_SINGLE, PREFIX);
    expect(id.startsWith(PREFIX)).toBeTruthy();

    id = toId(ID_MULTI, PREFIX);
    expect(id.startsWith(PREFIX)).toBeTruthy();
  });

  it('does not start with a separator', () => {
    const id = toId(ID_MULTI);
    expect(id.startsWith(ID_SEPARATOR)).toBeFalsy();
  });

  it('does not end with a separator', () => {
    const id = toId(ID_MULTI);
    expect(id.endsWith(ID_SEPARATOR)).toBeFalsy();
  });
});

describe('Remote Connection', () => {
  beforeEach(async () => {
    await setRemoteUser(COGNITO_USER1);
    await resetRemoteDb();
  });

  it('opens', async () => {
    const db = await getRemoteDb();
    expect(db).toBeDefined();
  });

  it('is a singleton', async () => {
    const obj = await getRemoteDb();
    const obj2 = await getRemoteDb();
    expect(obj2).toBe(obj);
  });

  it('accepts a remote user', async () => {
    const db = await getRemoteDb();
    expect(db.name).toContain(COGNITO_USER1.attributes.sub);
  });

  it('keeps the same instance for duplicate calls to setRemoteUser', async () => {
    await setRemoteUser(COGNITO_USER1);
    const db = await getRemoteDb();
    await setRemoteUser(COGNITO_USER1);
    const db2 = await getRemoteDb();
    expect(db2).toBe(db);
  });

  it('doest not open database when setting user', async () => {
    // beforeEach resetRemoteDb() will have already opened it
    await closeRemoteDb();
    await setRemoteUser(COGNITO_USER2);
  });

  it.skip('invalidates the singleton on switch of user ID', async () => {
    const obj = await getRemoteDb();

    await setRemoteUser(COGNITO_USER2);
    const obj2 = await getRemoteDb();
    expect(obj2).not.toBe(obj);
    expect(obj2.name).toContain(COGNITO_USER2.attributes.sub);
  });

  it.skip('closes', async () => {
    const db = await getRemoteDb();
    await closeRemoteDb();
    // const db2 = await getRemoteDb();
    // expect(db2).not.toBe(db);
  });
});

describe('Memory <=> Memory Sync', () => {
  beforeEach(async () => {
    await setRemoteUser(COGNITO_USER1);
    await resetDb();
    await resetRemoteDb();
  });

  it('completes setup', async () => {
    const rep = await setupReplication();
    expect(rep.TODO_replication).toBeDefined();
  });

  it('is a singleton', async () => {
    const rep = await setupReplication();
    const rep2 = await setupReplication();
    expect(rep.TODO_replication).toBe(rep2.TODO_replication);
  });

  it('completes tear down', async () => {
    const rep = await setupReplication();
    await teardownReplication();
  });

  it('syncs with a new document', async () => {
    const db = await getDb();
    const remoteDb = await getRemoteDb();

    const obj = await setupReplication();
    const sync = obj.TODO_replication;
    const doc = { _id: 'sync test', test: 'test' };

    const docWasSynced = waitForDoc(sync, doc);

    await db.put(doc);
    await docWasSynced;

    const retrievedLocalDoc = await db.get(doc._id);
    const retrievedRemoteDoc = await remoteDb.get(doc._id);
    expect(retrievedRemoteDoc).toMatchObject(doc);
    expect(retrievedRemoteDoc).toEqual(retrievedLocalDoc);

    const completed = waitForSyncState(sync, 'complete');

    await teardownReplication();
    await completed;
  });

  it('syncs document updates', async () => {
    const db = await getDb();
    const remoteDb = await getRemoteDb();

    const obj = await setupReplication();
    const sync = obj.TODO_replication;
    const doc = { _id: 'sync test', test: 'test' };

    let docWasSynced = waitForDoc(sync, doc);

    await db.put(doc);
    await docWasSynced;

    // Get the doc since we need the revision number
    const updatedDoc = await db.get<typeof doc>(doc._id);
    updatedDoc.test = `test ${new Date().toJSON()}`;

    docWasSynced = waitForDoc(sync, updatedDoc);
    await db.put(updatedDoc);
    await docWasSynced;

    const retrievedLocalDoc = await db.get(doc._id);
    const retrievedRemoteDoc = await remoteDb.get(doc._id);
    expect(retrievedRemoteDoc).toEqual(retrievedLocalDoc);

    const completed = waitForSyncState(sync, 'complete');

    await teardownReplication();
    await completed;
  });

  it('syncs deletions', async () => {
    const db = await getDb();
    const remoteDb = await getRemoteDb();

    const obj = await setupReplication();
    const sync = obj.TODO_replication;
    const doc = { _id: 'sync test', test: 'test' };

    let docWasSynced = waitForDoc(sync, doc);

    await db.put(doc);
    await docWasSynced;

    // Get the doc since we need the revision number
    const updatedDoc = await db.get<typeof doc & BaseSchema>(doc._id);

    // Assume the deleted flag gets set
    updatedDoc._deleted = true;

    docWasSynced = waitForDoc(sync, updatedDoc);
    await db.remove(updatedDoc);
    await docWasSynced;

    await expect(remoteDb.get(doc._id)).rejects.toThrow('missing');

    const completed = waitForSyncState(sync, 'complete');

    await teardownReplication();
    await completed;
  });
});
