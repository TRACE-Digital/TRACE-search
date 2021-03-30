import { resetDb } from 'db';
import {
  AccountType,
  ClaimedAccount,
  DiscoveredAccount,
  DiscoveredAccountAction,
  ManualAccount,
  RejectedAccount,
  ThirdPartyAccount,
  UnregisteredAccount,
} from 'search';
import { allSites } from 'sites';
import { checkSaveResponse } from './util';

const accountClasses: (typeof DiscoveredAccount | typeof ManualAccount | typeof UnregisteredAccount)[] = [
  DiscoveredAccount,
  ClaimedAccount,
  RejectedAccount,
  ManualAccount,
  UnregisteredAccount,
];
const SEARCH_PREFIX = 'searchDef/testing/test123';
const USERNAME = 'test';
const SITE_NAME = 'Wikipedia';
const SITE = allSites[SITE_NAME];

describe('Accounts', () => {
  beforeEach(async () => {
    await resetDb();
  });

  for (const cls of accountClasses) {
    console.log(cls.name);

    describe(`${cls.name}`, () => {
      it('constructs', () => {
        const account = new cls(SITE, USERNAME);
        expect(account).toBeDefined();
        expect(account.id).toContain(SITE.name);
      });

      it('accepts a prefix', () => {
        const account = new cls(SITE, USERNAME, SEARCH_PREFIX);
        expect(account.id).toContain(SEARCH_PREFIX);
        expect(account.id.startsWith(SEARCH_PREFIX)).toBeTruthy();
      });

      it('deserializes', async () => {
        const account = new cls(SITE, USERNAME);

        const serialized = account.serialize() as any;
        const deserialized = await cls.deserialize(serialized);

        expect(deserialized).toEqual(account);
        expect(deserialized.serialize()).toEqual(serialized);
      });

      it('deserializes with a prefix', async () => {
        const account = new cls(SITE, USERNAME, SEARCH_PREFIX);

        const serialized = account.serialize() as any;
        const deserialized = await cls.deserialize(serialized);

        expect(deserialized).toEqual(account);
        expect(deserialized.serialize()).toEqual(serialized);
      });

      it('constructs from factory', async () => {
        const account = new cls(SITE, USERNAME);

        const serialized = account.serialize();
        const deserialized = await cls.factory(serialized);

        expect(deserialized.type).toEqual(account.type);
        expect(deserialized).toBeInstanceOf(cls);
      });

      it('constructs from factory with prefix', async () => {
        const account = new cls(SITE, USERNAME, SEARCH_PREFIX);

        const serialized = account.serialize();
        const deserialized = await cls.factory(serialized);

        expect(deserialized.type).toEqual(account.type);
        expect(deserialized).toBeInstanceOf(cls);
      });

      it('saves', async () => {
        const account = new cls(SITE, USERNAME);
        let lastRev = account.rev;

        const result = await account.save();

        checkSaveResponse(result, account);

        expect(account.rev).not.toEqual(lastRev);
        lastRev = result.rev;

        // Save should put it in the cache
        expect(ThirdPartyAccount.accountCache.get(account.id)).toBe(account);
      });

      it('saves multiple times', async () => {
        const account = new cls(SITE, USERNAME);
        let lastRev = account.rev;

        for (let i = 0; i < 2; i++) {
          const result = await account.save();

          checkSaveResponse(result, account);

          expect(account.rev).not.toEqual(lastRev);
          lastRev = account.rev;

          // Save should put it in the cache
          expect(ThirdPartyAccount.accountCache.get(account.id)).toBe(account);
          expect(ThirdPartyAccount.resultCache.get(account.id)).toBeUndefined();
        }
      });

      it('saves as a search result (with a prefix)', async () => {
        const account = new cls(SITE, USERNAME, SEARCH_PREFIX);
        let lastRev = account.rev;

        const result = await account.save();

        expect(result).toBeDefined();
        expect(result.ok).toBeTruthy();
        expect(result.id).toEqual(account.id);

        expect(account.rev).toEqual(result.rev);
        expect(account.rev).not.toEqual(lastRev);
        lastRev = result.rev;

        // Save should put it in the cache
        expect(ThirdPartyAccount.resultCache.get(account.id)).toBe(account);
        expect(ThirdPartyAccount.accountCache.get(account.id)).toBeUndefined();
      });

      it('saves multiple times', async () => {
        const account = new cls(SITE, USERNAME);
        let lastRev = account.rev;

        for (let i = 0; i < 2; i++) {
          const result = await account.save();

          expect(result).toBeDefined();
          expect(result.ok).toBeTruthy();
          expect(result.id).toEqual(account.id);

          expect(account.rev).toEqual(result.rev);
          expect(account.rev).not.toEqual(lastRev);
          lastRev = account.rev;

          // Save should put it in the cache
          expect(ThirdPartyAccount.accountCache.get(account.id)).toBe(account);
        }
      });

      it('can be claimed', async () => {
        const account = new cls(SITE, USERNAME, SEARCH_PREFIX);

        if (account instanceof DiscoveredAccount) {
          expect(account.actionTaken).toEqual(DiscoveredAccountAction.NONE);

          const claimed = await account.claim();

          expect(claimed).toBeInstanceOf(ClaimedAccount);
          expect(account.actionTaken).toEqual(DiscoveredAccountAction.CLAIMED);
        }
      });

      it('can be rejected', async () => {
        const account = new cls(SITE, USERNAME, SEARCH_PREFIX);

        if (account instanceof DiscoveredAccount) {
          expect(account.actionTaken).toEqual(DiscoveredAccountAction.NONE);

          const rejected = await account.reject();

          expect(rejected).toBeInstanceOf(RejectedAccount);
          expect(account.actionTaken).toEqual(DiscoveredAccountAction.REJECTED);
        }
      });

      it('can be switched from rejected to claimed', async () => {
        const account = new cls(SITE, USERNAME, SEARCH_PREFIX);

        if (account instanceof DiscoveredAccount) {
          const rejected = await account.reject();
          expect(rejected.type).toEqual(AccountType.REJECTED);
          expect(rejected).toBeInstanceOf(RejectedAccount);

          const claimed = await account.claim();
          expect(claimed.type).toEqual(AccountType.CLAIMED);
          expect(claimed).toBeInstanceOf(ClaimedAccount);

          expect(account.actionTaken).toEqual(DiscoveredAccountAction.CLAIMED);

          // Confirm that cache was overwritten
          expect(ThirdPartyAccount.accountCache.get(rejected.id)).toBe(claimed);
          expect(ThirdPartyAccount.accountCache.get(claimed.id)).toBe(claimed);
        }
      });

      it('can be switched from claimed to rejected', async () => {
        const account = new cls(SITE, USERNAME, SEARCH_PREFIX);

        if (account instanceof DiscoveredAccount) {
          const claimed = await account.claim();
          expect(claimed.type).toEqual(AccountType.CLAIMED);
          expect(claimed).toBeInstanceOf(ClaimedAccount);

          const rejected = await account.reject();
          expect(rejected.type).toEqual(AccountType.REJECTED);
          expect(rejected).toBeInstanceOf(RejectedAccount);

          expect(account.actionTaken).toEqual(DiscoveredAccountAction.REJECTED);

          // Confirm that cache was overwritten
          expect(ThirdPartyAccount.accountCache.get(claimed.id)).toBe(rejected);
          expect(ThirdPartyAccount.accountCache.get(rejected.id)).toBe(rejected);
        }
      });
    });
  }
});
