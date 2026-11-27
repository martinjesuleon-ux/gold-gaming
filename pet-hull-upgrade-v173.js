'use strict';
const {levels}=require('./data/pet-progression-v173.json');
const fail=(message,status=409)=>Object.assign(Error(message),{status});
// Experimental interpretation: pay each unlocked hull tier once, in sequence.
// The table provides prices and HP ceilings, not whether purchases are cumulative.
function hullUpgradeQuote(level,paidTier){
 if(!Number.isInteger(level)||level<0||level>=levels.length||!Number.isInteger(paidTier)||paidTier<0||paidTier>level)throw fail('Nivel de mejora de vida inválido',400);
 if(paidTier===level)return null;
 const next=levels[paidTier+1];
 return {tier:next.level,price:next.hpUpgrade,maxHp:next.maxHp,addedHp:next.maxHp-levels[paidTier].maxHp};
}
function purchaseHull(level,paidTier,balance){
 const q=hullUpgradeQuote(level,paidTier);
 if(!q)throw fail('Sube de nivel para desbloquear otra mejora de vida');
 if(!Number.isSafeInteger(balance)||balance<q.price)throw fail('Uridium insuficiente');
 return {...q,uridium:balance-q.price};
}
module.exports={hullUpgradeQuote,purchaseHull};
