# TRACE search library
##### Chris Cohen

#### Import and Use
```typescript
import { searchSites, SearchResult } from 'search/search';
const usernames = ["cohenchris", "jmcker", ...];
const foundProfiles: SearchResult[] = await searchSites(usernames);
```


#### trace.json fields
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
  noPeriod?: string,            // ???
  headers?: {},                 // headers to send with the request if needed
  request_head_only?: boolean   // for status_code errorType website -- use a GET request instead of a HEAD request
  logoUrl?: string;             // URL to a logo icon (for use in frontend)
  omit?: boolean                // tells program to not process the site
```


#### TODO
- [ ] Figure out how to fix Twitter
- [ ] To avoid a long wait, dynamically give the array of found profiles to the frontend
- [ ] Maybe add regex check?
- [ ] Figure out what the noPeriod field in sherlock.json means
- [ ] Clean up code, refactor, simplify, increase readability, etc.
- [ ] Find logo URL if the frontend isn't?
    - [ ] Async get? This could tie into the dynamically loading array


- [ ] Meet w/ group and figure out format to send to frontend
    - [ ] Add more fields to `SearchResult` interface, if need be
- [ ] Inform users to:
    - [ ] Disable Enhanced Privacy Protection on Firefox for TRACE
    - [ ] Enable 3rd party cookies for TRACE
    - [ ] Disable VPN
    - [ ] Generally make exceptions for TRACE in their web browser
- [ ] Go through Google Doc of sites to add to trace.json
- [ ] CORS
    - [ ] `Access-Control-Allow-Origin: <ORIGIN>`
    - [ ] `Access-Control-Allow-Headers: 'include'`
    - [ ] `Access-Control-Allow-Credentials: 'expose'`
