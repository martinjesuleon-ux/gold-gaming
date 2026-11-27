'use strict';
const catalog=require('./data/catalog-v13.json');
const {profile}=require('./pet-progression-v173');
const fail=(msg,status=400)=>Object.assign(Error(msg),{status});
const EMPTY=()=>({laser:[],generator:[]});
function shipReservations(configs=[]){
 const ids=new Set();
 if(!Array.isArray(configs))throw fail('Configuraciones de nave inválidas');
 for(const c of configs){
  for(const id of (Array.isArray(c)?c:c?.ship||[]))ids.add(id);
  if(!Array.isArray(c))for(const d of c?.drones||[])for(const id of d.items||[])ids.add(id);
 }
 return ids;
}
function validatePetEquipment(state,equipment,owned,configs=[]){
 const p=profile(state.experience,state.slots);
 if(!equipment||typeof equipment!=='object'||Array.isArray(equipment)||Object.keys(equipment).some(k=>!['laser','generator'].includes(k))||!(owned instanceof Map))throw fail('Equipamiento P.E.T. inválido');
 const reserved=shipReservations(configs),seen=new Set(),out=EMPTY();
 let damage=0,shield=0,absorption=0;
 for(const type of ['laser','generator']){
  const ids=equipment[type];
  if(!Array.isArray(ids)||ids.length>p.slots[type])throw fail('Ranuras P.E.T. insuficientes');
  for(const id of ids){
   const item=owned.get(id);
   if(typeof id!=='string'||!item||seen.has(id)||reserved.has(id))throw fail('Equipo no disponible o duplicado',409);
   const category=type==='laser'?'lasers':'shields';
   const spec=catalog[category].find(x=>x.id===item.code);
   if(item.category!==category||!spec)throw fail('Equipo incompatible con la ranura P.E.T.');
   const level=item.level??1;
   if(!Number.isInteger(level)||level<1||level>16)throw fail('Mejora de equipo inválida');
   seen.add(id);out[type].push(id);
   if(type==='laser')damage+=spec.damage*(1+(level-1)*catalog.rules.laserUpgradePerStep);
   else{shield+=spec.shield*(1+(level-1)*catalog.rules.shieldUpgradePerStep);absorption=Math.max(absorption,spec.absorption);}
  }
 }
 return {equipment:out,stats:{lasers:out.laser.length,generators:out.generator.length,damage:Math.round(damage*(1+p.damageBonus/100)),shield:Math.round(shield*(1+p.shieldBonus/100)),absorption:shield?absorption:0,maxHp:p.maxHp}};
}
function assertShipDoesNotUsePet(configs,equipment){
 const reserved=shipReservations(configs);
 for(const type of ['laser','generator'])for(const id of equipment?.[type]||[])if(reserved.has(id))throw fail('Retira primero el equipo del P.E.T.',409);
}
module.exports={EMPTY,shipReservations,validatePetEquipment,assertShipDoesNotUsePet};
