'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRankings,RANK_REFRESH_MS}=require('../rankings-v123');
test('rank refresh is throttled and shared across concurrent requests',async()=>{
 let calls=0,updates=0,clock=null;const id='00000000-0000-4000-8000-000000000001';
 const c={async query(sql,args){if(sql.startsWith('INSERT INTO gg_rank_profiles'))return {rowCount:0};if(sql.startsWith('SELECT day,'))return {rows:clock?[clock]:[]};if(sql.startsWith('SELECT p.account_id AS id'))return {rows:[{id,company:1,experience:100000,honor:100,level:2,highest:1}]};if(sql.startsWith('UPDATE gg_rank_profiles')){updates++;assert.equal(args[1][0],21);assert.equal(args[2][0],202);}if(sql.startsWith('INSERT INTO gg_rank_clock'))clock={day:args[0],refreshed_at:args[1]};return {rows:[]};},release(){}};
 const rank=createRankings({async connect(){calls++;return c;}});
 const a=rank.refresh(),b=rank.refresh();assert.equal(a,b);assert.equal(await a,true);assert.equal(await rank.refresh(),false);assert.equal(calls,1);assert.equal(updates,1);assert.equal(RANK_REFRESH_MS,3000);
});
test('leaderboard polls only in its current open view and preserves search input',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/gold-v13.js'),'utf8');
 assert.match(source,/generation===rankViewGeneration&&modal\?\.open&&mode==='Clasificación'/);
 assert.match(source,/if\(active\(\)&&body.contains\(table\)\)setTimeout\(poll,3000\)/);
 assert.match(source,/if\(rowsKey!==lastRows\)/);
});
