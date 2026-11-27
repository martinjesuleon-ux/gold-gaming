'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {activeAt,normalizeAction,multiply,createUridiumEvent}=require('../uridium-event-v157');
test('manual modes override schedule and only Uridium is doubled',()=>{
 const on=normalizeAction({action:'start'}),off=normalizeAction({action:'stop'});
 assert.equal(activeAt(on),true);assert.equal(activeAt(off),false);
 assert.equal(multiply(100,true),200);assert.equal(multiply(100,false),100);
 assert.equal(multiply(0,true),0);assert.throws(()=>multiply(-1,true));assert.throws(()=>multiply(Number.MAX_SAFE_INTEGER,true));
});
test('scheduled event has inclusive start, exclusive end and validated UTC timestamps',()=>{
 const startAt='2030-01-01T12:00:00.000Z',endAt='2030-01-01T13:00:00.000Z',start=Date.parse(startAt),end=Date.parse(endAt);
 const s=normalizeAction({action:'schedule',startAt,endAt},start-1000);
 assert.equal(activeAt(s,start-1),false);assert.equal(activeAt(s,start),true);assert.equal(activeAt(s,end-1),true);assert.equal(activeAt(s,end),false);
 for(const body of [{action:'unknown'},{action:'schedule',startAt,endAt:startAt},{action:'schedule',startAt:'2030-01-01T12:00',endAt}])assert.throws(()=>normalizeAction(body,start-1000),{status:400});
 assert.throws(()=>normalizeAction({action:'schedule',startAt,endAt},start+1),{status:400});
});
test('stored mode survives service recreation and factor is read through reward transaction',async()=>{
 let row;const pool={query:async(sql,args)=>{if(sql.startsWith('CREATE'))return {rows:[]};if(sql.startsWith('INSERT')){row??={mode:'off',start_at:null,end_at:null};return {rows:[]};}if(sql.startsWith('UPDATE')){row={mode:args[0],start_at:args[1],end_at:args[2]};}return {rows:[row]};}};
 const a=createUridiumEvent(pool);await a.ready();assert.equal((await a.status()).multiplier,1);await a.change({action:'start'});
 const b=createUridiumEvent(pool);await b.ready();assert.equal((await b.status()).multiplier,2);
 const tx={query:async sql=>{assert.match(sql,/statement_timestamp/);return {rows:[{active:row.mode==='on'}]};}};
 assert.equal(await b.factor(tx),2);await b.change({action:'stop'});assert.equal(await b.factor(tx),1);
});
test('Uridium administration rejects unauthenticated requests and validates changes',{timeout:15000},async()=>{
 const {createGame}=require('../server');let s=normalizeAction({action:'stop'});
 const accounts={uridiumEventStatus:async()=>({...s,active:activeAt(s)}),uridiumEventChange:async body=>{s=normalizeAction(body);return {...s,active:activeAt(s)};},endpoints(){},close:async()=>{},auctionSettle:async()=>{},collectClanTaxes:async()=>[],clanTags:async()=>[]};
 const game=createGame({accounts,password:'fixture-only',npcCount:0,boxCount:0});
 try{await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+game.server.address().port+'/api/admin/uridium-x2';
 const api=(body,auth=true)=>fetch(url,{method:body?'POST':'GET',headers:{...(auth?{Authorization:'Bearer fixture-only'}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await api(null,false)).status,401);assert.equal((await api({action:'start'},false)).status,401);
 assert.equal((await api({action:'bad'})).status,400);assert.equal((await (await api({action:'start'})).json()).active,true);
 assert.equal((await (await api()).json()).active,true);assert.equal((await (await api({action:'stop'})).json()).active,false);
 }finally{await game.close();}
});
