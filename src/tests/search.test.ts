import { clearDb } from 'db';
import { Search, SearchDefinition, searchDefinitions, searches, SearchState } from 'search';
import { checkSaveResponse } from './util';

const VALID_SITE_NAMES = ['Wikipedia', 'GitHub'];
const INVALID_SITE_NAMES = ['xxx not a site'];

beforeEach(async () => {
  await clearDb();
});

describe('search definition', () => {
  it('constructs with no args', () => {
    const searchDef = new SearchDefinition();
    expect(searchDef).toBeDefined();

    expect(searchDef.name).toBeDefined();
    expect(searchDef.includedSites).toBeDefined();

    expect(searchDef.includedSites.length).toBeGreaterThan(0);
  });

  /**
   * TODO: This won't hold across page reloads. Definitions
   * restored from the database can have a non-unique name.
   */
  it('it generates unique names within the same session', () => {
    const searchDef = new SearchDefinition();
    const searchDef2 = new SearchDefinition();

    expect(searchDef.name).not.toStrictEqual(searchDef2.name);
  });

  it('accepts a name', () => {
    const name = 'Test Search';
    const searchDef = new SearchDefinition(name);

    expect(searchDef.name).toStrictEqual(name);
    expect(searchDef.serialize().name).toStrictEqual(name);
  });

  it('accepts an empty subset of sites', () => {
    const searchDef = new SearchDefinition(undefined, []);
    expect(searchDef.includedSites).toHaveLength(0);
  });

  it('accepts a subset of all sites', () => {
    const siteNames = VALID_SITE_NAMES;
    const searchDef = new SearchDefinition(undefined, siteNames);

    for (const siteName of siteNames) {
      expect(searchDef.includedSites).toContainEqual(expect.objectContaining({ name: siteName }));
    }

    expect(searchDef.includedSites).toHaveLength(siteNames.length);
    expect(searchDef.serialize().includedSiteNames).toStrictEqual(siteNames);
  });

  it('ignores invalid sites', () => {
    let siteNames: string[] = [];
    siteNames = siteNames.concat(INVALID_SITE_NAMES).concat(VALID_SITE_NAMES);

    // Constructor should warn that it couldn't find the invalid sites
    console.warn = jest.fn();
    const searchDef = new SearchDefinition(undefined, siteNames);
    expect(console.warn).toBeCalledTimes(INVALID_SITE_NAMES.length);

    for (const siteName of VALID_SITE_NAMES) {
      expect(searchDef.includedSites).toContainEqual(expect.objectContaining({ name: siteName }));
    }

    expect(searchDef.includedSites).not.toContainEqual(undefined);
    for (const siteName of INVALID_SITE_NAMES) {
      expect(searchDef.includedSites).not.toContainEqual(expect.objectContaining({ name: siteName }));
    }

    expect(searchDef.includedSites).toHaveLength(VALID_SITE_NAMES.length);
    expect(searchDef.serialize().includedSiteNames).toStrictEqual(VALID_SITE_NAMES);
  });

  it('serializes first names, last names, and user names', () => {
    const name = 'Test Search';
    const siteNames = VALID_SITE_NAMES;
    const searchDef = new SearchDefinition(name, siteNames);

    searchDef.firstNames.push('Bob');
    searchDef.lastNames.push('Alice');
    searchDef.userNames.push('balice');

    const serialized = searchDef.serialize();

    expect(serialized.firstNames).toStrictEqual(searchDef.firstNames);
    expect(serialized.lastNames).toStrictEqual(searchDef.lastNames);
    expect(serialized.userNames).toStrictEqual(searchDef.userNames);
  });

  it('sets its date/times', () => {
    const searchDef = new SearchDefinition();

    expect(searchDef.createdAt).toBeDefined();
    expect(searchDef.lastEditedAt).toBeDefined();
  });

  it('returns only completed searches', async () => {
    const searchDef = new SearchDefinition(undefined, []);
    const search1 = await searchDef.new();
    const search2 = await searchDef.new();

    search1.state = SearchState.COMPLETED;

    expect(searchDef.completedHistory).toHaveLength(1);
    expect(searchDef.completedHistory[0]).toBe(search1);
  });

  it('handles requests for lastRun with 0 runs', () => {
    const searchDef = new SearchDefinition();

    expect(searchDef.lastRun).toBeNull();
    expect(searchDef.lastRunAt).toBeNull();
  });

  it('returns the last started search execution', async () => {
    const searchDef = new SearchDefinition(undefined, []);
    const search = await searchDef.new();

    search.state = SearchState.COMPLETED;
    search.startedAt = new Date();

    expect(searchDef.lastRun).toBe(search);
    expect(searchDef.lastRunAt).toBe(search.startedAt);
  });

  it('deserializes without search history', async () => {
    const searchDef = new SearchDefinition('Test Search', VALID_SITE_NAMES);
    searchDef.firstNames.push('Bob');
    searchDef.lastNames.push('Alice');
    searchDef.userNames.push('balice');

    const serialized = searchDef.serialize();
    const deserialized = await SearchDefinition.deserialize(serialized);

    expect(deserialized).toEqual(searchDef);
    expect(deserialized.serialize()).toEqual(serialized);
  });

  it('saves', async () => {
    const searchDef = new SearchDefinition(undefined, VALID_SITE_NAMES);
    let lastRev = searchDef.rev;

    const result = await searchDef.save();

    checkSaveResponse(result, searchDef);

    expect(searchDef.rev).not.toEqual(lastRev);
    lastRev = result.rev;

    // Save should put it in the cache
    expect(searchDefinitions[searchDef.id]).toBe(searchDef);
  });

  it('saves multiple times', async () => {
    const searchDef = new SearchDefinition(undefined, VALID_SITE_NAMES);
    let lastRev = searchDef.rev;

    for (let i = 0; i < 2; i++) {
      const result = await searchDef.save();

      checkSaveResponse(result, searchDef);

      expect(searchDef.rev).not.toEqual(lastRev);
      lastRev = searchDef.rev;

      // Save should put it in the cache
      expect(searchDefinitions[searchDef.id]).toBe(searchDef);
    }
  });

  it('produces a new search', async () => {
    const searchDef = new SearchDefinition(undefined, VALID_SITE_NAMES);
    const search = await searchDef.new();

    expect(search).toBeDefined();
    expect(search.definition).toBe(searchDef);
    expect(search.id).toContain(searchDef.id);

    expect(searchDef.history).toHaveLength(1);
    expect(searchDef.history).toContain(search);
  });

  it('deserializes with history', async () => {
    const searchDef = new SearchDefinition(undefined, VALID_SITE_NAMES);
    const search = await searchDef.new();

    await searchDef.save();

    const serialized = searchDef.serialize();
    const deserialized = await SearchDefinition.deserialize(serialized);

    expect(deserialized).toEqual(searchDef);
    expect(deserialized.serialize()).toEqual(serialized);
  });

  it('is stored in the cache during deserialization', async () => {
    const searchDef = new SearchDefinition(undefined, VALID_SITE_NAMES);

    // TODO: Figure out how newly created definitions will end up in the cache
    // It's possible that the changes feed will trigger on .save()
    await SearchDefinition.deserialize(searchDef.serialize());

    expect(searchDefinitions[searchDef.id]).toEqual(searchDef);
  });

  it('is stored in the cache during loadAll', async () => {
    const searchDef = new SearchDefinition(undefined, VALID_SITE_NAMES);
    await searchDef.save();

    expect(searchDefinitions).not.toContainEqual(searchDef);

    const results = await SearchDefinition.loadAll();

    expect(results).toContainEqual(searchDef);
    expect(searchDefinitions[searchDef.id]).toEqual(searchDef);
  });
});

