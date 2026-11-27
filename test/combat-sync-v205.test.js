'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('combat acknowledgments reconcile state and discard superseded commands',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 const a=src.indexOf('function resetCombatSync('),b=src.indexOf('let jumpPending=',a);
 assert.ok(a>=0&&b>a);
 const calls=[],c={socket:{connected:true,timeout:()=>({emit:(event,value,ack)=>calls.push({event,value,ack})})},performance:{now:()=>100},notice:()=>{}};
 const h=vm.runInNewContext('let joined=true,combatCommandSerial=0,pendingSelectUntil=0,pendingAttackUntil=0,selected=null,attacking=false;'+src.slice(a,b)+';({select,toggleAttack,resetCombatSync,get:()=>({selected,attacking,pendingSelectUntil,pendingAttackUntil})})',c);
 h.select('a');h.toggleAttack();assert.equal(h.get().attacking,true);
 calls[0].ack(null,{target:'a',attack:false});assert.equal(h.get().attacking,true);
 calls[1].ack(null,{target:'a',attack:true});assert.equal(h.get().attacking,true);assert.equal(h.get().pendingAttackUntil,0);
 h.select('b');calls[2].ack(null,{target:null,attack:false});assert.equal(h.get().selected,null);assert.equal(h.get().attacking,false);
 h.select('c');h.resetCombatSync();calls[3].ack(null,{target:'stale',attack:true});assert.equal(h.get().selected,'c');assert.equal(h.get().attacking,false);
 h.select('d');calls[4].ack(Error('timeout'));assert.equal(h.get().pendingSelectUntil,0);
});
