'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {configurations}=require('../equipment-v13');

const items=new Map([['l',{code:'LF-1',category:'lasers'}],['l2',{code:'LF-1',category:'lasers'}],['s',{code:'SG3N-A01',category:'shields'}],['e',{code:'G3N-1010',category:'engines'}],['d',{code:'iris',category:'drones'}],['cpu',{code:'SL-01',category:'cpus'}],['bad',{code:'LF-1',category:'ships'}],['badShield',{code:'SG3N-A01',category:'ships'}]]);
const cfg=(ship=[],drones=[])=>({ship,drones});
const cases=[
 ['valid ship and drone equipment',()=>configurations('phoenix',[cfg(['l','e'],[{id:'d',items:['l2','s']}]),cfg()],items),r=>r[0].lasers===2&&r[0].shield===1000],
 ['normal two configurations share CPU',()=>configurations('phoenix',[cfg(['cpu']),cfg(['cpu'])],items),r=>r.every(x=>x.cpus.includes('SL-01'))],
 ['same laser cannot occupy ship and drone',()=>configurations('phoenix',[cfg(['l'],[{id:'d',items:['l']}]),cfg()],items),'Objeto no disponible o duplicado'],
 ['same laser cannot occupy both configurations',()=>configurations('phoenix',[cfg(['l']),cfg(['l'])],items),'Objeto no disponible o duplicado'],
 ['unowned equipment refused',()=>configurations('phoenix',[cfg(['missing']),cfg()],items),'Objeto no disponible o duplicado'],
 ['null drone rejected cleanly',()=>configurations('phoenix',[cfg([],[null]),cfg()],items),'VANT inválido'],
 ['non-string drone ID rejected',()=>configurations('phoenix',[cfg([],[{id:7,items:[]}]),cfg()],items),'VANT inválido'],
 ['incompatible inventory category in ship',()=>configurations('phoenix',[cfg(['bad']),cfg()],items),'Equipo de nave incompatible'],
 ['incompatible inventory category in drone',()=>configurations('phoenix',[cfg([],[{id:'d',items:['badShield']}]),cfg()],items),'Equipo VANT incompatible'],
 ['engine cannot be equipped in drone',()=>configurations('phoenix',[cfg([],[{id:'d',items:['e']}]),cfg()],items),'Equipo VANT incompatible'],
 ['drone cannot be duplicated in same configuration',()=>configurations('phoenix',[cfg([],[{id:'d',items:[]},{id:'d',items:[]}]),cfg()],items),'VANT no disponible']
];
for(const [name,fn,expected] of cases)test(name,()=>{if(typeof expected==='function')assert.ok(expected(fn()));else assert.throws(fn,e=>e.message===expected);});
