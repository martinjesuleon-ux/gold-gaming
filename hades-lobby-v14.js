'use strict';
// Hades group assembly and start locking.
const crypto=require('node:crypto');
function createHadesLobbies(){
 const rooms=new Map(),members=new Map();
 function find(id){return rooms.get(members.get(id))||null;}
 function view(room){return room?{code:room.code,leader:room.leader,wave:room.wave,players:[...room.players.values()].map(({checkpoint,...p})=>p),starting:!!room.starting,canStart:!room.starting&&room.players.size>=4&&room.players.size<=8&&[...room.players.values()].every(p=>p.ready)}:null;}
 function create(p){
  if(find(p.id))throw Error('Ya perteneces a un grupo');
  let code;do{code=crypto.randomBytes(5).toString('hex').toUpperCase();}while(rooms.has(code));
  const room={code,leader:p.id,wave:p.wave,checkpoint:p.checkpoint,players:new Map([[p.id,{...p,ready:false}]])};rooms.set(code,room);members.set(p.id,code);return view(room);
 }
 function join(code,p){
  if(find(p.id))throw Error('Ya perteneces a un grupo');
  const room=rooms.get(String(code||'').trim().toUpperCase());
  if(!room)throw Error('Grupo no encontrado');
  if(room.starting)throw Error('El grupo está iniciando');
  if(room.players.size>=8)throw Error('Grupo completo');
  if(room.wave!==p.wave)throw Error('Todos deben estar en la misma sección de Hades');
  if(room.checkpoint!==p.checkpoint)throw Error('El grupo necesita el mismo progreso de enemigos eliminados en Hades');
  room.players.set(p.id,{...p,ready:false});members.set(p.id,room.code);return view(room);
 }
 function ready(id,value){const room=find(id);if(!room||room.starting||typeof value!=='boolean')throw Error('Grupo o estado inválido');room.players.get(id).ready=value;return view(room);}
 function leave(id){const room=find(id);if(!room)return null;members.delete(id);room.players.delete(id);if(!room.players.size){rooms.delete(room.code);return null;}if(room.leader===id)room.leader=room.players.keys().next().value;return view(room);}
 function lock(id){const room=find(id);if(!room||room.leader!==id||!view(room).canStart)throw Error('Solo el líder puede iniciar con 4–8 pilotos listos');room.starting=true;return view(room);}
 function unlock(id){const room=find(id);if(room)room.starting=false;return view(room);}
 function consume(id){const room=find(id);if(!room||!room.starting)throw Error('Grupo no disponible');for(const key of room.players.keys())members.delete(key);rooms.delete(room.code);}
 return {create,join,ready,leave,lock,unlock,consume,status:id=>view(find(id))};
}
module.exports={createHadesLobbies};
