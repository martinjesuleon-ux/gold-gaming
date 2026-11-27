'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const respawn=require('../respawn-v222'),pet=require('../pet-vitals-v173');

const {repairQuote,nearestRepairPortal,createRespawn}=respawn;
const {repairVitals}=pet;
const stats={maxHp:50000,shield:10000,absorption:.7},dead={hp:0,shield:0};
const death='00000000-0000-4000-8000-000000000001';
function fixture({premium=false,stock=0,uridium=1000}={}){
 let receipt=null,debits=0,uses=0;const calls=[];
 const c={release(){},async query(sql,args){calls.push(sql);if(sql.startsWith('SELECT uridium'))return {rows:[{uridium}]};if(sql.startsWith('SELECT response'))return {rows:receipt?[{response:receipt}]:[]};if(sql.startsWith('SELECT until_ms'))return {rows:premium?[{until_ms:Date.now()+60000}]:[]};if(sql.startsWith('SELECT quantity'))return {rows:[{quantity:stock}]};if(sql.startsWith('UPDATE gg_v13_ammo')){uses++;return {rowCount:stock>0?1:0};}if(sql.startsWith('UPDATE player_progress')){if(uridium<args[1])return {rowCount:0};debits++;return {rowCount:1};}if(sql.startsWith('INSERT INTO gg_respawn'))receipt=JSON.parse(args[2]);return {rows:[]};}};
 return {service:createRespawn({connect:async()=>c}),calls,get debits(){return debits},get uses(){return uses}};
}
const reject=async fn=>{try{await fn();return false;}catch{return true;}};
const cases=[
 ['base free for all',async()=>repairQuote('base',false,2).uridium===0&&repairQuote('base',false,2).vouchers===0],
 ['normal portal 500',async()=>repairQuote('portal').uridium===500],
 ['normal position 1000',async()=>repairQuote('position').uridium===1000],
 ['premium all free without consuming vouchers',async()=>['base','portal','position'].every(k=>repairQuote(k,true,10).uridium===0&&repairQuote(k,true,10).vouchers===0)],
 ['voucher replaces uridium',async()=>repairQuote('position',false,'3').vouchers===1&&repairQuote('position',false,'3').uridium===0],
 ['unknown mode rejected',async()=>reject(()=>repairQuote('invalid'))],
 ['nearest regular portal',async()=>nearestRepairPortal([{x:0,y:0},{x:5,y:0,gate:true},{x:20,y:0}],6,0).x===0],
 ['no portal returns null',async()=>nearestRepairPortal([],5,5)===null],
 ['premium PET with zero balance restores hull',async()=>repairVitals(stats,dead,0,0).vitals.hp===50000],
 ['PET free repair still requires destruction',async()=>reject(()=>repairVitals(stats,{hp:1,shield:0},0,0))],
 ['respawn receipt prevents repeat payment',async()=>{const f=fixture();await f.service.charge('pilot',death,'portal');await f.service.charge('pilot',death,'portal');return f.debits===1;}],
 ['cannot switch mode after confirmation',async()=>{const f=fixture();await f.service.charge('pilot',death,'portal');return await reject(()=>f.service.charge('pilot',death,'position'))&&f.debits===1;}],
 ['voucher payment does not debit balance',async()=>{const f=fixture({stock:1,uridium:0});await f.service.charge('pilot',death,'position');return f.uses===1&&f.debits===0;}],
 ['premium leaves currency and vouchers intact',async()=>{const f=fixture({premium:true,stock:1,uridium:0});await f.service.charge('pilot',death,'position');return f.uses===0&&f.debits===0;}],
 ['insufficient balance rolls back',async()=>{const f=fixture({uridium:0});return await reject(()=>f.service.charge('pilot',death,'position'))&&f.calls.includes('ROLLBACK');}]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
