'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {hit,salvo}=require('../equipment-v13');

const attacker={damage:1000,lasers:10,shield:100,maxShield:5000};
const target={hp:20000,shield:10000,absorption:.8};
const cases=[
 ...[['LCB-10',1],['MCB-25',2],['MCB-50',3],['UCB-100',4],['RSB-75',6]].map(([code,m])=>[code+' damage multiplier',()=>{const r=salvo(attacker,target,code,100,.9);return r.damage===1000*m&&r.stock===90&&r.target.hp===20000-200*m&&r.target.shield===10000-800*m;}]),
 ['RSB independent interval',()=>salvo(attacker,target,'RSB-75',100,.9).intervalMs===3000],
 ['SAB drains shield without damaging hull',()=>{const r=salvo(attacker,target,'SAB-50',100,.9);return r.damage===0&&r.drained===2000&&r.target.hp===20000&&r.target.shield===8000&&r.attackerShield===2100;}],
 ['SAB shield recharge capped',()=>salvo({...attacker,shield:4999},target,'SAB-50',100,.9).attackerShield===5000],
 ['miss consumes ammo but causes no damage',()=>{const r=salvo(attacker,target,'LCB-10',100,0);return r.damage===0&&r.stock===90&&r.target.hp===target.hp&&r.target.shield===target.shield;}],
 ['insufficient ammo rejected',()=>{try{salvo(attacker,target,'LCB-10',9,.9);return false;}catch(e){return e.message==='Munición insuficiente';}}],
 ['shield overflow goes to hull',()=>{const r=hit({hp:1000,shield:100},500,.8);return r.hp===600&&r.shield===0;}],
 ['fractional damage never heals hull',()=>{const r=hit({hp:1000,shield:100},.6,1);return r.hp===1000&&r.shield===99.4;}],
 ['zero shield exposes hull',()=>hit({hp:1000,shield:0},500,.8).hp===500],
 ['overkill never makes hull negative',()=>hit({hp:10,shield:0},1000).hp===0],
 ['invalid precision rejected',()=>{try{salvo({...attacker,accuracyFactor:NaN},target,'LCB-10',100,.9);return false;}catch(e){return e.message==='Precisión inválida';}}],
 ['zero precision always misses',()=>salvo({...attacker,accuracyFactor:0},target,'LCB-10',100,.99).damage===0],
 ['invalid SAB target rejected',()=>{try{salvo(attacker,{...target,shield:-1},'SAB-50',100,.9);return false;}catch(e){return e.message==='Objetivo inválido';}}],
 ['excessive damage rejected',()=>{try{salvo({...attacker,damage:Number.MAX_VALUE},target,'RSB-75',100,.9);return false;}catch(e){return e.message==='Daño inválido';}}]
];
for(const [name,fn] of cases)test(name,()=>assert.ok(fn()));
