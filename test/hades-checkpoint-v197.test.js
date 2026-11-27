'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHadesLobbies}=require('../hades-lobby-v14');
test('Hades groups require matching wave and checkpoint without exposing kill keys',()=>{
 const lobby=createHadesLobbies(),pilot=(id,wave=1,checkpoint='0:1|0:2')=>({id,name:id,wave,checkpoint});
 const room=lobby.create(pilot('a'));
 assert.equal(room.players[0].checkpoint,undefined);
 assert.throws(()=>lobby.join(room.code,pilot('b',0)),/misma sección/);
 assert.throws(()=>lobby.join(room.code,pilot('b',1,'0:3')),/mismo progreso/);
 assert.equal(lobby.status('b'),null);
 for(const id of ['b','c','d'])lobby.join(room.code,pilot(id));
 for(const id of ['a','b','c','d'])lobby.ready(id,true);
 assert.equal(lobby.status('a').canStart,true);
 assert.equal(lobby.lock('a').starting,true);
 assert.throws(()=>lobby.join(room.code,pilot('e')),/iniciando/);
 assert.equal(lobby.unlock('a').starting,false);
 assert.equal(lobby.leave('a').leader,'b');
});