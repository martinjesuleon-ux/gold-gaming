'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createEvent,enter}=require('../invasion-v134');
const {createCombat,command,tick,leave,view}=require('../invasion-combat-v136');
test('cooperative invasion validates membership and consumes ammo before applying damage',async()=>{
 const e=createEvent('easy',0);enter(e,'a',5,0);enter(e,'b',5,0);
 const ps=['a','b'].map(id=>({id,name:id,maxHp:100000,maxShield:100000,speed:400,damage:100,lasers:2,absorption:.8})),c=createCombat(e,ps,60000);
 const n=[...e.aliens.values()][0];n.x=6100;n.y=6000;
 assert.throws(()=>command(c,'outsider',{action:'move',x:1,y:1}));
 assert.throws(()=>command(c,'a',{action:'move',x:-1,y:0}));
 for(const p of ps){command(c,p.id,{action:'target',id:n.id});command(c,p.id,{action:'attack',on:true});}
 const before=n.hp+n.shield;
 await tick(c,async plans=>{assert.equal(plans.length,2);assert.equal(plans[0].count,2);return {a:98,b:null};},60100,()=>.99);
 assert.equal(n.hp+n.shield,before-100);assert.equal(c.fighters.get('b').attack,false);
 assert.equal(view(c,'a').players[0].stock,98);assert.equal(view(c,'b').players[0].stock,undefined);
 assert.equal(ps[0].hp,undefined);assert.equal(ps[0].maxHp,100000);
 leave(c,'a');leave(c,'b');assert.equal(c.closed,true);assert.equal(e.phase,'cancelled');
});
test('invasion rejects unknown targets and out-of-range fire',async()=>{
 const e=createEvent('easy',0);enter(e,'a',5,0);const c=createCombat(e,[{id:'a',name:'A',maxHp:1000,maxShield:1000,speed:400,damage:100,lasers:1}],60000);
 assert.throws(()=>command(c,'a',{action:'target',id:'fake'}));const n=[...e.aliens.values()][0];command(c,'a',{action:'target',id:n.id});command(c,'a',{action:'attack',on:true});
 await tick(c,async()=>{throw Error('should not charge out-of-range shot');},60100,()=>.99);
 assert.equal(c.closed,false);
});
