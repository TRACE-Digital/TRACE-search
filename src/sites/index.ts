import { search } from 'pouchdb-find';
import searchSites from 'search/search';
import { allSites } from './sites';

export * from './sites';

let usernames: string[] = ["blue"]
searchSites(usernames)