'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const logout=require('../logout-v222');

const {logoutDelay,logoutBlocked,logoutState}=logout;
const p={zone:'1-3',x:10,y:20,lastHit:1000,logoutRequest:{zone:'1-3',x:10,y:20,lastHit:1000,until:25000}};
const cases=[
 ['standard logout fifteen seconds',()=>logoutDelay(false)===15000],
 ['premium logout five seconds',()=>logoutDelay(true)===5000],
 ['all four restricted maps blocked',()=>['4-1','4-2','4-3','4-4'].every(zone=>logoutBlocked({...p,zone},10000))],
 ['galaxy gate blocked',()=>logoutBlocked({...p,gate:{}},10000)],
 ['recent combat blocked',()=>logoutBlocked({...p,lastHit:9999},10000)],
 ['moving blocked',()=>logoutBlocked({...p,dest:{x:5}},10000)],
 ['waiting before deadline',()=>logoutState(p,24999)==='waiting'],
 ['done at deadline',()=>logoutState(p,25000)==='done'],
 ['movement cancels countdown',()=>logoutState({...p,x:11},24000)==='cancel'],
 ['damage cancels countdown',()=>logoutState({...p,lastHit:20000},24000)==='cancel'],
 ['map change cancels countdown',()=>logoutState({...p,zone:'1-4'},24000)==='cancel'],
 ['attacking cancels countdown',()=>logoutState({...p,attack:true},24000)==='cancel'],
 ['idle without request',()=>logoutState({...p,logoutRequest:null},24000)==='idle']
];
for(const [name,fn] of cases)test(name,()=>assert.ok(fn()));
