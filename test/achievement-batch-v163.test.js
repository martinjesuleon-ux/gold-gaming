'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createAchievements}=require('../achievements-v125');
test('batch achievement reads preserve individual results and use three queries',async()=>{
 let calls=0;const gates=[{account_id:'a',gate:'alpha',completions:1},{account_id:'a',gate:'kappa',completions:2}],titles=[{account_id:'a',title:'kappa'},{account_id:'b',title:'uba'},{account_id:'c',title:'kronos'}];
 const pool={async query(sql,args){calls++;if(sql.includes('FROM gg_v14_gates')){const batch=sql.includes('ANY(');return {rows:batch?gates.filter(r=>args[0].includes(r.account_id)):gates.filter(r=>r.account_id===args[0]).map(({account_id,...r})=>r)};}if(sql.includes('FROM gg_achievement_titles'))return {rows:sql.includes('ANY(')?titles.filter(r=>args[0].includes(r.account_id)):titles.filter(r=>r.account_id===args[0]).map(({account_id,...r})=>r)};if(sql.includes('LIMIT 1'))return {rows:[{account_id:'b'}]};throw Error(sql);}};
 const a=createAchievements(pool),ids=['a','b','c','d'],expected=new Map();
 for(const id of ids)expected.set(id,await a.read(id));assert.equal(calls,12);calls=0;
 const batch=await a.readMany([...ids,'a']);assert.deepEqual(batch,expected);assert.equal(calls,3);
 assert.equal((await a.readMany([])).size,0);assert.equal(calls,3);
});
