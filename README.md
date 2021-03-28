[![codecov](https://codecov.io/gh/TRACE-Digital/TRACE-search/branch/main/graph/badge.svg?token=WLKWAZBHEB)](https://codecov.io/gh/TRACE-Digital/TRACE-search)

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

npm run test-all        # Run all tests, including super long running ones
npm run test-debug      # If tests get stuck
```

## Testing with External Project ##

To test with an external project that consumes the library, you can:
- Install NPM
- Link locally
- Install from Git

### Install from NPM ###

Install the official version of the package published on NPM.

```sh
cd external-project
npm install trace-search
```

### Link Locally ###

If you are actively working on integrating the library with an external project,
this is the best method. The package is symlinked into the global collection of NPM packages.
Changes should propagate quickly and without extra work.

See https://docs.npmjs.com/cli/v6/commands/npm-link for more.

```sh
cd external-project
npm link ../trace-search

cd ../trace-search
npm build-dev -- --watch

### OR the long way

cd trace-search
npm link trace-search   # Link our local directory into the global package folder

cd external-project
npm link trace-search   # Link the global package into the project

cd ../trace-search
npm build-dev -- --watch
```

### Install from Git ###

This is the slowest but doesn't rely on configuring/managing local directories.
If you only need to consume the library and aren't actively developing it, this is the best option.

The repository is private right now, so you need credentials in your URL.
This will eventually be deactivated and removed.

```sh
cd external-project
npm install git+https://trace-digi-bot:dea7cfe0d9c4a88290d7ab9c1676e3ccc44592d3@github.com/TRACE-Digital/trace-search.git

# To update to the latest changes in the default branch
npm upgrade trace-search
```

## Helpful Scripts ##

```sh
npm run lint    # Run the linter
npm run format  # Run the code formatter
```

## Publishing ##

```sh
# Test creating the package locally
npm pack

# Publish to NPM
npm publish
```
