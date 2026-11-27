'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','public','gold-v13.js'),'utf8');const a=src.indexOf('function bankRewardText('),b=src.indexOf('const bankJournal=',a);assert.ok(a>=0&&b>a);const api=new vm.Script(src.slice(a,b)+'\n({bankRewardText,createBankJournal});').runInNewContext({fmt:n=>String(n)});

const {createBankJournal,bankRewardText}=api;
const account='pilot-a',request={code:'GOLD-22',requestId:'00000000-0000-4000-8000-000000000001',expectedAccountId:account};
function storage(){const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
const cases=[
 ['retains pending request after recreation',()=>{const s=storage();createBankJournal(s).save(account,request);return createBankJournal(s).load(account).requestId===request.requestId;}],
 ['separates accounts',()=>{const j=createBankJournal(storage());j.save(account,request);return j.load('pilot-b')===null;}],
 ['rejects mismatched account',()=>{const j=createBankJournal(storage());j.save('pilot-b',request);return j.load('pilot-b')===null;}],
 ['clears confirmed request',()=>{const j=createBankJournal(storage());j.save(account,request);j.save(account,null);return j.load(account)===null;}],
 ['rejects malformed UUID',()=>{const j=createBankJournal(storage());j.save(account,{...request,requestId:'bad'});return j.load(account)===null;}],
 ['ignores malformed storage',()=>createBankJournal({getItem:()=>'{'}).load(account)===null],
 ['lists currencies, stacks, items and premium',()=>bankRewardText({uridium:100,stacks:{'UCB-100':50},items:[{quantity:2,code:'LF-4'}],premiumDays:3}).join('|')==='100 Uridium|3 días de Premium (tiempo disponible)|50 UCB-100|2 × LF-4']
];
for(const [name,fn] of cases)test(name,()=>assert.ok(fn()));
