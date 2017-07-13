/**
 * @name Neo4j
 * @description Promised based Neo4j-redis database adapter for use with Cypher.
 * @author Carlos Justiniano
 */
'use strict';

const Promise = require('bluebird');
const fetch = require('node-fetch');
const Cacher = require('fwsp-cacher');
const ServerResponse = require('fwsp-server-response');
let serverResponse = new ServerResponse();

class QueryBuilder {
  constructor() {
    this.q = [];
  }

  /**
  * @name add
  * @summary Adds a partial query statement.
  * @param {string / array} partial - query fragment
  */
  add(partial) {
    if (partial.constructor === Array) {
      partial.forEach((element) => {
        this.add(element);
      });
      return;
    }
    this.q.push(partial);
  }

  /**
  * @name toString
  * @summary Returns the full query as a string.
  * @return {string} value - full query as a string
  */
  toString() {
    return this.q.join(' ').
      replace(/\s\s+/g, ' ').
      replace(/(?:\r\n|\r|\n|\t)/g,'').
      trim();
  }
}

class Transaction {
  /**
    * @name constructor
    * @param {string} transactionUrl - transaction URL
    * @param {string} auth - Authorization string
    * @param {object} cacher - Cacher object or null
   */
  constructor(transactionUrl, auth, cacher) {
    this.used = false;
    this.auth = auth;
    this.cacher = cacher;
    this.cached = false;
    this.cachePrefix = '';
    this.cacheKey = '';
    this.cacheDuration = 0;
    this.transactionUrl = transactionUrl;
    this.statements = [];
  }

  /**
    * @name _processTransaction
    * @private
    * @param {function} resolve - promise resolve
    * @param {function} reject - promise resolve
    * @throws Will throw an error if initCacheDB as not been called.
  */
  _processTransaction(resolve, reject) {
    let headers = {
      'content-type': 'application/json',
      'Accept': 'application/json; charset=UTF-8',
      'Authorization': 'Basic ' + this.auth
    };
    let options = {
      headers,
      method: 'post',
      body: JSON.stringify({
        statements: this.statements
      })
    };
    let result = {};
    fetch(this.transactionUrl, options)
      .then((res) => {
        if (res.status !== ServerResponse.HTTP_OK && res.status !== ServerResponse.HTTP_CREATED) {
          fetch(this.transactionUrl, {
            headers,
            'method': 'delete'
          });
          throw new Error(res.statusText);
        }
        return res.json();
      })
      .then((json) => {
        if (json.errors.length > 0) {
          throw json.errors;
        } else {
          result = json.results;
          return fetch(json.commit, {
            headers,
            'method': 'post'
          });
        }
      })
      .then((res) => {
        if (res.status === ServerResponse.HTTP_OK) {
          if (this.cachable) {
            if (!this.cacher) {
              throw new Error('Attempt to use cacher without calling initCacheDB()');
            }
            cacher.setCachePrefix(this.cachePrefix);
            cacher.setData(this.cacheKey, result, this.cacheDuration);
            resolve(result);
          } else {
            resolve(result);
          }
        } else {
          throw new Error('commit failed');
        }
      })
      .catch(reject);
    this.used = true;
  }

  /**
   * @name addQuery
   * @summary Appends a query to the transaction's list of query statements.
   * @param {object} queryBuilder - query builder object
   * @param {object} params - object containing query parameters
   * @return {object} this - for chaining
   */
  addQuery(queryBuilder, params) {
    if (this.used) {
      throw new Error(`Can't reuse transaction`);
    }
    this.statements.push({
      statement: queryBuilder.toString(),
      parameters: params
    });
    return this;
  }

  /**
   * @name cacheable
   * @summary Mark transaction as cacheable.
   * @param {string} prefix - cache key prefix
   * @param {string} key - cache key
   * @param {number} duration - duration of cache in seconds
   * @throws Will throw an error if initCacheDB as not been called.
   */
  cacheable(prefix, key, duration) {
    if (!this.cacher) {
      throw new Error('Attempt to use cacher without calling initCacheDB()');
    }
    this.cached = true;
    this.cachePrefix = prefix;
    this.cacheKey = key;
    this.cacheDuration = duration;
  }

