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
  ENCRYPTION_KEY,
  setRemoteUser,
} from 'db';
import { doMigrations } from 'db/migrations';
import { VERSION } from 'meta';
import { CognitoUserPartial } from 'db/aws-amplify';

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
    await rawDb.crypto(ENCRYPTION_KEY);
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

describe('Remote DB', () => {
  const USER1: CognitoUserPartial = {
    attributes: {
      sub: 'test123',
      email: 'test123@example.test',
      email_verified: false,
    },
    signInUserSession: {
      idToken: {
        jwtToken: 'hello',
        payload: {
          sub: 'test123'
        },
      },
    },
  };
  const USER2: CognitoUserPartial = {
    attributes: {
      sub: 'notTest123',
      email: 'notTest123@example.test',
      email_verified: false,
    },
    signInUserSession: {
      idToken: {
        jwtToken: 'hello2222',
        payload: {
          sub: 'notTest123'
        },
      },
    },
  };

  beforeEach(async () => {
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
    await setRemoteUser(USER1);
    const db = await getRemoteDb();
    expect(db.name).toContain(USER1.attributes.sub);
  });

  it('invalidates the singleton on switch of user ID', async () => {
    await setRemoteUser(USER1);
    const obj = await getRemoteDb();

    await setRemoteUser(USER2);
    const obj2 = await getRemoteDb();
    expect(obj2).not.toBe(obj);
  });

  it('closes', async () => {
    const db = await getRemoteDb();
    await closeRemoteDb();
    const db2 = await getRemoteDb();
    expect(db2).not.toBe(db);
  });
});

describe('Memory <=> Memory Sync', () => {
  beforeEach(async () => {
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

  it('does sync', async () => {
    const db = await getDb();
    const remoteDb = await getRemoteDb();

    const obj = await setupReplication();
    const replicator = obj.TODO_replication;
    const doc = { _id: 'sync test', test: 'test ' };

    // Need to wait for db events to fire some time in the future
    // Create a promise that we can await so that the test doesn't end
    const finished = new Promise((resolve, reject) => {
      replicator
        .on('change', async change => {
          expect(change.docs.length).toBeGreaterThan(0);

          // Find our doc
          let found = null;
          for (const changedDoc of change.docs) {
            const resolvedChangedDoc = await changedDoc;
            if (resolvedChangedDoc._id === doc._id) {
              found = await remoteDb.get(resolvedChangedDoc._id);
              console.log(found);
              break;
            }
          }

          expect(found).not.toBeNull();

          // Compare our subset of the object's properties
          // _rev will have been added by PouchDB
          expect(found).toMatchObject(doc);
        })
        .on('paused', async () => {
          // Make sure the doc made it into the remote database
          const retrievedDoc = await remoteDb.get(doc._id);

          expect(retrievedDoc).toMatchObject(doc);

          // Complete the promise
          resolve(true);
        });
    });

    await db.put(doc);

    const result = await finished;
    expect(result).toBeTruthy();
  });
});
