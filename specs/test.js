'use strict';

require('./helpers/chai.js');
const Neo4j  = require('../index.js') ;
const config = require('./properties').value;

let neo4j = new Neo4j();
neo4j.initGraphDB(config.neo4j.url, config.neo4j.userName, config.neo4j.password);
neo4j.initCacheDB(config.redis.url, config.redis.port, config.redis.db);

describe('neo4j module', () => {
  it('should be able to add an object', (done) => {
    let transaction = neo4j.createTransaction();
    let q = neo4j.createQueryBuilder();
    q.add(`CREATE (s:Student {name:{student}.name, grade:{student}.grade})`);
    q.add(`RETURN s`);
    transaction.addQuery(q, {
      student: {
        name: 'Scott Riggs',
        grade: 12
      }
    });
    transaction.execute()
      .then((result) => {
        return neo4j.getSimpleData(result);
      })
      .then((result) => {
        expect(result.name).to.be.equal('Scott Riggs');
        expect(result.grade).to.be.equal(12);
        done();
      })
      .catch((err) => {
        console.log('err', err);
        done();
      });
  });

  it('should be able to issue a multiple query transaction', (done) => {
    let transaction = neo4j.createTransaction();
    let studentNames = ['Tommy Riggs', 'Susan Williams', 'Jamie Sanchez'];
    studentNames.forEach((studentName) => {
      let q = neo4j.createQueryBuilder();
      q.add(`CREATE (s:Student {name:{student}.name, grade:{student}.grade})`);
      q.add(`RETURN s`);
      transaction.addQuery(q, {
        student: {
          name: studentName,
          grade: 12
        }
      });
    });
    transaction.execute()
      .then((result) => {
        expect(result.length).to.be.equal(studentNames.length);
        done();
      })
      .catch((err) => {
        console.log('err', err);
        done();
      });
  });

  it('should be able to convert an object of properties to a property query string', () => {
    let props = neo4j.toProps({
      name: 'Tim Jones',
      grade: 9
    });
    expect(props).to.be.equal('name:"Tim Jones", grade:9');
  });

  it('should be able to convert a named object to a cypher compatible key / value pair', () => {
    let pairs = neo4j.toNamedProps('student', {
      name: 'Tim Jones',
      grade: 9
    });
    expect(pairs).to.be.equal('name:{student}.name, grade:{student}.grade');
  });

  it('should be able to delete items', (done) => {
    let transaction = neo4j.createTransaction();
    let q = neo4j.createQueryBuilder();
    q.add(`MATCH (s:Student)`);
    q.add(`DELETE(s)`);
    transaction.addQuery(q, {});
    transaction.execute()
      .then((result) => {
        expect(result.data).to.be.empty;
        done();
      })
      .catch((err) => {
        console.log('err', err);
        done();
      });
  });

});
