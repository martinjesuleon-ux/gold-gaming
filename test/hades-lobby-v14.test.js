'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHadesLobbies}=require('../hades-lobby-v14');
const pilot=(n,wave=0)=>({id:'p'+n,name:'Pilot '+n,wave});
test('Hades requires four ready pilots on the same section and caps the room at eight',()=>{
 const lobby=createHadesLobbies();
 const room=lobby.create(pilot(1));
 assert.equal(room.canStart,false);
 assert.throws(()=>lobby.join(room.code,pilot(2,1)),/misma sección/);
 for(let n=2;n<=8;n++)lobby.join(room.code,pilot(n));
 assert.throws(()=>lobby.join(room.code,pilot(9)),/completo/);
 for(let n=1;n<=8;n++)lobby.ready('p'+n,true);
 assert.equal(lobby.status('p1').canStart,true);
 lobby.ready('p3',false);
 assert.equal(lobby.status('p1').canStart,false);
});
test('Hades cleans up membership and transfers leadership',()=>{
 const lobby=createHadesLobbies(),room=lobby.create(pilot(1));
 lobby.join(room.code,pilot(2));
 assert.throws(()=>lobby.create(pilot(2)),/perteneces/);
 assert.equal(lobby.leave('p1').leader,'p2');
 assert.equal(lobby.status('p1'),null);
 assert.equal(lobby.leave('p2'),null);
 assert.throws(()=>lobby.join(room.code,pilot(3)),/no encontrado/);
});
