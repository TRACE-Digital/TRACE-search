# TRACE Search #
TRACE library for third-party account discovery.

## Building and running on localhost ##

First install dependencies:

```sh
npm install
```

To start:
```sh
npm start
# Open the browser to localhost:8000
```

To create a production build:

```sh
npm run build-prod
```

To create a development build:

```sh
npm run build-dev
```

## Testing ##

```sh
npm test                # Full test suite
npm test --verbose      # Full test suite with more info
npm test -- -h          # Show Jest CLI help
npm test -- --watch     # Re-run affected tests when source code changes are detected
npm test -- -t search   # Run tests that contain 'search'

# Run only a certain test file
npm test -- src/tests/search.test.ts

# If tests get stuck
npm run test-debug
```

## Helpful Scripts ##

```sh
npm run lint    # Run the linter
npm run format  # Run the code formatter
```

## Publishing ##

We don't have the NPM package set up yet, but we can test creating a package locally.

```sh
npm pack
```
