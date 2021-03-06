import { toId } from 'db';
import { Search } from 'search';
import { Site } from 'sites';
import { AutoSearchAccount, FailedAccount, RegisteredAccount, UnregisteredAccount } from './accounts';
import fetchWithTimeout from './fetchWithTimeout'; // fetchWithTimeout(url, options, timeout_ms = 10000)

/**
 * This function sends a request to the website to search for a specified username.
 * The format of the request is based off of the fields in the site JSON argument
 * Returns a JSON with fields denoting whether the account is found or not)
 * @param site JSON with data corresponding to the site currently being searched
 * @param username username to search for
 * @param search Parent search object
 */
export const findAccount = async (site: Site, username: string, search?: Search): Promise<AutoSearchAccount> => {
  const errorType: string = site.errorType; // status_code, message, or response_url
  const url: string = site.url; // url for website profile page
  // const urlMain: string = site.urlMain                                    // url for website home page
  const errorMsg: string | string[] | undefined = site.errorMsg; // if errorType = message, this message will pop up if the profile doesn't exist
  // const regexCheck: string | undefined = site.regexCheck                  // todo
  const errorUrl: string | undefined = site.errorUrl; // if errorType = response_url, this is the url that the use will be redirected to if the profile doesn't exist
  const urlProbe: string | undefined = site.urlProbe; // alternate profile page test url for sites where profiles aren't publicly facing
  // const noPeriod: string = site.noPeriod || "False"                       // todo (never used?)
  const headers: object = site.headers || {}; // headers to send with the request if needed
  let requestHeadOnly: boolean | undefined = site.request_head_only; // for status_code errorType website -- use a GET request instead of a HEAD request
  if (requestHeadOnly === undefined) {
    requestHeadOnly = true;
  }
  // const omit: boolean = site.omit || false                                // tells program to not process the site

  const firstNames: string[] = search?.definition.firstNames || [];
  const lastNames: string[] = search?.definition.lastNames || [];
  const lookForNames: boolean = lastNames.length !== 0 || firstNames.length !== 0;

  // prefix id for database - return at the end
  const resultIdPrefix = search ? toId(['searchResult'], search.id) : undefined;

  // This came up after misnaming a trace.json site that was supposed to overlay
  // a sherlock.json site. It ended up with only trace.json fields and was missing everything
  if (url === undefined && urlProbe === undefined) {
    const failedAccount = new FailedAccount(site, username, resultIdPrefix);
    failedAccount.reason = `Something went wrong: urlProbe and url were both undefined
      Name: ${site.name}
      urlMain: ${site.urlMain}
      Keys: ${Object.keys(site)}
      Values: ${Object.values(site)}
    `;

    console.error(failedAccount.reason);
    return failedAccount;
  }

  // Take required profile page URL template and replace '{}' with the username
  const profileUrl = urlProbe === undefined ? url.replace('{}', username) : urlProbe.replace('{}', username);

  // Based on JSON data, find request method
  const requestHeaders = findRequestHeaders(errorType, headers, requestHeadOnly, lookForNames);

  let accountFound: boolean = false; // this will be updated to true if account is found during search
  let accountError: string = '';
  let matchedFirstNames: string[] = []; // if accountFound, any first names present in the page will be added to this
  let matchedLastNames: string[] = []; // if accountFound, any last names present in the pages will be added to this

  switch (errorType) {
    case 'status_code':
      // A 2XX status code (response.status) will be returned if the profile exists.
      // To save time, use a HEAD request (unless explicitly told not to, or a name needs to be searched for in response body)
      let statusResponse: Response;
      try {
        statusResponse = await fetchWithTimeout(profileUrl, requestHeaders);
      } catch (e) {
        accountError = e.toString();
        break;
      }

      accountFound = statusResponse.status >= 200 && statusResponse.status < 300;

      if (accountFound) {
        // if the account is found, also look for first and last names in the page
        let statusResponseBody: string = '';
        statusResponseBody = await statusResponse.text();
        matchedFirstNames = findNames(statusResponseBody, firstNames);
        matchedLastNames = findNames(statusResponseBody, lastNames);
      }

      break;

    case 'message':
      // 'errorMsg' will be on the page if the profile does not exist
      let messageResponse: Response;
      try {
        messageResponse = await fetchWithTimeout(profileUrl, requestHeaders);
      } catch (e) {
        accountError = e.toString();
        break;
      }

      const responseBody = await messageResponse.text();

      if (errorMsg === undefined) {
        // edge case
        accountFound = false;
      } else if (typeof errorMsg === 'string') {
        // only one error message to check
        // if the response failed, or the response includes the error message, profile doesn't exist
        accountFound = !responseContainsError(responseBody, errorMsg);
      } else if (errorMsg instanceof Array) {
        // typeof errorMsg is a string[]
        for (const msg of errorMsg) {
          if (responseContainsError(responseBody, msg)) {
            // if the response failed, or the response includes one of the error messages, profile doesn't exist
            accountFound = false;
          }
        }
        // If neither error message ever popped up, profile exists
        accountFound = true;
      } else {
        accountError = `Unsupported error message type: ${typeof errorMsg}/${errorMsg}`;
        break;
      }

      if (accountFound) {
        // if the account is found, also look for first and last names in the page
        // message_response is already the body text. pass this into findNames
        matchedFirstNames = findNames(responseBody, firstNames);
        matchedLastNames = findNames(responseBody, lastNames);
      }

      break;

    case 'response_url':
      // Server will respond with 'errorUrl' the profile does not exist
      let urlResponse: Response;
      try {
        urlResponse = await fetchWithTimeout(profileUrl, requestHeaders);
      } catch (e) {
        accountError = e.toString();
        break;
      }

      // a couple of websites have the errorUrl including the searched username. Edge case
      const modifiedErrorUrl = errorUrl?.replace('{}', username);

      // If request fails (undefined), return false.
      // Otherwise, check the redirect url of the response. If that matches the expected 'errorUrl', profile doesn't exist.
      accountFound = urlResponse.url !== modifiedErrorUrl;

      if (accountFound) {
        // if the account is found, also look for first and last names in the page
        let urlResponseBody = '';
        if (urlResponse) {
          urlResponseBody = await urlResponse.text();
        }
        matchedFirstNames = findNames(urlResponseBody, firstNames);
        matchedLastNames = findNames(urlResponseBody, lastNames);
      }

      break;

    default:
      accountError = `Unsupported error type '${errorType}' for '${site.name}'`;
      break;
  }

  if (accountError) {
    console.log(`ERROR! - ${site.name} - ${profileUrl} - ${accountError}`);

    const failedAccount = new FailedAccount(site, username, resultIdPrefix);
    failedAccount.reason = accountError;
    return failedAccount;
  }

  if (accountFound) {
    const account = new RegisteredAccount(site, username, resultIdPrefix);
    account.matchedFirstNames = matchedFirstNames;
    account.matchedLastNames = matchedLastNames;
    return account;
  } else {
    return new UnregisteredAccount(site, username, resultIdPrefix);
  }
};

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
    return true;
  }

  return response.toLowerCase().includes(errorMsg.toLowerCase());
};

