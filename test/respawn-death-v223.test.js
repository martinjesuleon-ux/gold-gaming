'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createRespawn,validDestination}=require('../respawn-v222');
const death='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002',dest={zone:'1-3',x:100,y:200};
function fixture(){
 let state=null,receipt=null,debits=0;const calls=[];
 const c={release(){},async query(sql,a){calls.push(sql);
 if(sql.startsWith('SELECT account_id'))return {rows:[{account_id:id}]};
 if(sql.startsWith('SELECT uridium'))return {rows:[{uridium:1000}]};
 if(sql.startsWith('SELECT 1 FROM gg_respawn_receipts'))return {rows:receipt?[{}]:[]};
 if(sql.startsWith('SELECT response'))return {rows:receipt?[{response:receipt}]:[]};
 if(sql.startsWith('SELECT death_id,ready_at'))return {rows:state?[{death_id:state.deathId,ready_at:state.readyAt}]:[]};
 if(sql.startsWith('SELECT until_ms')||sql.startsWith('SELECT quantity'))return {rows:[]};
 if(sql.startsWith('INSERT INTO gg_respawn_deaths')){if(!state||state.deathId!==a[1])state={deathId:a[1],destination:JSON.parse(a[2]),readyAt:a[3]};}
 if(sql.startsWith('UPDATE player_progress')){debits++;return {rowCount:1};}
 if(sql.startsWith('INSERT INTO gg_respawn_receipts'))receipt=JSON.parse(a[2]);
 if(sql.startsWith('DELETE FROM gg_respawn_deaths')&&state?.deathId===a[1])state=null;
 return {rows:[]};}};
 return {service:createRespawn({connect:async()=>c,query:async()=>({rows:state?[state]:[]})}),get state(){return state},get debits(){return debits},calls};
}
const cases=[
 ['destroyed ship survives reconnect',async()=>{const f=fixture();await f.service.markDeath(id,death,dest,Date.now()-1);const s=await f.service.deathState(id);assert.equal(s.deathId,death);assert.deepEqual(s.destination,dest);}],
 ['repeated destruction preserves first ready time',async()=>{const f=fixture();await f.service.markDeath(id,death,dest,1);await f.service.markDeath(id,death,dest,2);assert.equal(f.state.readyAt,1);}],
 ['free base repair clears persisted destruction',async()=>{const f=fixture();await f.service.markDeath(id,death,dest,1);await f.service.charge(id,death,'base',{zone:'1-1',x:6000,y:4000},true);assert.equal(f.state,null);assert.equal(f.debits,0);}],
 ['paid repair clears death and never debits again',async()=>{const f=fixture();await f.service.markDeath(id,death,dest,1);await f.service.charge(id,death,'position',dest,true);await f.service.markDeath(id,death,dest,1);await f.service.charge(id,death,'position',dest,true);assert.equal(f.state,null);assert.equal(f.debits,1);}],
 ['missing death is rejected',async()=>{const f=fixture();await assert.rejects(f.service.charge(id,death,'position',dest,true));assert.equal(f.debits,0);}],
 ['repair before ready time is rejected',async()=>{const f=fixture();await f.service.markDeath(id,death,dest,Date.now()+60000);await assert.rejects(f.service.charge(id,death,'position',dest,true));assert.equal(f.debits,0);}],
 ['nonexistent map rejected',async()=>{assert.equal(validDestination({...dest,zone:'5-8'}),false);}]
];
for(const [name,fn] of cases)test(name,fn);