describe('search', () => {
  let definition: SearchDefinition;

  beforeEach(async () => {
    definition = new SearchDefinition(undefined, VALID_SITE_NAMES);
    await definition.save();

    await expect(definition.id).toBeInDatabase();
  });

  it('constructs', () => {
    const search = new Search(definition);
    expect(search).toBeDefined();
  });

  it('constructs from SearchDefinition.new()', async () => {
    const search = await definition.new();
    expect(search).toBeDefined();
    expect(search.id).toContain(definition.id);
  });

  it('calculates progress correctly with no sites', async () => {
    const searchDef = new SearchDefinition('Test search', []);
    searchDef.userNames.push('test');

    const search = await searchDef.new();
    expect(search.progress).toEqual(100);

    await search.start();
    expect(search.progress).toEqual(100);
  });

  it('calculates progress correctly with no user names', async () => {
    const searchDef = new SearchDefinition('Test search', VALID_SITE_NAMES);

    const search = await searchDef.new();
    expect(search.progress).toEqual(100);

    await search.start();
    expect(search.progress).toEqual(100);
  });

  it('calculates progress correctly with no sites or usernames', async () => {
    const searchDef = new SearchDefinition('Test search', []);

    const search = await searchDef.new();
    expect(search.progress).toEqual(100);

    await search.start();
    expect(search.progress).toEqual(100);
  });

  it('calculates progress correctly with multiple user names and sites', async () => {
    jest.setTimeout(10000);

    const searchDef = new SearchDefinition('Test search', VALID_SITE_NAMES.slice(0, 2));
    searchDef.userNames.push('test');
    searchDef.userNames.push('test2');

    const search = await searchDef.new();
    expect(search.progress).toEqual(0);

    await search.start();
    expect(search.progress).toEqual(100);
  });

  it('saves automatically when created', async () => {
    const search = await definition.new();

    expect(search.rev.length).toBeGreaterThan(0);
    await expect(search.id).toBeInDatabase();
  });

  it('saves', async () => {
    const search = await definition.new();
    let lastRev = search.rev;

    const result = await search.save();

    checkSaveResponse(result, search);

    expect(search.rev).not.toEqual(lastRev);
    lastRev = result.rev;

    // Save should put it in the cache
    expect(searches[search.id]).toBe(search);
  });

  it('saves multiple times', async () => {
    const search = await definition.new();
    let lastRev = search.rev;

    for (let i = 0; i < 2; i++) {
      const result = await search.save();

      checkSaveResponse(result, search);

      expect(search.rev).not.toEqual(lastRev);
      lastRev = search.rev;

      // Save should put it in the cache
      expect(searches[search.id]).toBe(search);
    }
  });

  it('deserializes without results', async () => {
    const search = await definition.new();

    const serialized = search.serialize();
    const deserialized = await Search.deserialize(serialized);

    expect(deserialized).toEqual(search);
    expect(deserialized.serialize()).toEqual(serialized);
  });

  it('produces results', async () => {
    definition.userNames.push('test');

    const search = await definition.new();

    await search.start();

    expect(search.results.length).toBeGreaterThan(0);
    expect(search.results).toHaveLength(definition.includedSites.length);
  });

  it('deserializes with results', async () => {
    definition.userNames.push('test');

    const search = await definition.new();

    await search.start();

    const serialized = search.serialize();
    const deserialized = await Search.deserialize(serialized);

    // expect(deserialized).toEqual(search);
    expect(deserialized.serialize()).toEqual(serialized);
  });
});
