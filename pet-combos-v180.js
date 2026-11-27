'use strict';
const {supportSpec}=require('./pet-support-gears-v178');
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function comboEnabled(id){const rules=require('./pet-test-kit-v175');return rules.gearEnabled(id)&&rules.vitalsEnabled(id)&&rules.guardEnabled(id)&&(rules.testKitEnabled(id)||process.env.GG_PET_COMBOS_ENABLED==='1');}
function repairQuote(level,now,readyAt,stock){
 const spec=supportSpec('CSR-02',level);
 if(!spec||!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(readyAt)||readyAt<0||!Number.isSafeInteger(stock)||stock<0)throw fail('Datos de reparación inválidos');
 if(now<readyAt)throw fail('Combo reparación en recarga: '+Math.ceil((readyAt-now)/1000)+' s',409);
 if(stock<spec.fuel)throw fail('Combustible insuficiente: necesitas '+spec.fuel+' unidades');
 return {...spec,stock:stock-spec.fuel,readyAt:now+spec.cooldownMs,until:now+spec.durationMs};
}
// The wiki does not specify fractional fuel rounding. Charge the next whole unit.
function comboGuardFuel(base,level){const spec=supportSpec('CGM-02',level);if(!spec||!Number.isSafeInteger(base)||base<1)throw fail('Consumo de guardia inválido');return Math.ceil(base*spec.fuelFactor);}
function deflectedDamage(amount,code,level){const spec=supportSpec(code,level);if(!spec||!['CGM-02','CSR-02'].includes(code)||!Number.isSafeInteger(amount)||amount<0)throw fail('Daño inválido');return Math.max(0,Math.round(amount*(1-spec.redirect)));}
module.exports={comboEnabled,repairQuote,comboGuardFuel,deflectedDamage};
