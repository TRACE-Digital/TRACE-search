/**
 * @fileoverview Classes and functions used for interacting with
 * TRACE searches.
 */





/*                                  TODO:

    - Maybe add regex check?
    - Meet w/ group and figure out format to send to frontend
    - Find logo URL if the frontend isn't?
    - Fix Twitter


    Inform users to:
        Disable Enhanced Privacy Protection on Firefox for TRACE
        Enable 3rd party cookies for TRACE
        Disable VPN

*/

/* Need for CORS:

    Access-Control-Allow-Origin: <ORIGIN>
    Access-Control-Allow-Headers: 'include'
    Access-Control-Allow-Credentials: 'expose'
*/
 




import { allSites, Site, SiteList } from 'sites';

import fetch from './fetchWithTimeout'      // fetch(url, options, timeout_ms = 10000)

export interface SearchResult {
    siteName: string
    siteUrl: string
    username: string
    profileUrl: string
}



/**
  * Searches our compiled list of sites for the username(s) provided
  * Usernames must be provided in list form:
  *     ["cohenchris", "jmcker", ...]
  * By default, sherlock.json has 298 sites (as of 2-25-21)
  * @param usernames an array of usernames to search for
  */
export const searchSites = async (usernames: string[]) => {
    const foundProfiles: SearchResult[] = []

    const pass: any[] = []
    const fail: any[] = []


    // For each username, check each site for an existing profile
    for (const username of usernames) {
        for (const site in allSites) {
            try {
                if (allSites[site].omit) {
                    // if specified to omit, skip over the site
                    continue
                }

                // TESTING
                /*
                    const profileExists = await checkIfProfileExists(allSites[site], allSites[site].username_claimed)
                    const profileNotExists = await checkIfProfileExists(allSites[site], allSites[site].username_unclaimed)

                    if (!profileExists || profileNotExists) {
                        fail.push([site, allSites[site].errorType, `profileExists: ${profileExists}`, `profileNotExists: ${profileNotExists}`])
                    }
                    else {
                        pass.push([site, allSites[site].errorType, `profileExists: ${profileExists}`, `profileNotExists: ${profileNotExists}`])
                    }
                */

                const profileExists = await checkIfProfileExists(allSites[site], username)

                if (profileExists) {
                    // append profile to foundProfiles array
                    const profileUrl = allSites[site].url.replace("{}", username)

                    const foundProfile: SearchResult = {
                        "siteName": site,
                        "siteUrl": allSites[site].urlMain,
                        "username": username,
                        "profileUrl": profileUrl,
                    }

                    foundProfiles.push(foundProfile)
                    // pass.push([site, allSites[site].errorType])     // DEBUG
                }
                // else {   // DEBUG
                //     fail.push([site, allSites[site].errorType])
                // }
                // console.log(`${site} -- profileExists: ${profileExists}\n====================`)     // DEBUG

            } catch(error) {
                // This will ignore any json items that are malformed
                continue
            }
        }
    }


    // console.log("PASSING:")
    // console.log(pass)

    // console.log("FAILING")
    // console.log(fail)


    return foundProfiles
}



/****************************************/
/*          HELPER FUNCTIONS            */
/****************************************/



/**
 * This function sends a request to the website to search for a specified username.
 * The format of the request is based off of the fields in the site JSON argument
 * @param site JSON with data corresponding to the site currently being searched
 * @param username username to search for
 */
