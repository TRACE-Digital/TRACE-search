import { resetDb } from "db";
import { DEFAULT_COLOR_SCHEME, pages, ProfilePage } from "profile";
import { ManualAccount, ThirdPartyAccount } from "search";
import { supportedSites } from "sites";
import { checkSaveResponse } from "./util";

beforeEach(async () => {
  await resetDb();
});

describe('search definition', () => {
  let account1: ThirdPartyAccount;
  let account2: ThirdPartyAccount;

  beforeEach(async () => {
    account1 = new ManualAccount(supportedSites['Wikipedia'], 'test1');
    account2 = new ManualAccount(supportedSites['Wikipedia'], 'test2');
    await account1.save();
    await account2.save();
  });

  it('constructs with no args', () => {
    const page = new ProfilePage();
    expect(page).toBeDefined();

    expect(page.id).toBeDefined();
    expect(page.title).toBeDefined();
    expect(page.colorScheme).toEqual(DEFAULT_COLOR_SCHEME);
    expect(page.accounts).toHaveLength(0);
  });

  it('it generates unique names within the same session', () => {
    const page = new ProfilePage();
    const page2 = new ProfilePage();

    expect(page.title).not.toStrictEqual(page2.title);
  });

  it('accepts a name', () => {
    const name = 'Test Search';
    const page = new ProfilePage(name);

    expect(page.title).toStrictEqual(name);
    expect(page.serialize().title).toStrictEqual(name);
  });

  it('sets its date/times', () => {
    const page = new ProfilePage();

    expect(page.createdAt).toBeDefined();
    expect(page.lastEditedAt).toBeDefined();
  });

  it('serializes/deserializes', async () => {
    const page = new ProfilePage('Test Page');

    const serialized = page.serialize();
    expect(serialized).toBeDefined();

    const deserialized = await ProfilePage.deserialize(serialized);
    expect(deserialized).toBeDefined();

    expect(deserialized).toEqual(page);
    expect(deserialized.serialize()).toEqual(serialized);
  });

  it('saves', async () => {
    const page = new ProfilePage(undefined);
    let lastRev = page.rev;

    const result = await page.save();

    checkSaveResponse(result, page);

    expect(page.rev).not.toEqual(lastRev);
    lastRev = result.rev;

    // Save should put it in the cache
    // TODO: Rewrite to use cache after merge
    expect(ProfilePage.cache.get(page.id)).toBe(page);
  });

  it('saves multiple times', async () => {
    const page = new ProfilePage(undefined);
    let lastRev = page.rev;

    for (let i = 0; i < 2; i++) {
      const result = await page.save();

      checkSaveResponse(result, page);

      expect(page.rev).not.toEqual(lastRev);
      lastRev = page.rev;

      // Save should put it in the cache
      expect(ProfilePage.cache.get(page.id)).toBe(page);
    }
  });

  it('deserializes with accounts', async () => {
    const page = new ProfilePage('Test Page');

    page.accounts.push(account1);
    page.accounts.push(account2);
    await page.save();

    const serialized = page.serialize();
    expect(serialized.accountIds).toContain(account1.id);
    expect(serialized.accountIds).toContain(account2.id);

    const deserialized = await ProfilePage.deserialize(serialized);

    expect(deserialized).toEqual(page);
    expect(deserialized.serialize()).toEqual(serialized);
  });

  it('is stored in the cache during deserialization', async () => {
    const page = new ProfilePage(undefined);

    await ProfilePage.deserialize(page.serialize());

    // TODO: Rewrite using cache after merge
    expect(ProfilePage.cache.get(page.id)).toEqual(page);
  });

  it('is stored in the cache during loadAll', async () => {
    const page = new ProfilePage(undefined);
    await page.save();

    ProfilePage.cache.remove(page.id);
    expect(ProfilePage.cache.has(page.id)).toBeFalsy();

    const results = await ProfilePage.loadAll();

    expect(results).toContainEqual(page);
    expect(ProfilePage.cache.get(page.id)).toEqual(page);
  });
});
