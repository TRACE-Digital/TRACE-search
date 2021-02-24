import { allSites } from 'sites';
import { setupDb } from 'db';
import * as meta from 'meta';
import { ClaimedAccount, DiscoveredAccount, SearchDefinition } from 'search';

async function main() {
  console.log(`${meta.NAME} v${meta.VERSION}-${meta.BUILD_TYPE} built ${meta.BUILT_AT}`);

  console.log(allSites);

  const db = await setupDb();
  console.log(db);

  // Make a test search
  const searchDef = new SearchDefinition();
  searchDef.userNames.push('test');

  console.log(searchDef);

  const search = searchDef.new();
  console.log(`Progress: ${search.progress}%`);

  search.start();
  console.log(`Progress: ${search.progress}%`);
  console.log(search.results);
  console.log(search.resultsDict);

  // TODO: This isn't working as expected yet
  // Claiming doesn't change the instanceof result
  const claimed = search.discoveredResults[0].claim();
  console.log(claimed);
  console.log(typeof claimed);
  console.log(claimed instanceof ClaimedAccount)
  console.log(claimed instanceof DiscoveredAccount);
}

main();

// Top level exports that we want to be publicly visible
export { allSites as supportedSites } from 'sites';
export { VERSION as version } from 'meta';

// Top level types that we want to be publicly visible
export * from 'search';
export { Site, SiteList } from 'sites';
