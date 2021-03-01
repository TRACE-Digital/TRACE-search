import { SearchDefinition } from 'search';

const VALID_SITE_NAMES = ['Wikipedia', 'GitHub'];
const INVALID_SITE_NAMES = ['xxx not a site'];

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

  it('accepts a subset of all sites', () => {
    const siteNames = VALID_SITE_NAMES;
    const searchDef = new SearchDefinition(undefined, siteNames);

    for (const siteName of siteNames) {
      expect(searchDef.includedSites).toContainEqual(
        expect.objectContaining({ name: siteName })
      );
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
      expect(searchDef.includedSites).toContainEqual(
        expect.objectContaining({ name: siteName })
      );
    }

    expect(searchDef.includedSites).not.toContainEqual(undefined);
    for (const siteName of INVALID_SITE_NAMES) {
      expect(searchDef.includedSites).not.toContainEqual(
        expect.objectContaining({ name: siteName })
      );
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

  it('handles requests for lastRun with 0 runs', () => {
    const searchDef = new SearchDefinition();

    expect(searchDef.lastRun).toBeNull();
    expect(searchDef.lastRunAt).toBeNull();
  });
});
