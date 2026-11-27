'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');const a=src.indexOf(' function respawnDestination('),b=src.indexOf(' function spawnPlayer(',a),ra=src.indexOf(" socket.on('v222:respawn',"),rb=src.indexOf(" socket.on('v18:ordnance',",ra);assert.ok(a>=0&&b>a&&ra>=0&&rb>ra);const script=new vm.Script(src.slice(a,b)+src.slice(ra,rb)+'\n({finishRespawn,offerRespawn});');const install=env=>script.runInNewContext(env);

function fixture(){
 const p={id:'s',accountId:'pilot',company:1,zone:'1-3',x:77,y:88,deadUntil:1,deathRequestId:'death',writes:Promise.resolve(),respawnChoiceUntil:Date.now()+30000};
 const events=[],saved=[],players=new Map([[p.id,p]]),pending=new Set();let handler;
 const env={players,pending,portals:()=>[{x:100,y:100},{x:500,y:500}],WORLD:{w:12000,h:8000},io:{to:()=>({emit:(name,data)=>events.push([name,data])})},changeMap:(p,z,pos)=>{p.zone=z;p.x=pos?.x||6000;p.y=pos?.y||4000;},spawnPlayer:p=>{p.deadUntil=0;p.x=6000;p.y=4000;},accounts:{respawnOptions:async()=>[{mode:'base',uridium:0},{mode:'portal',uridium:500},{mode:'position',uridium:1000}],respawnCharge:async(id,death,mode)=>({mode}),saveLocation:async(id,company,zone)=>saved.push(zone)},require:()=>({nearestRepairPortal:ps=>ps[0]}),socket:{id:'s',on:(name,fn)=>handler=fn},allowed:()=>true};
 const funcs=install(env);return {p,events,saved,env,funcs,send:(d)=>new Promise(resolve=>handler(d,resolve))};
}
const cases=[
 ['base remains free and returns to home map',async()=>{const f=fixture();const r=await f.send({mode:'base',deathId:'death'});await f.p.writes;return r.ok&&f.p.zone==='1-1'&&f.p.deadUntil===0&&f.saved[0]==='1-1';}],
 ['position respawn preserves death coordinates',async()=>{const f=fixture();const r=await f.send({mode:'position',deathId:'death'});return r.ok&&f.p.x===77&&f.p.y===88&&f.p.zone==='1-3';}],
 ['portal respawn uses server-selected position',async()=>{const f=fixture();const r=await f.send({mode:'portal',deathId:'death'});return r.ok&&f.p.x===100&&f.p.y===100;}],
 ['stale death request rejected',async()=>{const f=fixture();return !(await f.send({mode:'base',deathId:'old'})).ok&&f.p.deadUntil===1;}],
 ['galaxy gate cannot use selectable respawn',async()=>{const f=fixture();f.p.gate={};return !(await f.send({mode:'position',deathId:'death'})).ok;}],
 ['ambiguous failure requires same option',async()=>{const f=fixture();f.env.accounts.respawnCharge=async()=>{throw Error('offline');};const r=await f.send({mode:'portal',deathId:'death'});await f.p.writes.catch(()=>{});await Promise.resolve();return !r.ok&&r.retrySame===true&&!(await f.send({mode:'position',deathId:'death'})).ok;}],
 ['respawn emits completion and inventory update',async()=>{const f=fixture();await f.send({mode:'base',deathId:'death'});return f.events.some(([n])=>n==='v222:respawnDone')&&f.events.some(([n])=>n==='v13:inventoryChanged');}]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
