'use strict';
const catalog=require('./data/catalog-v13.json');
const lookup=(list,id)=>list.find(x=>x.id===id);
const requireRule=(ok,msg)=>{if(!ok)throw new Error(msg);};
function quote(category,id,quantity=1){
 const allowed=['ships','lasers','ammo','shields','engines'];
 requireRule(allowed.includes(category),'Categoría inválida');
 const item=lookup(catalog[category],id);
 requireRule(item&&item.price!==null&&['credits','uridium'].includes(item.currency),'Objeto no disponible');
 requireRule(Number.isSafeInteger(quantity)&&quantity>0&&quantity<=(category==='ammo'?100000:category==='ships'?1:100),'Cantidad inválida');
 return {id,category,quantity,currency:item.currency,total:item.price*quantity};
}
function stats(shipId,items,droneItems=[]){
 const ship=lookup(catalog.ships,shipId);
 requireRule(ship&&Array.isArray(items),'Nave o equipo inválido');
 const seen=new Set();let damage=0,shield=0,speed=ship.speed,absorption=0,lasers=0,generators=0;
 for(const item of items){
  requireRule(item&&typeof item.instanceId==='string'&&item.instanceId.length&&!seen.has(item.instanceId),'Objeto duplicado o inválido');
  seen.add(item.instanceId);
  const level=item.level??1;
  requireRule(Number.isInteger(level)&&level>=1&&level<=16,'Nivel inválido');
  const laser=lookup(catalog.lasers,item.code),gen=lookup(catalog.shields,item.code),engine=lookup(catalog.engines,item.code);
  if(laser){requireRule(laser.id!=='LF-P01','Láser exclusivo P.E.T.');lasers++;damage+=laser.damage*(1+(level-1)*catalog.rules.laserUpgradePerStep);}
  else if(gen){generators++;shield+=gen.shield*(1+(level-1)*catalog.rules.shieldUpgradePerStep);absorption=Math.max(absorption,gen.absorption);}
  else if(engine){generators++;speed+=engine.speed;}
  else throw Error('Equipo aún no admitido');
 }
 requireRule(lasers<=ship.lasers&&generators<=ship.generators,'Espacios de equipamiento excedidos');
 for(const item of droneItems){const l=lookup(catalog.lasers,item.code),g=lookup(catalog.shields,item.code);requireRule((l&&l.id!=='LF-P01')||g,'Equipo VANT inválido');const level=item.level??1;requireRule(Number.isInteger(level)&&level>=1&&level<=16,'Nivel inválido');if(l){lasers++;damage+=l.damage*(1+(level-1)*catalog.rules.laserUpgradePerStep);}else{shield+=g.shield*(1+(level-1)*catalog.rules.shieldUpgradePerStep);absorption=Math.max(absorption,g.absorption);}}
 return {hp:ship.hp,shield:Math.round(shield),speed,damage:Math.round(damage),absorption:shield?absorption:.5,lasers,generators};
}
function configurations(shipId,configs,owned){
 requireRule(Array.isArray(configs)&&configs.length===2&&owned instanceof Map,'Configuraciones inválidas');
 const used=new Set();
 return configs.map(config=>{
  const ids=Array.isArray(config)?config:config?.ship;
  requireRule(Array.isArray(ids),'Configuración inválida');
  const take=id=>{requireRule(typeof id==='string'&&owned.has(id)&&!used.has(id),'Objeto no disponible o duplicado');used.add(id);return {...owned.get(id),instanceId:id};};
  const droneItems=[],mounted=new Set();
  const drones=Array.isArray(config)?[]:config.drones??[];
  requireRule(Array.isArray(drones)&&drones.length<=10,'VANT inválidos');
  for(const d of drones){const drone=owned.get(d.id);requireRule(drone&&drone.category==='drones'&&['flax','iris','apis','zeus'].includes(drone.code)&&!mounted.has(d.id),'VANT no disponible');mounted.add(d.id);requireRule(Array.isArray(d.items)&&d.items.length<=catalog.drones[drone.code].slots,'Espacios VANT excedidos');for(const id of d.items)droneItems.push(take(id));}
  return stats(shipId,ids.map(take),droneItems);
 });
}
function hit(target,amount,absorption=.5){
 requireRule(Number.isFinite(amount)&&amount>=0&&Number.isFinite(target.hp)&&target.hp>=0&&Number.isFinite(target.shield)&&target.shield>=0&&Number.isFinite(absorption)&&absorption>=0&&absorption<=1,'Daño inválido');
 const absorbed=Math.min(target.shield,Math.round(amount*absorption));
 return {hp:Math.max(0,target.hp-(amount-absorbed)),shield:target.shield-absorbed};
}
function salvo(attacker,target,ammoId,stock,roll){
 const ammo=lookup(catalog.ammo,ammoId);
 requireRule(ammo&&Number.isSafeInteger(stock)&&Number.isFinite(roll)&&roll>=0&&roll<1&&Number.isFinite(attacker.damage)&&attacker.damage>=0,'Ataque inválido');
 const cost=attacker.lasers;
 requireRule(Number.isSafeInteger(cost)&&cost>0&&stock>=cost,'Munición insuficiente');
 const amount=roll<ammo.miss?0:Math.round(attacker.damage*ammo.multiplier);
 if(ammo.shieldOnly){
  const drained=Math.min(target.shield,amount);
  return {stock:stock-cost,intervalMs:ammo.intervalMs,damage:0,drained,target:{hp:target.hp,shield:target.shield-drained},attackerShield:Math.min(attacker.maxShield,attacker.shield+drained)};
 }
 return {stock:stock-cost,intervalMs:ammo.intervalMs,damage:amount,target:hit(target,amount,target.absorption??.5)};
}
module.exports={quote,stats,configurations,hit,salvo};
