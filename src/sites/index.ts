import { search } from 'pouchdb-find';
import { searchSites, SearchResult } from 'search/search';
import { allSites } from './sites';

export * from './sites';

const findProfiles = async (usernames: string[]) => {
    const foundProfiles: SearchResult[] = await searchSites(usernames)
    console.log(foundProfiles)
}

findProfiles(["blue"])