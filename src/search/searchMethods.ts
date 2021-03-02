import { toId } from 'db';
import { Search } from 'search';
import { allSites, Site, SiteList } from 'sites';
import { DiscoveredAccount, ThirdPartyAccount, UnregisteredAccount } from './accounts';
import fetchWithTimeout from './fetchWithTimeout'      // fetchWithTimeout(url, options, timeout_ms = 10000)


/**
 * This function sends a request to the website to search for a specified username.
 * The format of the request is based off of the fields in the site JSON argument
 * Returns a JSON with fields denoting whether the account is found or not)
 * @param site JSON with data corresponding to the site currently being searched
 * @param username username to search for
 * @param search Parent search object
 */
export const findAccount = async (site: Site, username: string, search: Search | null) : Promise<ThirdPartyAccount> => {
    const errorType: string = site.errorType                                // status_code, message, or response_url
    const url: string = site.url                                            // url for website profile page
    const urlMain: string = site.urlMain                                    // url for website home page
    const errorMsg: string | string[] | undefined = site.errorMsg           // if errorType = message, this message will pop up if the profile doesn't exist
    const regexCheck: string | undefined = site.regexCheck                  // todo
    const errorUrl: string | undefined = site.errorUrl                      // if errorType = response_url, this is the url that the use will be redirected to if the profile doesn't exist
    const urlProbe: string | undefined = site.urlProbe                      // alternate profile page test url for sites where profiles aren't publicly facing 
    const noPeriod: string = site.noPeriod || "False"                       // todo (never used?)
    const headers: object = site.headers || {}                              // headers to send with the request if needed
    const request_head_only: boolean = site.request_head_only || true       // for status_code errorType website -- use a GET request instead of a HEAD request
    const omit: boolean = site.omit || false                                // tells program to not process the site

    // prefix id for database - return at the end
    const resultIdPrefix = search ? toId(['searchResult'], search.id) : undefined

    // Take required profile page URL template and replace '{}' with the username
    const profileUrl = (urlProbe === undefined) ? url.replace("{}", username) : urlProbe.replace("{}", username)

    // Based on JSON data, find request method
    const requestHeaders = findRequestHeaders(errorType, headers, request_head_only)

    // this will be updated to true if account is found during search
    let accountFound = false

    switch (errorType) {
        case "status_code":
            // A 2XX status code (response.status) will be returned if the profile exists.
            // To save time, use a HEAD request (unless explicitly told not to)
            const status_response = await fetchWithTimeout(profileUrl, requestHeaders)
                                    .catch((error: any) => {
                                        console.log(site.urlMain + " - ERROR! - " + error)
                                        return undefined
                                    })

            // If response is undefined, say profile is not found.
            // Otherwise, check if response code is 2XX. If so, profile exists.
            accountFound = ( (status_response === undefined) ? false : (status_response.status >= 200 && status_response.status < 300) )
            break


        case "message":
            // 'errorMsg' will be on the page if the profile does not exist
            const message_response = await fetchWithTimeout(profileUrl, requestHeaders)
                                    .then((r: any) => {
                                        return r.text()
                                    })
                                    .catch((error: any) => {
                                        console.log(site.urlMain + " - ERROR! - " + error)
                                        return undefined
                                    })
            
            if (errorMsg === undefined) { // edge case
                accountFound = false
            }
            else if (typeof errorMsg === "string") {     // only one error message to check
                // if the response failed, or the response includes the error message, profile doesn't exist
                accountFound = !responseContainsError(message_response, errorMsg)
            }
            else {  // typeof errorMsg is a string[]
                for (const msg of errorMsg) {
                    if (responseContainsError(message_response, msg)) {
                        // if the response failed, or the response includes one of the error messages, profile doesn't exist
                        accountFound = false
                    }
                }
                // If neither error message ever popped up, profile exists
                accountFound = true
            }
            break


        case "response_url":
            // Server will respond with 'errorUrl' the profile does not exist
            const url_response = await fetchWithTimeout(profileUrl, requestHeaders)
                                .catch((error: any) => {
                                    console.log(site.urlMain + " - ERROR! - " + error)
                                    return undefined
                                })
 
            // a couple of websites have the errorUrl including the searched username. Edge case
            const modifiedErrorUrl = errorUrl?.replace("{}", username)

            // If request fails (undefined), return false.
            // Otherwise, check the redirect url of the response. If that matches the expected 'errorUrl', profile doesn't exist.
            accountFound = ( (url_response === undefined) ? false : url_response.url !== modifiedErrorUrl )
            break
    }

    if (accountFound) {
        return new DiscoveredAccount(site, username, resultIdPrefix);
    }
    else {
        return new UnregisteredAccount(site, username, resultIdPrefix)
    }

}



/****************************************/
/*          HELPER FUNCTIONS            */
/****************************************/



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

    if (errorType === "status_code") {
        if (request_head_only === undefined || request_head_only === true) {    // request_head_only needs to explicitly set as false to make request method 'GET'
            requestType = 'HEAD'
        }
    }

    return { 
                method: requestType,
                ...headers
            }
}