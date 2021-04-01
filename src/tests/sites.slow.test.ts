import { allSites, Site, SiteList } from 'sites';
import { findAccount, ThirdPartyAccount, AutoSearchAccount } from 'search';

const testSearch = async (shouldExist: boolean): Promise<Site[]> => {
  const pass: any[] = [];
  const fail: any[] = [];

  const testSiteTimeout = ['Oracle Community'];
  const testSites = ['Codeforces', 'Code Sandbox', 'hackerearth', 'Chocolatey', 'Ebay', 'Instagram', 'CashApp', 'LinkTree', 'CampSite Bio', 'Sessionize', 'Untappd', 'Angel List', 'PlayStation', 'Tumblr', 'Crates.io'];

  for (const site of Object.keys(allSites)) {
    // if (!testSites.includes(allSites[site].name)) {
    //   continue;
    // }
    // if (!testSiteTimeout.includes(allSites[site].name)) {
    //   continue;
    // }

    const username = shouldExist ? allSites[site].username_claimed : allSites[site].username_unclaimed;

    const account = await findAccount(allSites[site], username);
    const exists = account instanceof AutoSearchAccount;

    if (shouldExist) {
      if (exists) {
        pass.push(site);
      } else {
        fail.push(site);
      }
    } else {
      // profile should not have been found
      if (exists) {
        fail.push(site);
      } else {
        pass.push(site);
      }
    }
  }

  // console.log("PASSING:")
  // console.log(pass)

  // console.log("FAILING")
  // console.log(fail)

  return fail;
};

describe('Search Sites', () => {
  beforeAll(() => {
    // Fetch calls timeout after 10s, there are 2 usernames tested per site
    jest.setTimeout(Object.values(allSites).length * 10 * 1000 * 2);
  });

  it('detects existing accounts', async () => {
    const results = await testSearch(true);
    // If 20 or more sites fail, red flag
    expect(results.length).toBeLessThan(20);
  });

  it('detects nonexistent accounts', async () => {
    const results = await testSearch(false);
    // If 20 or more sites fail, red flag
    expect(results.length).toBeLessThan(20);
  });
});
