'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const src=fs.readFileSync(require.resolve('../public/gold-v13.js'),'utf8');
const create=vm.runInNewContext(src.slice(src.indexOf('function createBoosterJournal('),src.indexOf('const boosterJournal='))+'\ncreateBoosterJournal');
const account='a',req={expectedAccountId:account,code:'DMG-B01',action:'buy',requestId:randomUUID()};
function fixture(){const map=new Map();return {map,storage:{getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};}
test('booster request survives recreated view and preserves exact request ID',()=>{const {storage}=fixture();create(storage).save(account,req);assert.deepEqual(JSON.parse(JSON.stringify(create(storage).load(account))),req);});
test('booster request isolated by account',()=>{const {storage}=fixture(),j=create(storage);j.save(account,req);assert.equal(j.load('b'),null);assert.throws(()=>j.save('b',req));});
test('invalid operation or corrupt local record never executes',()=>{const {storage,map}=fixture(),j=create(storage);assert.throws(()=>j.save(account,{...req,action:'invalid'}));map.set('gg.booster.pending.v232:a','{');assert.equal(j.load(account),null);});
test('successful confirmation clears pending request',()=>{const {storage}=fixture(),j=create(storage);j.save(account,req);j.save(account,null);assert.equal(j.load(account),null);});
test('storage write failure is surfaced before sending',()=>{const j=create({getItem:()=>null,setItem:()=>{throw Error('storage disabled');}});assert.throws(()=>j.save(account,req),/storage disabled/);});
const server=fs.readFileSync(require.resolve('../server'),'utf8');
const block=server.slice(server.indexOf("socket.on('v112:booster'"),server.indexOf("socket.on('v110:emp'"));
function socketFixture(){const p={id:'p',accountId:'a',writes:Promise.resolve()},pending=new Set(),calls=[];let handler;vm.runInNewContext(block,{socket:{id:'p',on:(k,h)=>handler=h},allowed:()=>true,players:new Map([['p',p]]),pending,accounts:{boosterAction:async(id,data)=>{calls.push(['action',id,data.requestId]);return {active:{OLD:1}};},boosterStatus:async()=>({active:{NEW:2}})},updateBoosters:()=>{}});return {p,calls,fire:data=>new Promise(resolve=>handler(data,resolve))};}
test('socket rejects account mismatch before executing transaction',async()=>{const f=socketFixture();assert.equal((await f.fire({...req,expectedAccountId:'b'})).status,409);assert.equal(f.calls.length,0);});
test('socket updates live effects from fresh status, not historical receipt',async()=>{const f=socketFixture();const r=await f.fire(req);assert.equal(r.ok,true);assert.equal(f.p.rawBoosters.NEW,2);assert.equal(f.p.rawBoosters.OLD,undefined);assert.equal(f.calls[0][2],req.requestId);});
