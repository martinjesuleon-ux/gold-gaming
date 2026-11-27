'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const respawn=require('../respawn-v222');

const {createRespawn,validDestination}=respawn;
const death='00000000-0000-4000-8000-000000000001',destination={zone:'1-3',x:77,y:88};
function fixture(){
 let receipt=null,delivered=false,debits=0;const calls=[];
 const c={release(){},async query(sql,a){calls.push(sql);if(sql.startsWith('SELECT uridium'))return {rows:[{uridium:1000}]};if(sql.startsWith('SELECT response'))return {rows:receipt?[{response:receipt.response}]:[]};if(sql.startsWith('SELECT until_ms')||sql.startsWith('SELECT quantity'))return {rows:[]};if(sql.startsWith('UPDATE player_progress')){debits++;return {rowCount:1};}if(sql.startsWith('INSERT INTO gg_respawn_receipts'))receipt={deathId:a[1],response:JSON.parse(a[2]),destination:JSON.parse(a[3])};return {rows:[]};}};
 const pool={connect:async()=>c,async query(sql,a){if(sql.startsWith('SELECT death_id'))return {rows:receipt&&!delivered?[receipt]:[]};if(sql.startsWith('UPDATE gg_respawn_receipts')){if(!receipt||delivered||receipt.deathId!==a[1])return {rowCount:0};delivered=true;return {rowCount:1};}return {rows:[]};}};
 return {service:createRespawn(pool),get debits(){return debits},calls};
}
const cases=[
 ['valid server destination',async()=>validDestination(destination)],
 ['invalid coordinate and map rejected',async()=>!validDestination({...destination,x:NaN})&&!validDestination({...destination,zone:'alpha'})&&!validDestination({...destination,x:12001})],
 ['paid destination survives lost response',async()=>{const f=fixture();await f.service.charge('pilot',death,'position',destination);const r=await f.service.pending('pilot');return r.deathId===death&&r.destination.x===77&&r.destination.y===88&&f.debits===1;}],
 ['retry uses receipt without charging again',async()=>{const f=fixture();await f.service.charge('pilot',death,'position',destination);await f.service.charge('pilot',death,'position',destination);return f.debits===1&&!!await f.service.pending('pilot');}],
 ['acknowledged receipt cannot restore again',async()=>{const f=fixture();await f.service.charge('pilot',death,'position',destination);return await f.service.acknowledge('pilot',death)&&!(await f.service.pending('pilot'))&&!(await f.service.acknowledge('pilot',death));}],
 ['wrong death acknowledgement cannot consume receipt',async()=>{const f=fixture();await f.service.charge('pilot',death,'position',destination);return !(await f.service.acknowledge('pilot','other'))&&!!await f.service.pending('pilot');}]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