  /**
   * @name execute
   * @description Execute a transaction
   * @return {object} promise - promise object
   */
  execute() {
    return new Promise((resolve, reject) => {
      if (this.cached) {
        cacher.setCachePrefix(this.cachePrefix);
        cacher.getData(this.cacheKey)
          .then((cachedData) => {
            resolve(cachedData);
          })
          .catch((reason) => {
            console.log('reason', reason);
            this._processTransaction(resolve, reject);
          });
      } else {
        this._processTransaction(resolve, reject);
      }
    });
  }
}

class Neo4j {
  constructor() {
    this.graphDatabaseUrl = '';
    this.auth = '';
    this.cacher = null;
  }

  /**
  * @name initGraphDB
  * @summary Initialize Neo4j Graph Database.
  * @param {string} graphDBUrl - path to Neo4j Graph Database
  * @param {string} userName - user name
  * @param {string} password - password
  */
  initGraphDB(graphDBUrl, userName, password) {
    this.graphDatabaseUrl = graphDBUrl;
    this.auth = '';
    if (userName && password) {
      this.auth = new Buffer(userName + ':' + password).toString('base64').toString('utf8');
    }
  }

  /**
  * @name initCacheDB
  * @summary Initialize Redis Database for caching.
  * @param {string} redisUrl - path to Redis Database
  * @param {number} redisPort - database port
  * @param {number} redisDB - database number
  */
  initCacheDB(redisUrl, redisPort, redisDB) {
    this.cacher = new Cacher({
      url: redisUrl,
      port: redisPort,
      db: redisDB
    });
  }

  /**
   * @name createTransaction
   * @description Creates a transaction object
   * @return {object} pCypherTransaction
   */
  createTransaction() {
    return new Transaction(`${this.graphDatabaseUrl}/db/data/transaction`, this.auth, this.cacher);
  }

  /**
   * @name createQueryBuilder
   * @description Creates a new query builder object
   * @return {object} QueryBuilder
   */
  createQueryBuilder() {
    return new QueryBuilder();
  }

  /**
   * @name getSimpleData
   * @description Simple data is defined as a single return value.  A single object qualifies.
   * @param {object} result - result object
   * @returns {object} ret - response data
   */
  getSimpleData(result) {
    var ret = null;
    result = result[0];
    if (!result || !result.data || result.data.length === 0) {
      return ret;
    }
    if (result.columns.length === 1) {
      ret = (typeof result.data[0] === 'object') ? result.data[0].row[0] : result.data[0][0];
    }
    return ret;
  }

  /**
  * @name toProps
  * @summary Convert an object of properties to a property query string.
  * @param {object} obj - object which will be converted to string of key/values
  * @return {string} string of neo4j cypher compatible key / values
  */
  toProps(obj) {
    let ret = [];
    let objKeys = Object.keys(obj);
    objKeys.forEach((k) => {
      if (typeof(obj[k]) === 'string') {
        ret.push(`${k}:"${obj[k]}"`);
      } else if (typeof(obj[k]) === 'number') {
        ret.push(`${k}:${obj[k]}`);
      } else if (typeof(obj[k]) === 'boolean') {
        ret.push(`${k}:${obj[k]}`);
      } else if (typeof(obj[k]) === 'array') {
        ret.push(`${k}:[]`);
      } else {
        throw new Error('property type not supported');
      }
    });
    return ret.join(', ');
  }

  /**
    * @name toNamedProps
    * @summary Converts a named object to a cypher compatible key / value pair.
    * @param {string} name - name of object
    * @param {object} obj - object which will be converted to string of key/values
    * @return {string} string of neo4j cypher compatible key / values
    */
  toNamedProps(name, obj) {
    let ret = [];
    let objKeys = Object.keys(obj);
    objKeys.forEach((k) => {
      ret.push(`${k}:{${name}}.${k}`);
    });
    return ret.join(', ');
  }

  /**
  * @name toSets
  * @summary Convert an object of properties to a group of set statements
  * @param {string} v - query varible
  * @param {string} objName - query param object name
  * @param {object} obj - object which will be converted
  * @note creates string in this format: "SET e.eid = {event}.eid"
  *       query must pass param object named event in the example above
  * @return {string} string of neo4j cypher compatible set statements
  */
  toSets(v, objName, obj) {
    let ret = [];
    let objKeys = Object.keys(obj);
    ret.push('\n');
    objKeys.forEach((k) => {
      ret.push(`  SET ${v}.${k} = {${objName}}.${k}`)
    });
    return ret.join('\n');
  }
}

module.exports = Neo4j;
