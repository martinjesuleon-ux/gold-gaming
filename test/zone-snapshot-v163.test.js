'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildZoneSnapshots,snapshotFor}=require('../zone-snapshot-v163');
test('zone projections are shared without exposing hidden or cross-zone players',()=>{
 const players=[{id:'a',zone:'1',hidden:false},{id:'b',zone:'1',hidden:true},{id:'c',zone:'1',hidden:false},{id:'d',zone:'1',hidden:true},{id:'e',zone:'2',hidden:false}];
 const npcs=[{id:'n1',zone:'1',hp:5,damage:10,dest:{x:1},target:'a'},{id:'n2',zone:'2',hp:6},{id:'n3',zone:'empty'}],mines=[{id:'m',zone:'1',x:1,y:2,code:'ACM',armedAt:5,owner:'a'}],boxes=[{id:'box',zone:'2',x:1,y:1,kind:'cargo'}];
 let projections=0,commonCalls=0;
 const zones=buildZoneSnapshots({players,npcs,mines,boxes,zoneOf:x=>x.zone,publicPlayer:p=>{projections++;return {id:p.id};},isHidden:p=>p.hidden,common:zone=>{commonCalls++;return {map:zone};}});
 assert.equal(projections,5);assert.equal(commonCalls,2);assert.equal(zones.size,2);
 const ids=p=>snapshotFor(zones.get(p.zone),p).players.map(x=>x.id);
 assert.deepEqual(ids(players[0]),['a','c']);assert.deepEqual(ids(players[1]),['a','b','c']);assert.deepEqual(ids(players[2]),['a','c']);assert.deepEqual(ids(players[3]),['a','c','d']);assert.deepEqual(ids(players[4]),['e']);
 const a=snapshotFor(zones.get('1'),players[0]),b=snapshotFor(zones.get('1'),players[1]);
 assert.equal(a.npcs,b.npcs);assert.equal(a.mines,b.mines);assert.deepEqual(a.npcs,[{id:'n1',hp:5}]);assert.deepEqual(a.mines,[{id:'m',x:1,y:2,code:'ACM',armedAt:5}]);assert.deepEqual(a.boxes,[]);assert.equal(snapshotFor(zones.get('2'),players[4]).boxes[0].id,'box');
});
test('all-cloaked zone exposes only own pilot and empty zone emits nothing',()=>{
 const players=[{id:'a',zone:'x'},{id:'b',zone:'x'}];const args={players,npcs:[],mines:[],boxes:[],zoneOf:p=>p.zone,publicPlayer:p=>({id:p.id}),isHidden:()=>true,common:()=>({time:42})};
 const z=buildZoneSnapshots(args);assert.deepEqual(snapshotFor(z.get('x'),players[0]).players,[{id:'a'}]);assert.equal(buildZoneSnapshots({...args,players:[]}).size,0);
});
