'use strict';
const {supportSpec}=require('./pet-support-gears-v178');
function traderEnabled(id){const rules=require('./pet-test-kit-v175');return rules.gearEnabled(id)&&rules.vitalsEnabled(id)&&(rules.testKitEnabled(id)||process.env.GG_PET_TRADER_ENABLED==='1');}
function tradeQuote(level,cargo,honor,saleValue,now){
 const spec=supportSpec('G-TRA1',level);
 if(!spec||!cargo||!Number.isFinite(honor)||!Number.isSafeInteger(now)||now<0)throw Error('Datos de comercio inválidos');
 const sold={};let base=0;
 for(const code of ['prometium','endurium','terbium','prometid','duranium','promerium','seprom']){
  const n=cargo[code]??0;if(!Number.isSafeInteger(n)||n<0)throw Error('Cantidad de mineral inválida');
  if(!n)continue;sold[code]=n;base+=saleValue(code,n,honor);
 }
 const credits=Math.floor(base*Math.round(spec.saleFactor*100)/100);
 if(!Number.isSafeInteger(credits)||credits<0)throw Error('Importe de venta inválido');
 return {sold,base,credits,bonus:credits-base,until:now+spec.awayMs};
}
module.exports={traderEnabled,tradeQuote};
