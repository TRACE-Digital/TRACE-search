import { allSites, Site, SiteList } from 'sites';
import { findAccount, ThirdPartyAccount, DiscoveredAccount } from 'search';

const testSearch = async (shouldExist: boolean): Promise<Site[]> => {
    const pass: any[] = []
    const fail: any[] = []

    for (const site in allSites) {
        const username = shouldExist ? allSites[site].username_claimed : allSites[site].username_unclaimed

        const profileExists: ThirdPartyAccount = await findAccount(allSites[site], username, null)
        let exists = false
        if (profileExists instanceof DiscoveredAccount) {
            exists = true
        }

        if (shouldExist) {
            if (exists) {
                pass.push(site)
            }
            else {
                fail.push(site)
            }
        }
        else {      // profile should not have been found
            if (exists) {
                fail.push(site)
            }
            else {
                pass.push(site)
            }
        }
    }

    // console.log("PASSING:")
    // console.log(pass)

    // console.log("FAILING")
    // console.log(fail)

    return fail
}



describe('Search Sites', () => {
    beforeAll(() => {
        jest.setTimeout(Object.values(allSites).length * 10 * 1000)
    })
    it('detects existing accounts', async () => {
        const results = await testSearch(true)
        // If 10 or more sites fail, red flag
        expect(results.length).toBeLessThan(20)
    })

    it('detects nonexistent accounts', async () => {
        const results = await testSearch(false)
        // If 10 or more sites fail, red flag
        expect(results.length).toBeLessThan(20)
    })
})