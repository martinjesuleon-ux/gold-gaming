'use strict';
const crypto=require('node:crypto');
function createGroups(){
 const groups=new Map(),members=new Map(),invitations=new Map();
 const group=id=>groups.get(members.get(id));
 const view=g=>g?{id:g.id,leader:g.leader,members:[...g.members]}:null;
 function pending(id,now=Date.now()){const i=invitations.get(id),g=i&&groups.get(i.group);if(!i)return null;if(i.until<=now||!g||g.leader!==i.from||group(id)||g.members.size>=8){invitations.delete(id);return null;}return {from:i.from,until:i.until};}
 function invitees(from){return [...invitations].filter(([,i])=>i.from===from).map(([id])=>id);}
 function cancelOutgoing(from){for(const id of invitees(from))invitations.delete(id);}
 function create(id){if(group(id))throw Error('Ya perteneces a un grupo');invitations.delete(id);const g={id:crypto.randomUUID(),leader:id,members:new Set([id])};groups.set(g.id,g);members.set(id,g.id);return view(g);}
 function invite(from,to,now=Date.now()){const g=group(from);if(!g||g.leader!==from||from===to||group(to)||g.members.size>=8)throw Error('Invitación no disponible');const prior=pending(to,now);if(prior){if(prior.from===from)return prior;throw Error('El piloto ya tiene una invitación pendiente');}invitations.set(to,{group:g.id,from,until:now+60000});return {from,until:now+60000};}
 function accept(id,from,now=Date.now()){const i=invitations.get(id),g=i&&groups.get(i.group);if(!i||i.from!==from||i.until<=now||!g||g.leader!==from||g.members.size>=8||group(id))throw Error('Invitación inválida o vencida');invitations.delete(id);g.members.add(id);members.set(id,g.id);return view(g);}
 function decline(id,from,now=Date.now()){const i=pending(id,now);if(!i||i.from!==from)throw Error('Invitación inválida o vencida');invitations.delete(id);}
 function transfer(from,to){const g=group(from);if(!g||g.leader!==from||from===to||!g.members.has(to))throw Error('No puedes transferir el liderazgo');cancelOutgoing(from);g.leader=to;return view(g);}
 function leave(id){invitations.delete(id);cancelOutgoing(id);const g=group(id);if(!g)return null;members.delete(id);g.members.delete(id);if(!g.members.size){groups.delete(g.id);return null;}if(g.leader===id)g.leader=g.members.values().next().value;return view(g);}
 function kick(from,to){const g=group(from);if(!g||g.leader!==from||from===to||!g.members.has(to))throw Error('No puedes expulsar a este piloto');return leave(to);}
 function split(total,ids,killer){if(!Number.isSafeInteger(total)||total<0||!ids.includes(killer)||new Set(ids).size!==ids.length)throw Error('Reparto inválido');return Object.fromEntries(ids.map(id=>[id,Math.floor(total/ids.length)+(id===killer?total%ids.length:0)]));}
 return {create,invite,accept,decline,transfer,leave,kick,status:id=>view(group(id)),pending,invitees,split};
}
module.exports={createGroups};
