'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','inventory-v13.js'),'utf8');
const start=src.indexOf(' async function transaction('),end=src.indexOf(' async function snapshot(',start);
assert.ok(start>=0&&end>start);
const script=new vm.Script(src.slice(start,end)+'\npurchase;');
const install=env=>script.runInNewContext(env);

const ID='pilot',KEY='00000000-0000-4000-8000-000000000001';
const input=(extra={})=>({category:'lasers',code:'LF-1',quantity:2,requestId:KEY,...extra});
function setup({credits=100000n,receipt=null,failDebit=false,failInsert=false,failQuote=false,premium=false}={}){
 const calls=[],receipts=new Map(),items=[];if(receipt)receipts.set(KEY,receipt);
 let working,quoteCalls=0;
 const c={release:()=>calls.push('release'),async query(sql,args=[]){
  calls.push(sql);
  if(sql==='BEGIN'){working={credits,items:[...items],receipts:new Map(receipts)};return {};}
  if(sql==='COMMIT'){credits=working.credits;items.splice(0,items.length,...working.items);receipts.clear();for(const [k,v] of working.receipts)receipts.set(k,v);return {};}
  if(sql==='ROLLBACK')return {};
  if(sql.includes('FOR UPDATE'))return {rows:[{credits:String(working.credits),uridium:'0'}]};
  if(sql.startsWith('SELECT response'))return {rows:working.receipts.has(args[1])?[{response:working.receipts.get(args[1])}]:[]};
  if(sql.startsWith('UPDATE player_progress')){if(!sql.includes('credits>=$2'))throw Error('missing debit guard');if(failDebit)return {rows:[]};working.credits-=BigInt(args[1]);return {rows:[{credits:String(working.credits),uridium:'0'}]};}
  if(sql.startsWith('INSERT INTO gg_v13_inventory')){if(failInsert)throw Error('insert failed');working.items.push(args[2]);return {};}
  if(sql.startsWith('INSERT INTO gg_v13_purchases')){working.receipts.set(args[1],JSON.parse(args[2]));return {};}
  throw Error('Unexpected SQL: '+sql);
 }};
 const purchase=install({premiumRead:async()=>premium,premiumPrice:require('../boosters-v112').premiumPrice,pool:{connect:async()=>c},crypto:{randomUUID:()=>String(Math.random())},fail:(message,status=400)=>Object.assign(Error(message),{status}),quote:(category,code,quantity)=>{quoteCalls++;if(failQuote)throw Error('catalog changed');return {id:code,category,quantity,currency:'credits',total:10000*quantity};}});
 return {purchase,calls,items,receipts,get credits(){return credits},get quoteCalls(){return quoteCalls}};
}
async function rejected(fn,msg){try{await fn();return false;}catch(e){return e.message===msg;}}
const cases=[
 ['premium purchase charges 5% less and replays exact receipt',async()=>{const s=setup({premium:true});const a=await s.purchase(ID,input()),b=await s.purchase(ID,input());return a.total===19000&&b.total===19000&&a.baseTotal===20000&&s.credits===81000n&&s.items.length===2;}],
 ['valid purchase charges once and grants two articles',async()=>{const s=setup();const r=await s.purchase(ID,input());return r.ok&&s.credits===80000n&&s.items.length===2&&s.receipts.size===1;}],
 ['retry returns receipt without duplicate charge or item',async()=>{const s=setup();const a=await s.purchase(ID,input()),b=await s.purchase(ID,input());return a.balance.credits===b.balance.credits&&s.items.length===2&&s.credits===80000n&&s.quoteCalls===1;}],
 ['receipt survives changed catalog',async()=>{const receipt={ok:true,request:{category:'lasers',code:'LF-1',quantity:2,targetLevel:null}};const s=setup({receipt,failQuote:true});return (await s.purchase(ID,input())).ok&&s.quoteCalls===0&&s.items.length===0;}],
 ['reused receipt with different quantity rejected',async()=>{const s=setup();await s.purchase(ID,input());return await rejected(()=>s.purchase(ID,input({quantity:3})),'Identificador ya utilizado para otra compra')&&s.credits===80000n&&s.items.length===2;}],
 ['wrong account rejected',async()=>{const s=setup();return await rejected(()=>s.purchase(ID,input({expectedAccountId:'other'})),'La compra pertenece a otra cuenta')&&s.calls.length===0;}],
 ['missing quantity rejected',async()=>{const s=setup();return await rejected(()=>s.purchase(ID,input({quantity:undefined})),'Artículo o cantidad inválida')&&s.calls.length===0;}],
 ['negative quantity rejected',async()=>{const s=setup();return await rejected(()=>s.purchase(ID,input({quantity:-2})),'Artículo o cantidad inválida')&&s.calls.length===0;}],
 ['fractional quantity rejected',async()=>{const s=setup();return await rejected(()=>s.purchase(ID,input({quantity:1.5})),'Artículo o cantidad inválida')&&s.calls.length===0;}],
 ['null request rejected',async()=>{const s=setup();return await rejected(()=>s.purchase(ID,null),'Solicitud de compra inválida')&&s.calls.length===0;}],
 ['insufficient funds rejected',async()=>{const s=setup({credits:19999n});return await rejected(()=>s.purchase(ID,input()),'Saldo insuficiente')&&s.items.length===0&&s.credits===19999n;}],
 ['failed conditional debit grants no items',async()=>{const s=setup({failDebit:true});return await rejected(()=>s.purchase(ID,input()),'Saldo insuficiente')&&s.items.length===0&&s.credits===100000n;}],
 ['failed grant rolls transaction back',async()=>{const s=setup({failInsert:true});return await rejected(()=>s.purchase(ID,input()),'insert failed')&&s.calls.includes('ROLLBACK')&&s.credits===100000n&&s.receipts.size===0;}]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
