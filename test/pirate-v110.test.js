'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PIRATE,pirateLoot,bonusLoot}=require('../loot-v14');
test('pirate table covers all 100 outcomes and exact weights',()=>{
 const counts={};for(let r=0;r<100;r++){const loot=pirateLoot(r);counts[loot.code]=(counts[loot.code]||0)+1;assert.ok(loot.quantity>0);assert.equal(loot.weight,undefined);}
 assert.deepEqual(counts,{'UCB-100':45,uridium:25,credits:15,'log-disk':10,'LF-3':4,'LF-4':1});
 assert.equal(PIRATE.reduce((n,x)=>n+x.weight,0),100);
 assert.equal(pirateLoot(99).category,'lasers');
});
test('invalid rolls rejected; ordinary bonus unchanged',()=>{
 for(const roll of [-1,100,0.5,NaN,Infinity,'1'])assert.throws(()=>pirateLoot(roll));
 assert.deepEqual(bonusLoot(0,0),{code:'LCB-10',quantity:10});
});

const {createInventory}=require('../inventory-v13');
function fakePool({key=true,failReward=false}={}){
 const queries=[];const client={async query(sql,args){queries.push({sql,args});
 if(sql.startsWith('SELECT credits,uridium'))return {rows:[{credits:100,uridium:100}]};
 if(sql.startsWith('UPDATE gg_v13_ammo SET quantity=quantity-1'))return {rows:key?[{quantity:'2'}]:[]};
 if(sql.startsWith('UPDATE player_progress')||sql.startsWith('INSERT INTO gg_v13_')){if(failReward)throw Error('reward write failed');return {rows:[{credits:100,uridium:100}]};}
 return {rows:[]};
 },release(){}};
 return {queries,pool:{async connect(){return client;}}};
}
test('pirate chest consumes one key and commits reward atomically',async()=>{
 const {pool,queries}=fakePool();const result=await createInventory(pool).awardBox('test-account','5-1',14,'pirate');
 assert.equal(result.keys,2);assert.equal(queries[0].sql,'BEGIN');assert.equal(queries.at(-1).sql,'COMMIT');
 assert.equal(queries.filter(q=>q.sql.startsWith('UPDATE gg_v13_ammo SET quantity=quantity-1')).length,1);
 assert.ok(queries.some(q=>q.sql.startsWith('UPDATE player_progress')||q.sql.startsWith('INSERT INTO gg_v13_')));
});
test('no key and failed rewards rollback; non-pirate maps are rejected',async()=>{
 const a=fakePool({key:false});
 await assert.rejects(createInventory(a.pool).awardBox('test-account','5-1',14,'pirate'),{code:'NO_GREEN_KEY'});
 assert.equal(a.queries.at(-1).sql,'ROLLBACK');
 assert.ok(!a.queries.some(q=>q.sql.startsWith('INSERT INTO gg_v13_')||q.sql.startsWith('UPDATE player_progress')));
 const b=fakePool({failReward:true});
 await assert.rejects(createInventory(b.pool).awardBox('test-account','5-2',14,'pirate'),/reward write failed/);
 assert.equal(b.queries.at(-1).sql,'ROLLBACK');
 const c=fakePool();await assert.rejects(createInventory(c.pool).awardBox('test-account','1-1',1,'pirate'),/fuera de zona/);assert.equal(c.queries.length,0);
});
