'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{createGame}=require('../server');
test('Administrative events summary requires authentication and reflects feature gates and event lifecycle',{timeout:15000},async()=>{
 const flags=['GG_HITAC_ENABLED','GG_ICE_ENABLED','GG_SPACEBALL_ENABLED','GG_INVASION_LOBBY_ENABLED'],old=Object.fromEntries(flags.map(k=>[k,process.env[k]]));for(const k of flags)delete process.env[k];
 const accounts={hitacLotteryStatus:async()=>({bag:{id:'fixture',stock:{lf4:3}},limited:[{id:'lf4',code:'LF-4',stock:5}]}),endpoints(){},close:async()=>{},auctionSettle:async()=>{},collectClanTaxes:async()=>[],clanTags:async()=>[]};
 const game=createGame({accounts,password:'local-fixture-only',npcCount:0,boxCount:0});
 try{await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+game.server.address().port+'/api/admin/';
 const api=(path,body,auth=true)=>fetch(url+path,{method:body?'POST':'GET',headers:{...(auth?{Authorization:'Bearer local-fixture-only'}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await api('events',null,false)).status,401);let r=await api('events');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');let d=await r.json();for(const k of ['hitac','ice','spaceball','invasion'])assert.equal(d[k].enabled,false);assert.ok(d.maps.includes('4-5'));assert.equal(d.lottery.state.bag.stock.lf4,3);
 assert.equal((await api('ice',{action:'start',map:'4-5'})).status,403);
 process.env.GG_ICE_ENABLED='1';process.env.GG_HITAC_ENABLED='1';process.env.GG_SPACEBALL_ENABLED='1';process.env.GG_INVASION_LOBBY_ENABLED='1';
 for(const [path,body] of [['ice',{action:'start',map:'4-5'}],['hitac',{action:'start'}],['spaceball',{action:'start'}],['invasion',{difficulty:'easy'}]])assert.equal((await api(path,body)).status,200);
 d=await (await api('events')).json();assert.equal(d.ice.active.phase,'countdown');assert.equal(d.ice.active.map,'4-5');assert.equal(d.hitac.active.units,7);assert.equal(d.spaceball.active.map,'4-4');assert.equal(d.invasion.lobbies[0].difficulty,'easy');assert.equal(d.invasion.lobbies[0].participants,0);
 for(const path of ['ice','hitac','spaceball'])assert.equal((await api(path,{action:'stop'})).status,200);
 assert.equal((await api('invasion',{action:'stop',difficulty:'easy'})).status,200);assert.equal((await api('invasion',{action:'stop',difficulty:'easy'})).status,409);d=await (await api('events')).json();assert.equal(d.invasion.lobbies.length,0);for(const k of ['ice','hitac','spaceball'])assert.equal(d[k].active,null);
 }finally{await game.close();for(const k of flags){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
