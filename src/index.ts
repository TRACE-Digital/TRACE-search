import { allSites } from 'sites';
import { setupDb } from 'db';
import * as meta from 'meta';

async function main() {
    console.log(`${meta.NAME} v${meta.VERSION}-${meta.BUILD_TYPE} built ${meta.BUILT_AT}`);

    console.log(allSites);

    const db = await setupDb();
    console.log(db);
}

main();

// Top level exports that we want to be publicly visible
export { allSites as supportedSites } from 'sites';
export { VERSION as version } from 'meta';

// Top level types that we want to be publicly visible
export {
    Site,
    SiteList
} from 'sites';
