'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('group invitations exclude dead pilots and special combat sessions',()=>{
 const s=read('server.js'),a=s.indexOf('function groupEligible('),b=s.indexOf('function groupView(',a);
 const eligible=vm.runInNewContext(s.slice(a,b)+';groupEligible');
 assert.equal(eligible({hp:100}),true);
 for(const p of [null,{hp:0},{hp:1,gate:{}},{hp:1,gatePending:true},{hp:1,gateWaiting:true},{hp:1,deadUntil:2},{hp:1,ubaReturn:{}},{hp:1,invasionReturn:{}}])assert.equal(eligible(p),false);
});
test('group push updates open panel and defers redraw during an action',()=>{
 const s=read('public/gold-v13.js'),a=s.indexOf('groupPush=next=>'),b=s.indexOf('function draw()',a);
 const h=vm.runInNewContext('let groupPush,data,busy=false,draws=0;const draw=()=>draws++;'+s.slice(a,b)+';({push:groupPush,setBusy:v=>busy=v,get:()=>({data,draws})})');
 h.push({pilots:[]});assert.equal(h.get().draws,1);
 h.setBusy(true);h.push({pilots:[1]});assert.equal(h.get().draws,1);assert.equal(h.get().data.pilots[0],1);
 h.push(null);assert.equal(h.get().data.pilots[0],1);
});
