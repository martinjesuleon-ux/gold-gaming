'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
const start=src.indexOf(" socket.on('v14:jump',");
const end=src.indexOf('\n socket.on(',start+1);
assert.ok(start>=0&&end>start);
const script=new vm.Script(src.slice(start,end));
const install=env=>script.runInNewContext(env);

function setup(){
 let releasePrior,resolveSave,rejectSave,enter;
 const prior=new Promise(r=>releasePrior=r),save=new Promise((r,j)=>{resolveSave=r;rejectSave=j;}),entered=new Promise(r=>enter=r);
 const p={id:'pilot',accountId:'account',company:'EIC',zone:'A',level:10,x:0,y:0,writes:prior,attack:true,dest:{}};
 const calls=[],acks=[],pending=new Set(),players=new Map([[p.id,p]]);
 const env={closing:false,players,pending,socket:{id:p.id,on:(n,fn)=>env.fire=fn},allowed:()=>true,portals:zone=>zone==='A'?[{id:'p',from:'A',to:'B',x:0,y:0}]:[{id:'back',from:'B',to:'A',x:5,y:5}],WORLD:{w:100,h:100},distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),requiredLevel:()=>1,accounts:{saveLocation:(...args)=>{calls.push(args);enter();return save;}},changeMap:(p,z)=>p.zone=z,missionEvent:()=>{},Date:{now:()=>1000}};
 install(env);
 return {p,calls,acks,pending,env,entered,releasePrior,resolveSave,rejectSave,fire:()=>env.fire('p',r=>acks.push(r))};
}
const cases=[
 ['waits for previous writes and acknowledges persisted destination',async s=>{s.fire();if(s.calls.length||s.pending.size!==1||!s.p.gatePending)return false;s.releasePrior();await s.entered;s.resolveSave();await s.p.writes;return s.calls.length===1&&s.calls[0].join(',')==='account,EIC,B'&&s.p.zone==='B'&&s.acks[0]?.ok===true&&s.pending.size===0&&!s.p.gatePending;}],
 ['failed persistence does not change map',async s=>{s.fire();s.releasePrior();await s.entered;s.rejectSave(Error('db'));await s.p.writes;return s.p.zone==='A'&&s.acks[0]?.ok===false&&s.pending.size===0&&!s.p.gatePending;}],
 ['disconnect during persistence retains pending write and prevents stale map update',async s=>{s.fire();s.releasePrior();await s.entered;s.env.players.delete(s.p.id);if(s.pending.size!==1)return false;s.resolveSave();await s.p.writes;return s.p.zone==='A'&&s.acks.length===0&&s.pending.size===0;}],
 ['shutdown waits for in-flight save and prevents stale map update',async s=>{s.fire();s.releasePrior();await s.entered;s.env.closing=true;if(s.pending.size!==1)return false;s.resolveSave();await s.p.writes;return s.p.zone==='A'&&s.acks.length===0&&s.pending.size===0;}],
 ['duplicate jump rejected during save',async s=>{s.fire();s.fire();s.releasePrior();await s.entered;s.resolveSave();await s.p.writes;return s.calls.length===1&&s.acks[0]?.ok===false&&s.acks[1]?.ok===true;}],
 ['new jump refused during shutdown',async s=>{s.env.closing=true;s.fire();return s.calls.length===0&&s.pending.size===0&&s.acks[0]?.ok===false;}]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn(setup())));
