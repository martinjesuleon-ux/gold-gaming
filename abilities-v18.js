'use strict';
const ABILITIES={
 aegis:[
 {id:'repair-hp',name:'Reparar PV',duration:7000,cooldown:90000},
 {id:'repair-shield',name:'Reparar escudo',duration:5000,cooldown:30000},
 {id:'repair-pod',name:'Cápsula de reparación',duration:10000,cooldown:120000}],
 citadel:[
 {id:'draw-fire',name:'Atraer fuego',duration:5000,cooldown:40000},
 {id:'fortify',name:'Atrincherarse',duration:10000,cooldown:360000},
 {id:'protect',name:'Protección',duration:10000,cooldown:60000},
 {id:'travel',name:'Viaje',duration:5000,cooldown:45000}],
 spearhead:[
 {id:'recon',name:'Reconocimiento',duration:30000,cooldown:90000},
 {id:'jam',name:'JAM-X',duration:8000,cooldown:180000},
 {id:'mark',name:'Marca de objetivo',duration:15000,cooldown:90000},
 {id:'ultimate-cloak',name:'Camuflaje Definitivo',duration:15000,cooldown:300000}]
};
function active(p,id,now){return (p.abilities?.[id]?.until||0)>now;}
function activate(p,id,now,extra={}){
 const a=ABILITIES[p.ship]?.find(x=>x.id===id);
 if(!a)throw Error('Habilidad no disponible para esta nave');
 if(p.jamUntil>now)throw Error('Habilidades bloqueadas por JAM-X');
 if((p.abilities?.[id]?.readyAt||0)>now)throw Error('Habilidad en recarga');
 p.abilities??={};
 return p.abilities[id]={until:now+a.duration,readyAt:now+a.cooldown,...extra};
}
function heal(v,kind,amount){const max=kind==='hp'?v.maxHp:v.maxShield;v[kind]=Math.min(max,v[kind]+amount);}
function speedFactor(p,now){return active(p,'fortify',now)?0:active(p,'travel',now)?1.5:1;}
function incoming(p,now){return active(p,'fortify',now)?.5:1;}
function breakCloak(p){if(p.abilities?.['ultimate-cloak'])p.abilities['ultimate-cloak'].until=0;}
module.exports={ABILITIES,active,activate,heal,speedFactor,incoming,breakCloak};
