/**
 * @fileoverview Classes and functions used for interacting with
 * TRACE searches.
 */


 /*             TODO:

 - Run test again to see success rate rn
 - Fix 'response_url' handling to prevent redirect and check original status code
 - Tinker with CORS settings for 'message' handling
 - Add successes to SearchResultList that is usable by ReactJS
 
 */

 
import { allSites, Site, SiteList } from 'sites';


export interface SearchResult {
    // enter needed fields here
    siteName: string
    siteUrl: string
    username: string
    profileUrl: string
}

export interface SearchResultList {
    [key: string]: SearchResult
}



/* Need for CORS:

Access-Control-Allow-Origin: <ORIGIN>
Access-Control-Allow-Headers: 'include'
Access-Control-Allow-Credentials: 'expose'
*/

/*
    Searches our compiled list of sites for the username(s) provided
    Usernames must be provided in list form:
        ["cohenchris", "jmcker", ...]
*/
export const searchSites = async (usernames: string[]) => {
    let foundProfiles: SearchResultList = {}

    let pass = []
    let fail = []

    // For each username, loop through each site to check if a profile exists
    for (let username in usernames) {
        for (let site in allSites) {
            try {
            let profileExists = await checkIfProfileExists(site, allSites[site], username)
            
            if (profileExists) {
                // append profile to foundProfiles SearchResultList
                // TODO
                pass.push([site, allSites[site].errorType])
            }
            else {
                fail.push([site, allSites[site].errorType])
            }

            console.log(`${site} -- profileExists: ${profileExists}\n====================`)
            } catch(error) {
                // This will ignore any json items that are malformed
                continue
            }
        }
    }


    console.log("PASSING:")
    console.log(pass)

    console.log("FAILING")
    console.log(fail)

    return foundProfiles
}


const checkIfProfileExists = async (siteName: string, site: Site, username: string) => {
    let errorMsg: string | string[] | undefined = site.errorMsg
    let errorType: string = site.errorType
    let errorUrl: string | undefined = site.errorUrl
    let regexCheck: string | undefined = site.regexCheck            // valid username regex for website - don't make request if invalid!
    let url: string = site.url
    let urlMain: string = site.urlMain
    let username_claimed: string = site.username_claimed
    let username_unclaimed: string = site.username_unclaimed

    // Take url and replace '{}' with the username
    const profileUrl = url.replace("{}", username_claimed)

    let response
    switch (errorType) {
        case "status_code":
            console.log("Status Code!")
            // A 2XX status code (response.status) will be returned if the profile exists.
            // To speed things up, just use a 'HEAD' request (TODO)
            // CORS not cooperating with 'HEAD'
            response = await fetch(profileUrl, { method: 'HEAD' })
                                    .catch(error => {
                                        return undefined
                                    })

            // If response is undefined, profile is not found. Otherwise, check if response code is 2XX. If so, profile exists.
            return (response === undefined) ? false : (response.status >= 200 && response.status < 300)
            break


        case "message":
            console.log("Message!")
            // A specific error message will be returned if the profile does not exist, specified by 'errorMsg'
            // Compare 'response' to 'errorMsg'
            // console.log(`${siteName} -- Checking if response message is '${errorMsg}'...`)
            response = await fetch(profileUrl, { credentials: 'include' })
                                    .then(response => {
                                        return response.text()
                                    })
                                    .catch(error => {
                                        return undefined
                                    })
            
            if (typeof errorMsg === "string") {     // only one error message to check
                // if the response failed, or the response includes the error message, profile doesn't exist
                return (response === undefined) ? false : response.includes(errorMsg)
            }
            else {  // typeof errorMsg is a string[]
                for (let msg in errorMsg) {
                    if (! ((response === undefined) ? false : response.includes(msg)) ) {
                        // if the response failed, or the response includes one of the error messages, profile doesn't exist
                        return false
                    }
                }
                // If neither error message ever popped up, profile exists
                return true
            }
            return false
            break


        case "response_url":
            console.log("Response URL!")
            // A specific URL will be returned if the profile does not exist, specified by 'errorUrl'
            // Compare 'response' to 'errorUrl'
            // TODO: prevent redirect, inspect code for previous
            // console.log(`${siteName} -- Checking if response URL is '${errorUrl}'`)
            // if (response) {
            //     console.log(`profileExists: ${response.url != errorUrl}`)
            //     console.log(`======================`)
            // }
            response = await fetch(profileUrl)
                                .catch(error => {
                                    return undefined
                                })
            
            // If response fails (undefined), return false. Otherwise, check the redirect url of the response. If that matches the expected redirect, profile doesn't exist. 
            return (response === undefined) ? false : response.url != errorUrl
            return false
            break
    }

    return false
}

export default searchSites