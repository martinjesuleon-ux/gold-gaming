'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const minerals=require('../minerals-v17');

const {createMinerals}=minerals;
const id='00000000-0000-4000-8000-000000000001';
function fixture({future=false,full=false,shipment=true}={}){
 const now=Date.now(),lab={...(shipment?{shipment:{code:'prometium',quantity:10,readyAt:now+(future?60000:-1000),autoRefine:false}}:{})};
 let cargo=full?100:0,writes=0,scans=0,locks=0;
 const calls=[];
 const c={release(){},async query(sql,a){calls.push(sql);if(sql.startsWith('SELECT credits')){locks++;return {rows:[{credits:1000,uridium:0,honor:0}]};}if(sql.startsWith('SELECT data FROM'))return {rows:[{data:JSON.parse(JSON.stringify(lab))}]};if(sql.startsWith('SELECT code,quantity'))return {rows:[{code:'prometium',quantity:cargo}]};if(sql.startsWith('SELECT ship'))return {rows:[]};if(sql.startsWith('SELECT 1 FROM')||sql.startsWith('SELECT skills')||sql.startsWith('SELECT until_ms'))return {rows:[],rowCount:0};if(sql.startsWith('INSERT INTO gg_v13_ammo')){cargo+=a[2];writes++;}if(sql.startsWith('INSERT INTO gg_v17_skylab')){for(const k of Object.keys(lab))delete lab[k];Object.assign(lab,JSON.parse(a[1]));}return {rows:[]};}};
 const pool={connect:async()=>c,async query(sql,a){scans++;return {rows:lab.shipment&&lab.shipment.readyAt<=a[1]?[{account_id:id}]:[]};}};
 return {service:createMinerals(pool),lab,calls,get cargo(){return cargo},get writes(){return writes},get scans(){return scans},get locks(){return locks}};
}
const cases=[
 ['no online pilots avoids database scan',async()=>{const f=fixture();return (await f.service.deliverDue([])).length===0&&f.scans===0;}],
 ['future shipment remains in transit',async()=>{const f=fixture({future:true});return (await f.service.deliverDue([id])).length===0&&f.writes===0&&f.locks===0;}],
 ['due shipment credited once with receipt',async()=>{const f=fixture();const a=await f.service.deliverDue([id]),b=await f.service.deliverDue([id]);return a.length===1&&a[0].delivery.quantity===10&&b.length===0&&f.cargo===10&&f.writes===1&&f.locks===1&&!f.lab.shipment;}],
 ['missing shipment avoids balance and inventory writes',async()=>{const f=fixture({shipment:false});return (await f.service.deliverDue([id])).length===0&&f.writes===0;}],
 ['blocked delivery is retained without consuming cargo',async()=>{const f=fixture({full:true});return (await f.service.deliverDue([id])).length===0&&f.lab.shipment.blocked&&f.writes===0;}]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
