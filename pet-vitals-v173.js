'use strict';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function vitals(stats,saved){
 const maxHp=stats.maxHp,maxShield=stats.shield;
 if(!Number.isSafeInteger(maxHp)||maxHp<=0||!Number.isSafeInteger(maxShield)||maxShield<0)throw fail('Estadísticas P.E.T. inválidas');
 const bounded=(n,max)=>Math.max(0,Math.min(max,Math.floor(n)));
 const hp=bounded(saved?.hp??maxHp,maxHp),shield=hp===0?0:bounded(saved?.shield??maxShield,maxShield);
 return {hp,maxHp,shield,maxShield,destroyed:hp===0};
}
function damageVitals(stats,saved,amount){
 if(!Number.isSafeInteger(amount)||amount<0||!Number.isFinite(stats.absorption)||stats.absorption<0||stats.absorption>1)throw fail('Daño P.E.T. inválido');
 const v=vitals(stats,saved);
 if(v.destroyed)return v;
 const absorbed=Math.min(v.shield,Math.round(amount*stats.absorption));
 return vitals(stats,{hp:Math.max(0,v.hp-amount+absorbed),shield:v.shield-absorbed});
}
function repairVitals(stats,saved,price,balance){
 const v=vitals(stats,saved);
 if(!v.destroyed)throw fail('El P.E.T. no está destruido',409);
 if(!Number.isSafeInteger(price)||price<0)throw fail('Precio de reparación inválido');
 if(!Number.isSafeInteger(balance)||balance<price)throw fail('Uridium insuficiente',409);
 // Provisional: restore hull only, not shields. No charge for an intact unit.
 return {price,uridium:balance-price,vitals:vitals(stats,{hp:stats.maxHp,shield:0})};
}
module.exports={vitals,damageVitals,repairVitals};