const checkIfProfileExists = async (site: Site, username: string) => {
    const errorType: string = site.errorType                                // status_code, message, or response_url
    const url: string = site.url                                            // url for website profile page
    const urlMain: string = site.urlMain                                    // url for website home page
    const username_claimed: string = site.username_claimed                  // username that is claimed on the website
    const username_unclaimed: string = site.username_unclaimed              // username that is not claimed on the website
    const errorMsg: string | string[] | undefined = site.errorMsg           // if errorType = message, this message will pop up if the profile doesn't exist
    const regexCheck: string | undefined = site.regexCheck                  // todo
    const errorUrl: string | undefined = site.errorUrl                      // if errorType = response_url, this is the url that the use will be redirected to if the profile doesn't exist
    const urlProbe: string | undefined = site.urlProbe                      // alternate profile page test url for sites where profiles aren't publicly facing 
    const noPeriod: string | undefined = site.noPeriod                      // todo (never used?)
    const headers: {} | undefined = site.headers                            // todo
    const request_head_only: boolean | undefined = site.request_head_only   // for status_code errorType website -- use a GET request instead of a HEAD request
    const omit: boolean | undefined = site.omit                             // tells program to not process the site


    // Take required profile page URL template and replace '{}' with the username
    const profileUrl = (urlProbe === undefined) ? url.replace("{}", username) : urlProbe.replace("{}", username)

    // Based on JSON data, find request method
    const requestHeaders = findRequestHeaders(errorType, headers, request_head_only)

    let response
    switch (errorType) {
        case "status_code":
            // A 2XX status code (response.status) will be returned if the profile exists.
            // To save time, use a HEAD request (unless explicitly told not to)

            response = await fetch(profileUrl, requestHeaders)
                                    .catch((error: any) => {
                                        console.log(site.urlMain + " - ERROR! - " + error)
                                        return undefined
                                    })

            // If response is undefined, say profile is not found.
            // Otherwise, check if response code is 2XX. If so, profile exists.
            return (response === undefined) ? false : (response.status >= 200 && response.status < 300)
            break


        case "message":
            // 'errorMsg' will be on the page if the profile does not exist
            // response = await fetch(profileUrl, { credentials: 'include' }, 5000)    // timeout after 5s
            response = await fetch(profileUrl, requestHeaders)
                                    .then((r: any) => {
                                        return r.text()
                                    })
                                    .catch((error: any) => {
                                        console.log(site.urlMain + " - ERROR! - " + error)
                                        return undefined
                                    })
            
            if (errorMsg === undefined) { // edge case
                return false
            }
            else if (typeof errorMsg === "string") {     // only one error message to check
                // if the response failed, or the response includes the error message, profile doesn't exist
                return !responseContainsError(response, errorMsg)
            }
            else {  // typeof errorMsg is a string[]
                for (const msg of errorMsg) {
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
            // Server will respond with 'errorUrl' the profile does not exist

            // TODO: prevent redirect, inspect code for previous status_code

            response = await fetch(profileUrl, requestHeaders)
                                .catch((error: any) => {
                                    console.log(site.urlMain + " - ERROR! - " + error)
                                    return undefined
                                })
 
            // a couple of websites have the errorUrl including the searched username. Edge case
            const modifiedErrorUrl = errorUrl?.replace("{}", username)

            // If request fails (undefined), return false.
            // Otherwise, check the redirect url of the response. If that matches the expected 'errorUrl', profile doesn't exist.
            return (response === undefined) ? false : response.url !== modifiedErrorUrl
            return false
            break
    }

    return false    // malformed json entry - errorType needs to be one of (status_code, message, response_url)
}

/**
 * This function simply checks the response body for a specified error message
 * @param response response body to check
 * @param errorMsg errorMsg to look for in 'response'
 */
const responseContainsError = (response: string | undefined, errorMsg: string) => {
    if (response === undefined) {
        // response doesn't include errorMsg, but request clearly failed, so return true anyways since the profile doesn't exist
        return true
    }

    return response.includes(errorMsg)
}

/**
 * This function generates an object that contains the needed request headers, based off of the values in the site JSONs
 * @param errorType status_code, response_url, or message. This is the way for the program to check whether or not the profile exists for this site
 * @param request_head_only if true (or undefined), send only a 'HEAD' request. Otherwise, send a 'GET' request.
 */
const findRequestHeaders = (errorType: string, headers: {} | undefined, request_head_only: boolean | undefined) => {
    let requestType = 'GET'

    if (errorType == "status_code") {
        if (request_head_only === undefined || request_head_only === true) {    // request_head_only needs to explicitly set as false to make request method 'GET'
            requestType = 'HEAD'
        }
    }

    return { 
                method: requestType,
                ...headers
            }
}

export default searchSites  // library function to export, we don't want any other functions to be publicly accessible