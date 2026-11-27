'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{validate,runDue}=require('../event-calendar-v158');
test('calendar validates independent kinds and accepts simultaneous schedules',()=>{
 const now=Date.parse('2030-01-01T00:00:00Z'),startAt='2030-01-01T01:00:00Z';
 for(const kind of ['hitac','ice','spaceball','invasion','hitac-lottery']){
  const x=validate({kind,startAt,map:'4-5',difficulty:'hard'},now);
  assert.equal(x.kind,kind);assert.equal(x.startAt,'2030-01-01T01:00:00.000Z');assert.equal(x.payload.action,kind==='hitac-lottery'?'open':'start');
 }
 for(const body of [{kind:'fake',startAt},{kind:'ice',startAt,map:'x'},{kind:'invasion',startAt,difficulty:'x'},{kind:'hitac',startAt:'2029-01-01T01:00:00Z'}])assert.throws(()=>validate(body,now),{status:400});
});
test('due dispatch records each result independently without repeating claims',async()=>{
 let queue=[{id:'a',kind:'hitac',payload:{action:'start'}},{id:'b',kind:'ice',payload:{action:'start',map:'4-5'}},{id:'c',kind:'spaceball',payload:{action:'start'}}],results=[];
 const cal={claim:async()=>queue.splice(0),finish:async(...args)=>results.push(args)};
 const dispatch=async kind=>{if(kind==='ice')throw Error('test');return {ok:true,detail:'started'};};
 await runDue(cal,dispatch);await runDue(cal,dispatch);
 assert.deepEqual(results,[['a',true,'started'],['b',false,'No se pudo iniciar el evento'],['c',true,'started']]);
});
test('calendar admin endpoints reject unauthorized calls; public status excludes schedule and private data',{timeout:15000},async()=>{
 const {createGame}=require('../server');const entries=[];
 const eventCalendar={list:async()=>entries,add:async b=>{const x=validate(b);entries.push(x);return x;},cancel:async()=>({ok:true}),claim:async()=>[],finish:async()=>{}};
 const accounts={eventCalendar,uridiumEventStatus:async()=>({active:true,endAt:null,secret:'private'}),gateSpecialEventStatus:async()=>({active:false}),endpoints(){},close:async()=>{},auctionSettle:async()=>{},collectClanTaxes:async()=>[],clanTags:async()=>[]};
 const game=createGame({accounts,password:'fixture-only',npcCount:0,boxCount:0});
 try{await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+game.server.address().port;
 const api=(body,auth=true)=>fetch(url+'/api/admin/calendar',{method:body?'POST':'GET',headers:{...(auth?{Authorization:'Bearer fixture-only'}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await api(null,false)).status,401);assert.equal((await api({action:'schedule'},false)).status,401);
 assert.equal((await api({action:'invalid'})).status,400);
 const startAt=new Date(Date.now()+3600000).toISOString();assert.equal((await api({action:'schedule',kind:'hitac',startAt})).status,200);assert.equal((await api({action:'schedule',kind:'spaceball',startAt})).status,200);
 assert.equal((await (await api()).json()).entries.length,2);
 const r=await fetch(url+'/api/events/live');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const data=await r.json();assert.deepEqual(data.events.uridium,{active:true,endAt:null});assert.equal(data.events.gateSpecial,null);assert.equal(data.entries,undefined);
 }finally{await game.close();}
});
