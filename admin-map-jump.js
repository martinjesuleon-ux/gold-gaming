'use strict';
const {MAPS}=require('./maps-v14');
const mapList=()=>Object.keys(MAPS);
function validateAdminJump(p,destination){
 if(!p?.godAllowed)return 'Salto reservado a la cuenta de pruebas';
 if(typeof destination!=='string'||!Object.hasOwn(MAPS,destination))return 'Mapa inválido';
 if(p.zone===destination)return 'Ya estás en ese mapa';
 if(p.deadUntil||p.gate||p.gatePending||p.hadesPending||p.ubaReturn||p.invasionReturn||p.shotPending||p.reloadPending||p.reloadRequested||p.upgradePending||p.cbsBusy||p.petPending||p.kamiPending)return 'Salto no disponible durante esta operación';
 return null;
}
module.exports={mapList,validateAdminJump};
