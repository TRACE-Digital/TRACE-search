import { allSites } from 'sites';
import { getDb, UTF_MAX, setupReplication, teardownReplication } from 'db';
import * as meta from 'meta';
import {
  accounts,
  ClaimedAccount,
  DiscoveredAccount,
  Search,
  SearchDefinition,
  searchDefinitions,
  searches,
  ThirdPartyAccount,
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

  const claimed = await search.discoveredResults[0].claim();
  console.log('Original account');
  console.log(search.discoveredResults[0]);
  console.log('Claimed account');
  console.log(claimed);
  console.log(claimed instanceof ClaimedAccount);
  console.log(claimed instanceof DiscoveredAccount);

  console.groupEnd();
  console.groupCollapsed('Test serialization');

  console.log(searchDef.serialize());
  console.log(search.serialize());
  console.log(search.discoveredResults[0].serialize());
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
  console.log(searchDefinitions);

  const searchLoadAll = await Search.loadAll(searchDef.id);
  console.log(searchLoadAll);
  console.log(searches);

  const accountsLoadAll = await ThirdPartyAccount.loadAll();
  console.log(accountsLoadAll);
  console.log(accounts);

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

// Top level exports that we want to be publicly visible
// Name each explicitly so that JavaScript has an easier time with them
export { getDb, getRemoteDb, resetDb, resetRemoteDb, setupReplication, teardownReplication } from 'db';
export { allSites, supportedSites, unsupportedSites, tags, filterSitesByTags } from 'sites';
export { VERSION, EXTENSION_MIN_VERSION, EXTENSION_VERSION, checkExtensionVersion } from 'meta';
export {
  AccountType,
  ClaimedAccount,
  DiscoveredAccount,
  DiscoveredAccountAction,
  ManualAccount,
  RejectedAccount,
  Search,
  SearchDefinition,
  SearchState,
  ThirdPartyAccount,
  UnregisteredAccount,
  accounts,
  searchDefinitions,
  searchResults,
  searches,
} from 'search';

// Top level types that we want to be publicly visible
export * from 'search';
export { Site, SiteList } from 'sites';
