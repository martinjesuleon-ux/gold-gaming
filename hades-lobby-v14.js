'use strict';
// Hades lobby only. Combat stays disabled until shared wave/life persistence is integrated.
const crypto=require('node:crypto');
function createHadesLobbies(){
 const rooms=new Map(),members=new Map();
 function find(id){return rooms.get(members.get(id))||null;}
 function view(room){return room?{code:room.code,leader:room.leader,wave:room.wave,players:[...room.players.values()].map(p=>({...p})),canStart:room.players.size>=4&&room.players.size<=8&&[...room.players.values()].every(p=>p.ready)}:null;}
 function create(p){
  if(find(p.id))throw Error('Ya perteneces a un grupo');
  let code;do{code=crypto.randomBytes(5).toString('hex').toUpperCase();}while(rooms.has(code));
  const room={code,leader:p.id,wave:p.wave,players:new Map([[p.id,{...p,ready:false}]])};rooms.set(code,room);members.set(p.id,code);return view(room);
 }
 function join(code,p){
  if(find(p.id))throw Error('Ya perteneces a un grupo');
  const room=rooms.get(String(code||'').trim().toUpperCase());
  if(!room)throw Error('Grupo no encontrado');
  if(room.players.size>=8)throw Error('Grupo completo');
  if(room.wave!==p.wave)throw Error('Todos deben estar en la misma sección de Hades');
  room.players.set(p.id,{...p,ready:false});members.set(p.id,room.code);return view(room);
 }
 function ready(id,value){const room=find(id);if(!room||typeof value!=='boolean')throw Error('Grupo o estado inválido');room.players.get(id).ready=value;return view(room);}
 function leave(id){const room=find(id);if(!room)return null;members.delete(id);room.players.delete(id);if(!room.players.size){rooms.delete(room.code);return null;}if(room.leader===id)room.leader=room.players.keys().next().value;return view(room);}
 return {create,join,ready,leave,status:id=>view(find(id))};
}
module.exports={createHadesLobbies};
