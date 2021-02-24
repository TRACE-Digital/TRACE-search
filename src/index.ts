import { allSites } from 'sites';
import { setupDb } from 'db';
import * as meta from 'meta';
import { SearchDefinition } from 'search';

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
}

main();

// Top level exports that we want to be publicly visible
export { allSites as supportedSites } from 'sites';
export { VERSION as version } from 'meta';

// Top level types that we want to be publicly visible
export * from 'search';
export { Site, SiteList } from 'sites';
