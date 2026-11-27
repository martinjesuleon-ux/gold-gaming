'use strict';
// Server-only flags for the existing authenticated test account. Not persisted.
function setTestDamage(p,enabled){
 if(!p?.godAllowed||typeof enabled!=='boolean')throw Error('Controlador reservado a la cuenta de pruebas');
 if(enabled&&(p.deadUntil||p.ubaReturn||p.invasionReturn||p.gatePending||p.hadesPending||p.gate?.gate==='hades'))throw Error('No disponible en actividades compartidas o durante transiciones');
 p.testDamage=enabled;return enabled;
}
function applyTestDamage(p,n,{pvp=false,immune=false,ammo}={}){
 if(!p?.godAllowed||p.testDamage!==true||pvp||immune||!n||n.gateShielded||p.deadUntil||p.ubaReturn||p.invasionReturn||p.gatePending||p.hadesPending||p.gate?.gate==='hades'||ammo==='SAB-50')return null;
 if(!Number.isFinite(n.hp)||n.hp<=0||!Number.isFinite(n.shield)||n.shield<0)return null;
 const amount=Math.ceil(n.hp+n.shield);n.hp=0;n.shield=0;return amount;
}
module.exports={setTestDamage,applyTestDamage};
