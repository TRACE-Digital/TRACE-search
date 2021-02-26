import { allSites } from 'sites';
import { getDb, SearchDefinitionSchema, UTF_MAX } from 'db';
import * as meta from 'meta';
import { ClaimedAccount, DiscoveredAccount, SearchDefinition } from 'search';
import deepEqual from 'deep-equal';

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

  const search = searchDef.new();
  console.log(`Progress: ${search.progress}%`);

  search.start();
  console.log(`Progress: ${search.progress}%`);
  console.log(search.results);
  console.log(search.resultsMap);

  const claimed = search.discoveredResults[0].claim();
  console.log('Claim account');
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
  console.log('Database:');
  console.log(db);

  const result = await searchDef.save();
  console.log('Search definition save result:');
  console.log(result);

  const retrieved = await db.get<SearchDefinitionSchema>(searchDef.id);

  console.log('Search definition serialization/retrieval:')
  console.log(searchDef.serialize());
  console.log(retrieved);

  // Comparing JSON.stringify() results depends on the order of keys
  // Rely on the deep-equals library instead
  const areEqual = deepEqual(searchDef.serialize(), retrieved);

  console.assert(areEqual, 'Database: stored !== retrieved');
  console.log(`stored === retrieved: ${areEqual}`);

  const allSearchDefs = await db.allDocs({
    include_docs: true,
    startkey: 'searchDef/',
    endkey: `searchDef/${UTF_MAX}`
  });
  console.log(allSearchDefs);

  const searchDefDeserialized = await SearchDefinition.deserialize(retrieved);
  console.log('Search definition deserialized');
  console.log(searchDefDeserialized);

  console.groupEnd();
}

main();

// Top level exports that we want to be publicly visible
export { allSites as supportedSites } from 'sites';
export { VERSION as version } from 'meta';

// Top level types that we want to be publicly visible
export * from 'search';
export { Site, SiteList } from 'sites';
