# Neo4j-redis [![npm version](https://badge.fury.io/js/neo4j-redis.svg)](https://badge.fury.io/js/neo4j-redis)
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/neo4j-redis" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/neo4j-redis.svg" alt="NPM downloads" /></a></span>
Neo4j, a promised-based Neo4j transactions adapter which optionally supports caching using Redis.

## Usage
```javascript
const config = require('./properties').value;
const Neo4j = require('neo4j-redis');
let neo4j = new Neo4j();
neo4j.initGraphDB('http://127.0.0.1:7474', 'neo4j', 'password');
```

## APIs
This module contains a core exported class Neo4j. In turn it also creates `Transaction` and `QueryBuilder` objects.

#### Core API

| Method | Description | Notes |
| --- | --- | --- |
| initGraphDB | Initialize Neo4j Graph Database | Required |
| initCacheDB | Initialize Redis Database for caching | Only used if caching is desired |
| createTransaction | Creates a transaction object | See Transaction API section |
| createQueryBuilder | Creates a new query builder object | See Query Build API section |
| getSimpleData | Helper to extra simple data responses | Simple data is defined as a single return value.  A single object qualifies |
| toProps | Convert an object of properties to a property query string | |
| toNamedProps | Converts a named object to a cypher compatible key / value pair | |

#### Transaction API
| Method | Description | Notes |
| --- | --- | --- |
| addQuery | Appends a query to the transaction's list of query statements | Requires a Query Builder object and params |
| cacheable | Marks a transaction as cacheable ||
| execute | Executes a transaction ||

#### Query Builder API

| Method | Description | Notes |
| --- | --- | --- |
| add | Adds a partial query statement | |
| toString | Returns the full query as a string ||

## Tests

The `specs` folder contains tests.

To run the tests you first need to install mocha:

```shell
$ npm install mocha -g
```

Then run:

```shell
$ npm run test
```
