'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('movement uses transient drag packets and reliable final destinations',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 const a=src.indexOf('function sendMove('),b=src.indexOf('function intersectsViewport(',a);
 assert.ok(a>=0&&b>a);
 const pilot={data:{deadUntil:0}},events=[],c={meId:'self',entities:new Map([['pself',pilot]]),performance:{now:()=>250},joined:true,socket:{connected:true,emit:(event,data)=>events.push({event,data,transient:false}),volatile:{emit:(event,data)=>events.push({event,data,transient:true})}},world:{w:12000,h:8000},clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),dest:null};
 const move=vm.runInNewContext(src.slice(a,b)+';sendMove',c);
 move(120,400,true);move(130,500);move(NaN,10);move(0,9000);
 assert.equal(events.length,3);assert.equal(events[0].transient,true);assert.equal(events[1].transient,false);
 assert.equal(pilot.visualIntent.x,25);assert.equal(pilot.visualIntent.y,7975);assert.equal(pilot.visualIntent.at,250);
 assert.equal(events[1].data.x,130);assert.equal(events[2].data.x,25);assert.equal(events[2].data.y,7975);
 c.socket.connected=false;move(100,200);assert.equal(events.length,3);assert.equal(pilot.visualIntent.x,25);
 c.socket.connected=true;pilot.data.deadUntil=999;move(400,500);assert.equal(pilot.visualIntent.x,25);
 assert.match(src,/pointerup',e=>\{if\(dragging&&e.button===0&&joined&&socket.connected\)sendMove/);
 assert.match(src,/v14:map',s=>\{dragging=false/);
});
