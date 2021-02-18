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

# OR

node dist/trace-search.js
```

To create a production build:

```sh
npm run build-prod
```

To create a development build:

```sh
npm run build-dev
```

## Running ##

```sh
npm run build-dev && node dist/trace-search.js
```

## Publishing ##

We don't have the NPM package set up yet, but we can test creating a package locally.

```sh
npm pack
```
