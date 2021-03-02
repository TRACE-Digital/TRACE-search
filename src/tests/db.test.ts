import PouchDB from 'pouchdb';
import { BaseSchema, DEFAULT_SETTINGS, getDb, ID_SEPARATOR, PouchDbId, SETTINGS_KEY, toId, _devNukeDb } from 'db';
import { doMigrations } from 'db/migrations';
import { VERSION } from 'meta';

describe('PouchDB', () => {
  let db: PouchDB.Database;

  beforeAll(async () => {
    await _devNukeDb();
  });

  beforeEach(async () => {
    db = await getDb();
  });

  it('does migrations', async () => {
    const rawDb = new PouchDB('db.test.ts');
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

describe('Database ID', () => {
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
