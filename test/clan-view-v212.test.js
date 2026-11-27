'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createClans}=require('../clans-v15');
test('clan view reads membership and applications in a consistent transaction and releases on error',async()=>{
 const queries=[];let released=0,failRead=false;
 const client={query:async sql=>{queries.push(sql);if(sql.startsWith('SELECT c.*,m.permissions'))return {rows:[]};if(sql.startsWith('SELECT id,name,tag')){if(failRead)throw Error('read failed');return {rows:[{id:'c'}]};}if(sql.startsWith('SELECT clan_id FROM'))return {rows:[{clan_id:'c'}]};return {rows:[]};},release:()=>released++};
 const clans=createClans({connect:async()=>client});const r=await clans.view('a');
 assert.equal(r.clan,null);assert.equal(r.applications[0],'c');assert.equal(queries[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(queries.at(-1),'COMMIT');assert.equal(released,1);
 failRead=true;await assert.rejects(clans.view('a'),/read failed/);assert.equal(queries.at(-1),'ROLLBACK');assert.equal(released,2);
});
