'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createMatch,accept,advance}=require('../uba-v126');
const {createArena,command,tickArena,viewArena}=require('../uba-arena-v128');
function setup(){const pilots=[{id:'a',name:'A',level:14,maxHp:100,maxShield:40,damage:200,speed:500},{id:'b',name:'B',level:14,maxHp:100,maxShield:40,damage:200,speed:500}];const m=createMatch(...pilots,0);accept(m,'a',1);accept(m,'b',1);advance(m,15001);const a=createArena(m,pilots,15001);return {m,a,pilots};}
test('arena rejects outsiders and invalid commands, snapshots do not mutate original pilots',()=>{const {m,a,pilots}=setup();assert.throws(()=>command(a,m,'x',{action:'attack',on:true}));assert.throws(()=>command(a,m,'a',{action:'move',x:Infinity,y:1}));command(a,m,'a',{action:'move',x:900,y:800});tickArena(a,m,15101);assert.equal(a.fighters[0].x,350);assert.equal(pilots[0].hp,undefined);assert.equal(viewArena(a).fighters[0].damage,undefined);});
test('arena range, cooldown, simultaneous hits and no normal economy mutation',()=>{const {m,a}=setup();command(a,m,'a',{action:'attack',on:true});command(a,m,'b',{action:'attack',on:true});assert.equal(tickArena(a,m,15101,()=>0).length,0);a.fighters[0].x=1000;a.fighters[1].x=1300;const shots=tickArena(a,m,15201,()=>0);assert.equal(shots.length,2);assert.ok(a.fighters.every(p=>p.hp===0));assert.equal(a.closed,true);assert.equal(m.round,2);assert.deepEqual(m.score,[0,0]);assert.equal(tickArena(a,m,15301).length,0);});
test('arena winning pilot advances round; timer expiry is a draw',()=>{const {m,a}=setup();a.fighters[0].x=1000;a.fighters[1].x=1300;command(a,m,'a',{action:'attack',on:true});tickArena(a,m,15101,()=>0);assert.deepEqual(m.score,[1,0]);assert.equal(m.phase,'offer');accept(m,'a',15102);accept(m,'b',15102);advance(m,30102);const b=createArena(m,[{id:'a',maxHp:100,maxShield:0,damage:100,speed:100},{id:'b',maxHp:100,maxShield:0,damage:100,speed:100}],30102);tickArena(b,m,m.until);assert.equal(m.round,3);assert.deepEqual(m.score,[1,0]);});

test('two-round live arena lifecycle keeps distinct matches and original pilot state intact',()=>{
 const {createLobby}=require('../uba-v126'),l=createLobby(),pilots=[{id:'a',name:'A',level:14,maxHp:100,maxShield:40,hp:73,shield:12,damage:200,speed:500,credits:500},{id:'b',name:'B',level:14,maxHp:100,maxShield:40,hp:81,shield:7,damage:1,speed:500,honor:100}];
 const initial=structuredClone(pilots);l.enqueue(pilots[0],0);const m=l.enqueue(pilots[1],0);
 for(let i=0;i<2;i++){const now=1000+i*20000;accept(m,'a',now);accept(m,'b',now);advance(m,now+15000);
 const arena=createArena(m,pilots,now+15000);arena.fighters[0].x=1000;arena.fighters[1].x=1300;command(arena,m,'a',{action:'attack',on:true});tickArena(arena,m,now+15100,()=>0);assert.ok(arena.closed);}
 assert.equal(m.phase,'finished');assert.equal(m.winner,'a');assert.deepEqual(m.score,[2,0]);assert.deepEqual(pilots,initial);assert.deepEqual(l.all(),[m]);l.remove('a');assert.deepEqual(l.all(),[]);
});
test('paid arena shots use equipped lasers, selected ammo, cooldown and private stock',async()=>{
 const {tickArenaPaid}=require('../uba-arena-v128'),{m,a}=setup();a.fighters[0].lasers=3;a.fighters[1].lasers=2;a.fighters[0].damage=10;a.fighters[0].x=1000;a.fighters[1].x=1300;
 command(a,m,'a',{action:'ammo',code:'MCB-50'});command(a,m,'a',{action:'attack',on:true});command(a,m,'b',{action:'attack',on:true});
 const shots=await tickArenaPaid(a,m,async plans=>{assert.equal(plans.length,2);assert.equal(plans[0].count,3);assert.equal(plans[0].code,'MCB-50');return {a:97,b:null};},15101,()=>.99);
 assert.equal(shots.length,1);assert.equal(a.fighters[1].hp,94);assert.equal(a.fighters[1].shield,16);assert.equal(a.fighters[1].attack,false);assert.equal(viewArena(a,'a').fighters[0].stock,97);assert.equal(viewArena(a,'b').fighters[0].stock,undefined);
 assert.equal((await tickArenaPaid(a,m,()=>{throw Error('unexpected shot')},15201)).length,0);
 command(a,m,'a',{action:'ammo',code:'SAB-50'});await tickArenaPaid(a,m,async()=>({a:94}),16101,()=>.99);assert.equal(a.fighters[1].hp,94);assert.equal(a.fighters[1].shield,0);
});
