import 'db/crypto-polyfill';
import { allSites } from 'sites';
import { destroyDb, getDb, UTF_MAX, setupReplication, teardownReplication, removeEncryptionKey } from 'db';
import * as meta from 'meta';
import {
  ClaimedAccount,
  AutoSearchAccount,
  AutoSearchAccountAction,
  Search,
  SearchDefinition,
  ThirdPartyAccount,
  RegisteredAccount,
} from 'search';

async function main() {
  console.log(`${meta.NAME} v${meta.VERSION}-${meta.BUILD_TYPE} built ${meta.BUILT_AT}`);

  // Trigger database setup
  await getDb();

  console.log(allSites);

  console.groupCollapsed('Test search');

  // Make a test search
  const searchDef = new SearchDefinition('Test Search', ['Wikipedia']);
  searchDef.userNames.push('test');

  console.log(searchDef);

  await searchDef.save();

  const search = await searchDef.new();
  console.log(`Progress: ${search.progress}%`);

  await search.start();
  console.log(`Progress: ${search.progress}%`);
  console.log(search.results);
  console.log(search.resultsMap);

  const account = search.unevaluatedResults[0];
  const claimed = await account.claim();
  console.log('Original account');
  console.log(account);
  console.log('Claimed account');
  console.log(claimed);
  console.log(claimed instanceof ClaimedAccount);
  console.log(claimed instanceof AutoSearchAccount);

  console.groupEnd();
  console.groupCollapsed('Test serialization');

  console.log(searchDef.serialize());
  console.log(search.serialize());
  console.log(search.unevaluatedResults[0].serialize());
  console.log(claimed.serialize());

  console.groupEnd();
  console.groupCollapsed('Test database store/retrieve');

  const db = await getDb();

  const allSearchDefs = await db.allDocs({
    include_docs: true,
    startkey: 'searchDef/',
    endkey: `searchDef/${UTF_MAX}`,
  });
  console.log(allSearchDefs);

  console.groupEnd();
  console.group('Test loading');

  const searchDefLoadAll = await SearchDefinition.loadAll();
  console.log(searchDefLoadAll);
  console.log(SearchDefinition.cache.items);

  const searchLoadAll = await Search.loadAll(searchDef.id);
  console.log(searchLoadAll);
  console.log(Search.cache.items);

  const accountsLoadAll = await ThirdPartyAccount.loadAll();
  console.log(accountsLoadAll);
  console.log(ThirdPartyAccount.accountCache.items);

  console.groupEnd();
}

async function testReplicate() {
  try {
    await setupReplication();
  } catch (e) {
    console.error(e);
  }

  setTimeout(async () => {
    // await teardownReplication();
    console.log('Replication stopped');
  }, 3000);
}

// tslint:disable-next-line:no-floating-promises
// testReplicate();

// tslint:disable-next-line:no-floating-promises
// main();

/** @deprecated Use `RegisteredAccount` instead. */
const DiscoveredAccount = RegisteredAccount;
/** @deprecated Use `AutoSearchAccountAction` instead. */
const DiscoveredAccountAction = AutoSearchAccountAction;
/** @deprecated Use `destroyDb` instead. */
const destroyLocalDb = async () => { removeEncryptionKey(); await destroyDb() };

// Top level exports that we want to be publicly visible
// Name each explicitly so that JavaScript has an easier time with them
export {
  getDb,
  getRemoteDb,
  resetDb,
  resetRemoteDb,
  closeDb,
  closeRemoteDb,
  destroyDb,
  destroyRemoteDb,
  disableSync,
  enableSync,
  generateEncryptionKey,
  getEncryptionKey,
  removeEncryptionKey,
  setRemoteUser,
  setupReplication,
  teardownReplication,
  exportToJson,
  exportToReadableJson,
  exportToCsv
} from 'db';
export { allSites, supportedSites, unsupportedSites, tags, filterSitesByTags, privacyRatings } from 'sites';
export { VERSION, EXTENSION_MIN_VERSION, EXTENSION_VERSION, checkExtensionVersion } from 'meta';
export { ProfilePage, DEFAULT_COLOR_SCHEME, pages } from 'profile';
export {
  AccountType,
  ClaimedAccount,
  AutoSearchAccount,
  AutoSearchAccountAction,
  FailedAccount,
  ManualAccount,
  RejectedAccount,
  Search,
  SearchDefinition,
  SearchState,
  ThirdPartyAccount,
  RegisteredAccount,
  UnregisteredAccount,
  accounts,
  searchDefinitions,
  searchResults,
  searches,
  toAccountId,
} from 'search';

// Deprecated stuff
export { DiscoveredAccount, DiscoveredAccountAction, destroyLocalDb };

// Top level types that we want to be publicly visible
export { ProfilePageColorSchema } from 'db/schema';
export * from 'search';
export { Site, SiteList } from 'sites';
