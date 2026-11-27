'use strict';
// Project wiki: gear upgrades unlock at PET levels 4 and 8.
const {SUPPORT}=require('./pet-support-gears-v178');
const GEARS=Object.freeze({
 'G-REP1':SUPPORT['G-REP1'],
 'G-AL1':Object.freeze([{price:7500,range:700},{price:17500,range:1500},{price:50000,range:2500}]),
 'G-KK1':Object.freeze([{price:7500,damage:25000,radius:250,cooldown:120000},{price:17500,damage:45000,radius:350,cooldown:60000},{price:65000,damage:75000,radius:450,cooldown:30000}])
});
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function spec(code,level){return Object.hasOwn(GEARS,code)&&Number.isInteger(level)&&level>=1&&level<=3?GEARS[code][level-1]:null;}
function quoteGear(code,ownedLevel,targetLevel,petLevel){
 if(!Number.isInteger(ownedLevel)||ownedLevel<0||ownedLevel>3||!Number.isInteger(petLevel)||petLevel<0||petLevel>20)throw fail('Nivel inválido');
 if(targetLevel!==ownedLevel+1)throw fail('El nivel del módulo cambió. Actualiza la tienda',409);
 const item=spec(code,targetLevel);
 if(!item||item.price==null)throw fail('Módulo no disponible');
 if(petLevel<[0,4,8][targetLevel-1])throw fail('Nivel de P.E.T. insuficiente',409);
 return {id:code,category:'petGear',quantity:1,currency:'uridium',total:item.price,targetLevel};
}
function levelRulesEnabled(id){return require('./pet-test-kit-v175').testKitEnabled(id)||process.env.GG_PET_GEAR_LEVELS_ENABLED==='1';}
module.exports={GEARS,spec,quoteGear,levelRulesEnabled};
