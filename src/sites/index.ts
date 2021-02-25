import { search } from 'pouchdb-find';
import searchSites from 'search/search';

export * from './sites';

let usernames = ["blue", "cohenchris"]
searchSites(usernames)