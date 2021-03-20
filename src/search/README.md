# TRACE search library
##### Chris Cohen

#### Import and Use
```typescript
import { ThirdPartyAccount } from 'search/accounts';
import { findAccount } from 'search/findAccount';

const username = "cohenchris"
const account: ThirdPartyAccount = await findAccount(site,      // Site object
                                                     username,  // username to search for
                                                     search);   // Search object
```


#### Valid Fields for a Site Object
```typescript
  errorType?: string,           // status_code, message, or response_url
  url?: string,                 // url for website profile page
  urlMain?: string,             // url for website home page
  username_claimed?: string,    // username that is claimed on the website
  username_unclaimed?: string,  // username that is not claimed on the website
  errorMsg?: string | string[], // if errorType = message, this message will pop up if the profile doesn't exist
  regexCheck?: string,          // regex for valid usernames on the website
  errorUrl?: string,            // if errorType = response_url, this is the url that the use will be redirected to if the profile doesn't exist
  urlProbe?: string,            // alternate profile page test url for sites where profiles aren't publicly facing 
  noPeriod?: string,            // if "True", denotes that the username should not have a period in it (just use regexCheck instead)
  headers?: {},                 // headers to send with the request if needed
  request_head_only?: boolean   // for status_code errorType website -- use a GET request instead of a HEAD request
  logoClass?: string;           // FontAwesome CSS class for the logo (for use in frontend)
  omit?: boolean                // tells program to not process the site
```

#### General Logic Flow
- Based on Site Object fields such as `request_head_only`, `errorType`, `headers`, and whether or not the user would like to search for their name in the webpage, headers are put into a JSON
  - `headers` are included directly
  - Request method
    - To save time, if `errorType` is `status_code`, use a 'HEAD' request (unless `request_head_only` says otherwise, or you need the response body to search for first/last names
    - Otherwise, use a 'GET' request
- If `errorType` is `status_code`,
  - If the response code is 2XX, the account exists
  - Otherwise, the account doesn't exist
- If `errorType` is `message`,
  - If the `message` field is present in the response body, the account exists
  - Otherwise, the account doesn't exist
- If `errorType` is `response_url`,
  - If the request redirects you to the `errorUrl` field, the account does NOT exist
  - Otherwise, the account exists
- If the user specifies, search for the first/last names in the response body


#### TODO
- [ ] Figure out how to fix Twitter?

- [ ] Inform users to:
    - [ ] Disable Enhanced Privacy Protection on Firefox for TRACE
    - [ ] Enable 3rd party cookies for TRACE
    - [ ] Disable VPN
    - [ ] Generally make exceptions for TRACE in their web browser
- [ ] Go through Google Doc of sites to add to trace.json
