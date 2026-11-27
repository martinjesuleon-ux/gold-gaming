'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PIRATE,pirateLoot,bonusLoot}=require('../loot-v14');
test('wiki pirate table covers all 1000 outcomes and exact weights',()=>{
 const expected=[209,169,120,80,80,60,60,50,50,35,30,15,12,12,10,4,4];
 assert.deepEqual(PIRATE.map(x=>x[1]),expected);
 assert.equal(PIRATE.reduce((n,x)=>n+x[1],0),1000);
 let offset=0;for(const [code,weight,min,max,group] of PIRATE){
  for(let r=offset;r<offset+weight;r++){const loot=pirateLoot(r,0,0);assert.equal(loot.code,group?.[0][0]||code);assert.equal(loot.quantity,min);assert.equal(pirateLoot(r,.999999,.999999).quantity,max);}
  offset+=weight;
 }
 assert.equal(pirateLoot(970).code,'LF-4');
 assert.deepEqual(pirateLoot(999),{code:'zeus',quantity:1,category:'drones'});
});
test('invalid rolls rejected; ordinary bonus unchanged',()=>{
 for(const roll of [-1,1000,0.5,NaN,Infinity,'1'])assert.throws(()=>pirateLoot(roll));
 assert.deepEqual(bonusLoot(0,0),{code:'LCB-10',quantity:10});
});

const {createInventory}=require('../inventory-v13');
const crypto=require('node:crypto');
function fakePool({key=true,failReward=false}={}){
 const queries=[];const client={async query(sql,args){queries.push({sql,args});
 if(sql.startsWith('SELECT credits,uridium'))return {rows:[{credits:100,uridium:100}]};
 if(sql.startsWith('UPDATE gg_v13_ammo SET quantity=quantity-1'))return {rows:key?[{quantity:'2'}]:[]};
 if(sql.startsWith('UPDATE player_progress')||sql.startsWith('INSERT INTO gg_v13_')){if(failReward)throw Error('reward write failed');return {rows:[{credits:100,uridium:100}]};}
 return {rows:[]};
 },release(){}};
 return {queries,pool:{async connect(){return client;}}};
}
test('pirate chest consumes one key and commits reward atomically',async t=>{
 t.mock.method(crypto,'randomInt',()=>0);
 const {pool,queries}=fakePool();const result=await createInventory(pool).awardBox('test-account','5-1',14,'pirate');
 assert.equal(result.keys,2);assert.equal(queries[0].sql,'BEGIN');assert.equal(queries.at(-1).sql,'COMMIT');
 assert.equal(queries.filter(q=>q.sql.startsWith('UPDATE gg_v13_ammo SET quantity=quantity-1')).length,1);
 assert.ok(queries.some(q=>q.sql.startsWith('UPDATE player_progress')||q.sql.startsWith('INSERT INTO gg_v13_')));
});
test('no key and failed rewards rollback; invalid maps are rejected',async t=>{
 t.mock.method(crypto,'randomInt',()=>0);
 const a=fakePool({key:false});
 await assert.rejects(createInventory(a.pool).awardBox('test-account','5-1',14,'pirate'),{code:'NO_GREEN_KEY'});
 assert.equal(a.queries.at(-1).sql,'ROLLBACK');
 assert.ok(!a.queries.some(q=>q.sql.startsWith('INSERT INTO gg_v13_')||q.sql.startsWith('UPDATE player_progress')));
 const b=fakePool({failReward:true});
 await assert.rejects(createInventory(b.pool).awardBox('test-account','5-2',14,'pirate'),/reward write failed/);
 assert.equal(b.queries.at(-1).sql,'ROLLBACK');
 const c=fakePool();await assert.rejects(createInventory(c.pool).awardBox('test-account','invalid',1,'pirate'),/Mapa inválido/);assert.equal(c.queries.length,0);
});
