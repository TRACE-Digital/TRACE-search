import sites from 'sites/sites';
import { setupDb } from 'db';

async function main() {
    console.log(sites.all);

    const db = await setupDb();
    console.log(db);
}

main();
