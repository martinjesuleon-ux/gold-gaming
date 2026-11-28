'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {points,rankBonus,award,equipDesign}=require('../drones-v19');
test('alien points depend on hull and preserve Streuner versus StreuneR',()=>{assert.equal(points('phoenix','Kristallon'),75);assert.equal(points('goliath','Boss Kristallon'),18);assert.equal(points('goliath','Streuner'),0);assert.equal(points('goliath','StreuneR'),1);assert.equal(points('aegis','Uber-Lordakium'),15);assert.equal(points('goliath','Cubikon'),0);});
test('PvP table uses Goliath column for support hulls',()=>{assert.equal(points('citadel','vengeance',true),6);assert.equal(points('phoenix','spearhead',true),25);assert.equal(points('goliath','phoenix',true),0);});
test('rank bonuses depend on mean and reach 10 and 20 percent',()=>{assert.equal(rankBonus([{points:3100},{points:3100}]).damage,1.1);assert.equal(rankBonus([{points:3100}]).shield,1.2);assert.equal(rankBonus([{points:0},{points:3100}]).mean,3.5);assert.equal(rankBonus([]).damage,1);});
test('rank award updates only mounted drones and reports a threshold crossing',async()=>{const calls=[];const c={query:async(sql,args)=>{calls.push([sql,args]);return {rows:sql.includes('SELECT configs')?[{configs:[{drones:[{id:'d1'}]},{}],active:0}]:sql.includes('SELECT instance_id')?[{instance_id:'d1',drone_points:95}]:[]};}};assert.equal(await award(c,'pilot',5),true);assert.deepEqual(calls[2][1],['pilot',['d1'],5]);});
test('one design cannot be installed on two drones',async()=>{const c={query:async()=>({rows:[{instanceId:'d1',category:'drones',points:0,designId:'s1'},{instanceId:'d2',category:'drones',points:0},{instanceId:'s1',category:'drone-designs',code:'Havoc'}]})};let rejected=false;try{await equipDesign(c,'pilot','d2','s1');}catch{rejected=true;}assert.equal(rejected,true);});

test('per-configuration designs can be equipped and removed independently',async()=>{
 const rows=[{instanceId:'d1',category:'drones',code:'iris',points:0,designId:'h',design:'Havoc',designId2:'h',design2:'Havoc'},{instanceId:'d2',category:'drones',code:'iris',points:0,designId:null,design:null,designId2:null,design2:null},{instanceId:'h',category:'drone-designs',code:'Havoc'},{instanceId:'s',category:'drone-designs',code:'Hercules'}];
 const c={query:async(sql,args)=>{if(sql.startsWith('SELECT active'))return {rows:[{active:1}]};if(sql.startsWith('UPDATE')){const row=rows.find(r=>r.instanceId===args[1]),two=sql.includes('drone_design_config2'),design=rows.find(r=>r.instanceId===args[2]);row[two?'designId2':'designId']=args[2];row[two?'design2':'design']=design?.code||null;return {rows:[]};}return {rows};}};
 const {read}=require('../drones-v19');
 await equipDesign(c,'pilot','d1','s',1);
 let result=await read(c,'pilot');assert.equal(result.config,1);assert.equal(result.configurations[0][0].design,'Havoc');assert.equal(result.configurations[1][0].design,'Hercules');
 await equipDesign(c,'pilot','d2','h',1);
 await assert.rejects(equipDesign(c,'pilot','d2','h',0),/no disponible/);
 await equipDesign(c,'pilot','d1',null,1);result=await read(c,'pilot',0);
 assert.equal(result.drones[0].design,'Havoc');assert.equal(result.configurations[1][0].design,null);assert.equal(result.configurations[1][1].design,'Havoc');
 await assert.rejects(equipDesign(c,'pilot','d1','s',2),/Configuración inválida/);
});
test('damage and shields depend on designs in the selected configuration only',()=>{
 const {configurations}=require('../equipment-v13');
 const owned=new Map([['d',{category:'drones',code:'iris',level:1,points:0,design:'Havoc',design2:'Hercules'}],['l',{category:'lasers',code:'LF-3',level:1}],['s',{category:'shields',code:'SG3N-B02',level:1}]]);
 const config={ship:[],drones:[{id:'d',items:['l','s']}]};
 const [a,b]=configurations('goliath',[config,config],owned);assert.ok(a.damage>b.damage);assert.ok(b.shield>a.shield);
 owned.get('d').design2=null;const [x,y]=configurations('goliath',[config,config],owned);assert.equal(x.damage,a.damage);assert.equal(y.damage,b.damage);assert.equal(y.shield,a.shield);
});