/**
 * This function generates an object that contains the needed request headers, based off of the values in the site JSONs
 * @param errorType status_code, response_url, or message. This is the way for the program to check whether or not the profile exists for this site
 * @param requestHeadOnly if true (or undefined), send only a 'HEAD' request. Otherwise, send a 'GET' request.
 */
const findRequestHeaders = (
  errorType: string,
  headers: {} | undefined,
  requestHeadOnly: boolean | undefined,
  lookForNames: boolean,
) => {
  let requestType = 'GET';

  if (errorType === 'status_code') {
    if (requestHeadOnly === undefined || requestHeadOnly === true) {
      // requestHeadOnly needs to explicitly set as false to make request method 'GET'
      if (!lookForNames) {
        // If you don't have to look for names, HEAD request is fine. Otherwise, if you are, you MUST use a GET request to get response body
        requestType = 'HEAD';
      }
    }
  }

  return {
    method: requestType,
    ...headers,
  };
};

/**
 * This function searches the response body for any of the names in the passed names argument.
 * It will return a string[] of names that are present in the response body
 * @param response_body The response object from a fetch call
 * @param names The string[] of names to search for in the response body
 */
const findNames = (responseBody: string, names: string[]): string[] => {
  const foundNames: string[] = [];

  for (const name of names) {
    if (responseBody.toLowerCase().includes(name.toLowerCase())) {
      foundNames.push(name);
    }
  }

  return foundNames;
};
