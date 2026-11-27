'use strict';
// A tick-local index: references are live; combat validators still recheck eligibility.
function indexNpcAggressors(npcs){
 const byPilot=new Map();
 for(const n of npcs){
  if(!n.target||n.hp<=0)continue;
  let list=byPilot.get(n.target);
  if(!list)byPilot.set(n.target,list=[]);
  list.push(n);
 }
 return byPilot;
}
function recentPilots(p,players,now){
 const result=[];
 for(const [id,at] of p.petAggressors||[]){
  if(!Number.isFinite(at)||at>now||now-at>5000){p.petAggressors.delete(id);continue;}
  const pilot=players.get(id);
  if(pilot)result.push(pilot);else p.petAggressors.delete(id);
 }
 return result;
}
function createTickCandidates(npcs,players){
 let index=null;
 return {
  npcFor(p){if(!index)index=indexNpcAggressors(npcs.values());return index.get(p.id)||[];},
  pilotsFor(p,now){return recentPilots(p,players,now);}
 };
}
module.exports={indexNpcAggressors,recentPilots,createTickCandidates};
