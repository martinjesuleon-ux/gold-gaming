'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGroups}=require('../groups-v15');
test('invitations, leader transfer, expiration and reward conservation',()=>{
 const g=createGroups();g.create('a');g.create('b');
 g.invite('a','c',1000);
 assert.equal(g.invite('a','c',2000).until,61000);
 assert.throws(()=>g.invite('b','c',2000),/pendiente/);
 g.decline('c','a',2000);assert.equal(g.pending('c',2000),null);
 g.invite('b','c',2000);assert.equal(g.pending('c',62000),null);
 g.invite('a','c',63000);g.accept('c','a',63001);
 assert.equal(g.status('c').leader,'a');
 g.invite('a','d',64000);g.transfer('a','c');
 assert.equal(g.status('a').leader,'c');assert.equal(g.pending('d',64001),null);
 assert.throws(()=>g.transfer('a','c'),/liderazgo/);
 g.invite('c','d',65000);g.leave('c');
 assert.equal(g.pending('d',65001),null);assert.equal(g.status('a').leader,'a');
 assert.deepEqual(g.split(10,['a','c','d'],'c'),{a:3,c:4,d:3});
});