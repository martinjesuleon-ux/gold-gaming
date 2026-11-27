'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const equipment=require('../equipment-upgrade-v19');

const {quote,eligible}=equipment;
const interior={category:'cbs-modules',code:'HULM-1',level:1},exterior={category:'cbs-modules',code:'LTM-LR',level:1};
const cases=[
 ['interior full price',()=>quote(interior,15,0).total===402750],
 ['exterior full price',()=>quote(exterior,15,0).total===268500],
 ['premium interior rounded per level',()=>quote(interior,15,0,true).total===382620],
 ['premium exterior full price',()=>quote(exterior,15,0,true).total===255075],
 ['multi-level equals separate purchases',()=>quote(interior,3,0,true).total===[1,2,3].reduce((n,level)=>n+quote({...interior,level},1,0,true).total,0)],
 ['four hours to max level',()=>quote(exterior,15,0).duration===14400000],
 ['laser upgrade unaffected',()=>quote({category:'lasers',code:'LF-4',level:1},15,0,true).total===104250],
 ['shield upgrade unaffected',()=>quote({category:'shields',code:'SG3N-B03',level:1},1,0,true).total===3905],
 ['drone upgrade unaffected',()=>quote({category:'drones',code:'iris',level:1},1,0,true).total===3905],
 ['broken CBS excluded',()=>!eligible({...interior,category:'cbs-broken'})],
 ['fake CBS item rejected',()=>!eligible({...interior,code:'LF-4'})],
 ['level cap enforced',()=>{try{quote({...interior,level:16},1,0);return false;}catch{return true;}}]
];
for(const [name,fn] of cases)test(name,()=>assert.ok(fn()));
