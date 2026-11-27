'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createRankings}=require('../rankings-v123');
test('ranking refresh aggregates combat counts while preserving rank point calculations',async()=>{
 let args,query,release=0;
 const c={query:async(sql,params)=>{
 if(sql.includes('FROM player_progress p JOIN gg_rank_profiles r USING(account_id)')){query=sql;return {rows:[{id:'a',company:1,experience:100000,honor:100,level:2,days:5,kills:3,allyKills:1,deaths:2,radiation:1},{id:'b',company:1,experience:0,honor:0,level:1,days:0,kills:0,allyKills:0,deaths:0,radiation:0}]};}
 if(sql.startsWith('UPDATE gg_rank_profiles'))args=params;return {rows:[],rowCount:0};},release:()=>release++};
 const r=createRankings({connect:async()=>c});assert.equal(await r.refresh(),true);
 assert.match(query,/FILTER \(WHERE NOT ally\)/);assert.match(query,/GROUP BY victim/);assert.match(query,/COALESCE\(d.radiation,0\)/);
 assert.deepEqual(args[2],[238,100]);assert.equal(release,1);
});
