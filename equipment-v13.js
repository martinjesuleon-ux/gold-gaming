'use strict';
const catalog=require('./data/catalog-v13.json');const {extraStats}=require('./cpus-v18');const {rankBonus,designBonus}=require('./drones-v19');
const lookup=(list,id)=>list.find(x=>x.id===id);
const requireRule=(ok,msg)=>{if(!ok)throw new Error(msg);};
function quote(category,id,quantity=1){
 const allowed=['ships','lasers','ammo','shields','engines','rockets','specialRockets','launchers','launcherAmmo','mines','designs','cpus','robots','consumables'];
 requireRule(allowed.includes(category),'Categoría inválida');
 const item=lookup(catalog[category],id);
 requireRule(item&&item.price!==null&&['credits','uridium'].includes(item.currency),'Objeto no disponible');
 requireRule(Number.isSafeInteger(quantity)&&quantity>0&&quantity<=(['ammo','rockets','specialRockets','launcherAmmo','mines','consumables'].includes(category)?100000:['ships','designs','cpus','robots'].includes(category)?1:100),'Cantidad inválida');
 return {id,category,quantity,currency:item.currency,total:item.price*quantity};
}
function stats(shipId,items,droneItems=[]){
 const ship=lookup(catalog.ships,shipId);
 requireRule(ship&&Array.isArray(items),'Nave o equipo inválido');
 const seen=new Set();let damage=0,shield=0,speed=ship.speed,absorption=0,lasers=0,generators=0,launcher=null;
 for(const item of items){
  requireRule(item&&typeof item.instanceId==='string'&&item.instanceId.length&&!seen.has(item.instanceId),'Objeto duplicado o inválido');
  seen.add(item.instanceId);
  const level=item.level??1;
  requireRule(Number.isInteger(level)&&level>=1&&(level<=16||(level===20&&['LF-4','SG3N-B03'].includes(item.code))),'Nivel inválido');
  const laser=lookup(catalog.lasers,item.code),gen=lookup(catalog.shields,item.code),engine=lookup(catalog.engines,item.code);
  if(laser){requireRule(laser.id!=='LF-P01','Láser exclusivo P.E.T.');lasers++;damage+=laser.damage*(1+(level-1)*catalog.rules.laserUpgradePerStep);}
  else if(gen){generators++;shield+=gen.shield*(1+(level-1)*catalog.rules.shieldUpgradePerStep);absorption=Math.max(absorption,gen.absorption);}
  else if(engine){generators++;speed+=engine.speed;}
  else if(catalog.launchers.some(x=>x.id===item.code)||catalog.cpus.some(x=>x.id===item.code)||catalog.robots.some(x=>x.id===item.code)){}
  else throw Error('Equipo aún no admitido');
 }
 const extras=extraStats(ship,items);launcher=extras.launcher;
 requireRule(lasers<=ship.lasers&&generators<=ship.generators,'Espacios de equipamiento excedidos');
 for(const item of droneItems){const l=lookup(catalog.lasers,item.code),g=lookup(catalog.shields,item.code);requireRule((l&&l.id!=='LF-P01')||g,'Equipo VANT inválido');const level=item.level??1;requireRule(Number.isInteger(level)&&level>=1&&(level<=16||(level===20&&['LF-4','SG3N-B03'].includes(item.code))),'Nivel inválido');const droneLevel=item.droneLevel??1;requireRule(Number.isInteger(droneLevel)&&droneLevel>=1&&droneLevel<=16,'Nivel VANT inválido');if(l){lasers++;damage+=l.damage*(1+(level-1)*catalog.rules.laserUpgradePerStep)*(1+(droneLevel-1)*catalog.rules.laserUpgradePerStep)*designBonus(item.droneDesign).damage;}else{shield+=g.shield*(1+(level-1)*catalog.rules.shieldUpgradePerStep)*(1+(droneLevel-1)*catalog.rules.shieldUpgradePerStep)*designBonus(item.droneDesign).shield;absorption=Math.max(absorption,g.absorption);}}
 return {hp:ship.hp,shield:Math.round(shield),speed,damage:Math.round(damage),absorption:shield?absorption:.5,lasers,generators,...(lasers>0&&[...items,...droneItems].filter(i=>lookup(catalog.lasers,i.code)).every(i=>i.code==='LF-3')?{allLF3:true}:{}),...(launcher?{launcher}:{}),...(extras.used?{cpus:extras.cpus,robot:extras.robot,extrasUsed:extras.used,extraSlots:ship.extras+extras.slots}:{})};
}
function configurations(shipId,configs,owned){
 requireRule(Array.isArray(configs)&&configs.length===2&&owned instanceof Map,'Configuraciones inválidas');
 return configs.map(config=>{
  const ids=Array.isArray(config)?config:config?.ship;
  requireRule(Array.isArray(ids),'Configuración inválida');
  const usedHere=new Set();
  const take=id=>{
   const item=owned.get(id);
   requireRule(typeof id==='string'&&item&&!usedHere.has(id),'Objeto no disponible o duplicado');
   usedHere.add(id);return {...item,instanceId:id};
  };
  const droneItems=[],mounted=new Set(),ranked=[];
  const drones=Array.isArray(config)?[]:config.drones??[];
  requireRule(Array.isArray(drones)&&drones.length<=10,'VANT inválidos');
  for(const d of drones){requireRule(d&&typeof d==='object'&&!Array.isArray(d)&&typeof d.id==='string'&&d.id.length>0,'VANT inválido');const drone=owned.get(d.id);requireRule(drone&&drone.category==='drones'&&['flax','iris','apis','zeus'].includes(drone.code)&&!mounted.has(d.id),'VANT no disponible');mounted.add(d.id);ranked.push(drone);requireRule(Array.isArray(d.items)&&d.items.length<=catalog.drones[drone.code].slots,'Espacios VANT excedidos');for(const id of d.items)droneItems.push({...take(id),droneLevel:drone.level??1,droneDesign:drone.design||null});}
  const shipItems=ids.map(take);requireRule(shipItems.every(i=>['lasers','engines','shields','launchers','cpus','robots'].includes(i.category)),'Equipo de nave incompatible');requireRule(droneItems.every(i=>['lasers','shields'].includes(i.category)),'Equipo VANT incompatible');const base=stats(shipId,shipItems,droneItems),rank=rankBonus(ranked);return {...base,damage:Math.round(base.damage*rank.damage),shield:Math.round(base.shield*rank.shield),droneRank:rank.mean,droneCount:drones.length};
 });
}
function hit(target,amount,absorption=.5){
 requireRule(Number.isFinite(amount)&&amount>=0&&Number.isFinite(target.hp)&&target.hp>=0&&Number.isFinite(target.shield)&&target.shield>=0&&Number.isFinite(absorption)&&absorption>=0&&absorption<=1,'Daño inválido');
 const absorbed=Math.min(target.shield,amount,Math.round(amount*absorption));
 return {hp:Math.max(0,target.hp-(amount-absorbed)),shield:target.shield-absorbed};
}
function salvo(attacker,target,ammoId,stock,roll){
 const ammo=lookup(catalog.ammo,ammoId);
 requireRule(ammo&&Number.isSafeInteger(stock)&&Number.isFinite(roll)&&roll>=0&&roll<1&&Number.isFinite(attacker.damage)&&attacker.damage>=0,'Ataque inválido');
 const cost=attacker.lasers;
 requireRule(Number.isSafeInteger(cost)&&cost>0&&stock>=cost,'Munición insuficiente');
 const accuracy=attacker.accuracyFactor??1;
 requireRule(Number.isFinite(accuracy)&&accuracy>=0,'Precisión inválida');
 const miss=Math.max(0,Math.min(1,1-(1-ammo.miss*(attacker.aimBoost?.5:1))*accuracy));
 const amount=roll<miss?0:Math.round(attacker.damage*ammo.multiplier);
 requireRule(Number.isSafeInteger(amount)&&amount>=0,'Daño inválido');
 if(ammo.shieldOnly){
  requireRule(Number.isFinite(target.hp)&&target.hp>=0&&Number.isFinite(target.shield)&&target.shield>=0,'Objetivo inválido');
  const drained=Math.min(target.shield,amount);
  return {stock:stock-cost,intervalMs:ammo.intervalMs,damage:0,drained,target:{hp:target.hp,shield:target.shield-drained},attackerShield:Math.min(attacker.maxShield,attacker.shield+drained)};
 }
 return {stock:stock-cost,intervalMs:ammo.intervalMs,damage:amount,target:hit(target,amount,target.absorption??.5)};
}
module.exports={quote,stats,configurations,hit,salvo};
