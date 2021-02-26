/**
 * @fileoverview Classes and functions used for interacting with
 * TRACE searches.
 */


 /*             TODO:

 - Fix 'response_url' handling to prevent redirect and check original status code
 - Tinker with CORS settings for 'message' handling
 - Maybe add regex check?
 - Meet w/ group and figure out format to send frontend

 */

 
import { allSites, Site, SiteList } from 'sites';

import fetch from './fetchWithTimeout'      // fetch(url, options, timeout_ms)

export interface SearchResult {
    // enter needed fields here
    siteName: string
    siteUrl: string
    username: string
    profileUrl: string
}

// export interface SearchResultList {
//     [key: string]: SearchResult
// }



/* Need for CORS:

Access-Control-Allow-Origin: <ORIGIN>
Access-Control-Allow-Headers: 'include'
Access-Control-Allow-Credentials: 'expose'
*/

/*
    Searches our compiled list of sites for the username(s) provided
    Usernames must be provided in list form:
        ["cohenchris", "jmcker", ...]
    
    By default, sherlock.json has 298 sites (as of 2-25-21)
*/
export const searchSites = async (usernames: string[]) => {
    const foundProfiles: SearchResult[] = []

    const pass: any[] = []
    const fail: any[] = []

    // For each username, loop through each site to check if a profile exists
    for (const username of usernames) {
        for (const site in allSites) {
            try {

            if (allSites[site].errorType !== "message") {   // DEBUG
                continue
            }
            if (!allSites[site].urlProbe) {
                continue
            }

            const profileExists = await checkIfProfileExists(site, allSites[site], username)

            if (profileExists) {
                // append profile to foundProfiles SearchResultList
                const profileUrl = allSites[site].url.replace("{}", username)

                const foundProfile: SearchResult = {
                    "siteName": site,
                    "siteUrl": allSites[site].urlMain,
                    "username": username,
                    "profileUrl": profileUrl,
                }
                
                foundProfiles.push(foundProfile)
                // DEBUG
                pass.push([site, allSites[site].errorType])
            }
            else {   // DEBUG
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
    const errorMsg: string | string[] | undefined = site.errorMsg
    const errorType: string = site.errorType
    const errorUrl: string | undefined = site.errorUrl
    const regexCheck: string | undefined = site.regexCheck            // valid username regex for website - don't make request if invalid!
    const url: string = site.url
    const urlMain: string = site.urlMain
    const urlProbe: string | undefined = site.urlProbe
    const username_claimed: string = site.username_claimed
    const username_unclaimed: string = site.username_unclaimed

    // Take url and replace '{}' with the username
    let profileUrl = ""
    if (urlProbe) {
        profileUrl = urlProbe.replace("{}", username_unclaimed)
    }
    else {
        profileUrl = url.replace("{}", username_unclaimed)
    }

    let response
    switch (errorType) {
        case "status_code":
            break
            console.log("Status Code!")
            // A 2XX status code (response.status) will be returned if the profile exists.
            response = await fetch(profileUrl, { method: 'HEAD' }, 5000)    // timeout after 5s
                                    .catch(error => {
                                        console.log("Error! - " + error)
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
            // response = await fetch(profileUrl, { credentials: 'include' }, 5000)    // timeout after 5s
            response = await fetch(profileUrl, { }, 5000)    // timeout after 5s
                                    .then(r => {
                                        return r.text()
                                    })
                                    .catch(error => {
                                        console.log("Error! - " + error)
                                        return undefined
                                    })
            
            if (typeof errorMsg === "string") {     // only one error message to check
                // if the response failed, or the response includes the error message, profile doesn't exist
                return !responseContainsError(response, errorMsg)
            }
            else {  // typeof errorMsg is a string[]
                for (const msg in errorMsg) {
                    if (responseContainsError(response, msg)) {
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
            break
            console.log("Response URL!")
            // A specific URL will be returned if the profile does not exist, specified by 'errorUrl'
            // Compare 'response' to 'errorUrl'
            // TODO: prevent redirect, inspect code for previous
            // console.log(`${siteName} -- Checking if response URL is '${errorUrl}'`)
            // if (response) {
            //     console.log(`profileExists: ${response.url != errorUrl}`)
            //     console.log(`======================`)
            // }
            response = await fetch(profileUrl, {}, 5000)  // timeout after 5s
                                .catch(error => {
                                    console.log("Error! - " + error)
                                    return undefined
                                })
            
            // If response fails (undefined), return false. Otherwise, check the redirect url of the response. If that matches the expected redirect, profile doesn't exist. 
            return (response === undefined) ? false : response.url !== errorUrl // TODO: triple equals or no? compare differently?
            return false
            break
    }

    return false
}

const responseContainsError = (response: string, errorMsg: string) => {
    if (response === undefined) {
        // response doesn't include errorMsg, but request clearly failed, so return true anyways since the profile doesn't exist
        return true
    }

    return response.includes(errorMsg)
}

export default searchSites
