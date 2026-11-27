'use strict';
const MINES=[
 {id:'ACM-01',price:100,currency:'uridium',effect:'area',fraction:.2},
 {id:'DDM-01',price:200,currency:'uridium',effect:'hull',fraction:.2},
 {id:'SABM-01',price:150,currency:'uridium',effect:'shield',fraction:.15},
 {id:'SLM-01',price:50,currency:'uridium',effect:'slow',factor:.5,duration:5000},
 {id:'EMPM-01',price:150,currency:'uridium',effect:'reveal'}
];
const RULES={armMs:1000,cooldownMs:60000,triggerRadius:90,blastRadius:180,lifetimeMs:120000};
function mineImpact(v,m,now){
 const result={hp:v.hp,shield:v.shield};
 if(v.godMode||v.gateShielded)return result;
 if(m.effect==='area'){const amount=Math.floor(.2*(v.maxHp+v.maxShield)),absorbed=Math.min(v.shield,amount*(v.absorption??.5));result.shield=v.shield-absorbed;result.hp=Math.max(1,v.hp-(amount-absorbed));}
 if(m.effect==='hull')result.hp=Math.max(1,v.hp-Math.floor(v.maxHp*.2));
 if(m.effect==='shield')result.shield=Math.max(0,v.shield-Math.floor(v.maxShield*.15));
 if(m.effect==='slow'){result.mineSlowUntil=Math.max(v.mineSlowUntil||0,now+5000);}
 if(m.effect==='reveal')result.cloaked=false;
 return result;
}
module.exports={MINES,RULES,mineImpact};
