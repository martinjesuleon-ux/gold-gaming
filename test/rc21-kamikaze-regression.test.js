'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
const start=src.indexOf(" socket.on('v16:kamikaze',");
const end=src.indexOf('\n socket.on(',start+1);
assert.ok(start>=0&&end>start);
const constants=src.split('\n').filter(x=>/^ const (TEST_)?KAMIKAZE=/.test(x)).join('\n');
const script=new vm.Script(constants+'\n'+src.slice(start,end));
const install=env=>script.runInNewContext(env);

function setup(admin=false){
 let resolve,enter;
 const entered=new Promise(r=>enter=r);
 const authorized=new Promise(r=>resolve=r);
 const p={id:'pilot',accountId:admin?'test':'ordinary',godAllowed:admin,zone:'A',hp:100,petMode:'guard',petUntil:20000,petGeneration:1,petX:0,petY:0,writes:Promise.resolve()};
 const players=new Map([[p.id,p]]),pending=new Set(),events=[],hits=[];
 const npcs=new Map([['near',{id:'near',zone:'A',x:100,y:0,hp:100}],['far',{id:'far',zone:'A',x:4000,y:0,hp:100}],['shielded',{id:'shielded',zone:'A',x:10,y:0,hp:100,gateShielded:true}],['other',{id:'other',zone:'B',x:10,y:0,hp:100}]]);
 const env={closing:false,players,pending,npcs,Date:{now:()=>10000},socket:{id:p.id,on:(name,fn)=>env.fire=fn},allowed:()=>true,require:()=>({testKitEnabled:id=>id==='test'}),accounts:{petKamikaze:()=>{enter();return authorized;}},io:{to:id=>({emit:(name,data)=>events.push({id,name,data})})},setPetMode:(p,mode)=>p.petMode=mode,sameZone:(a,b)=>a.zone===b.zone,distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),damage:(n,d)=>{hits.push([n.id,d]);n.hp=Math.max(0,n.hp-d);},actualLaserDamage:(before,n)=>Math.max(0,before.hp-n.hp)+Math.max(0,(before.shield||0)-(n.shield||0)),laserDamage:(p,n,d)=>events.push({id:p.id,name:'damage',data:{target:n.id,amount:d}}),finishNPC:(p,n,defer,independent)=>events.push({name:'finish',data:{target:n.id,defer,independent}}),nextGateGroup:()=>{}};
 install(env);
 return {p,env,hits,events,async run(change=()=>{}){env.fire();await entered;change(p,env);resolve({fuel:90,readyAt:20000});await p.writes;}};
}
const cases=[
 ['admin damage/range/zero cooldown',true,()=>{},s=>s.hits.length===2&&s.hits.every(h=>h[1]===100000000)&&s.p.kamiUntil===0&&s.p.petMode==='guard'&&s.events.filter(e=>e.name==='damage'&&e.data.amount===100).length===2&&s.events.filter(e=>e.name==='finish'&&e.data.independent&&e.data.defer).length===2],
 ['ordinary damage/range/cooldown',false,()=>{},s=>s.hits.length===1&&s.hits[0][1]===1000000&&s.p.kamiUntil===20000&&s.p.petMode==='off'&&s.events.filter(e=>e.name==='damage'&&e.data.amount===100).length===1&&s.events.filter(e=>e.name==='finish'&&e.data.independent).length===1],
 ['expired flight',true,p=>p.petUntil=10000,s=>s.hits.length===0],
 ['pilot death',true,p=>p.hp=0,s=>s.hits.length===0],
 ['PET destroyed',true,p=>p.petVitals={destroyed:true},s=>s.hits.length===0],
 ['PET switched off',true,p=>p.petMode='off',s=>s.hits.length===0],
 ['map changed',true,p=>p.zone='B',s=>s.hits.length===0],
 ['PET generation changed',true,p=>p.petGeneration++,s=>s.hits.length===0],
 ['session disconnected',true,(p,e)=>e.players.delete(p.id),s=>s.hits.length===0],
 ['shutdown',true,(p,e)=>e.closing=true,s=>s.hits.length===0]
];
for(const [name,admin,change,verify] of cases)test(name,async()=>{const s=setup(admin);await s.run(change);assert.ok(verify(s));assert.equal(s.p.kamiPending,false);assert.equal(s.env.pending.size,0);});
