'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const events=require('../uridium-event-v157');
const s=fs.readFileSync(path.join(__dirname,'..','inventory-v13.js'),'utf8');
const take=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)+1));
const handlers=take(' async function gateKill(',' async function gateRewardLog(')+take(' async function hadesKill(',' async function hadesAdvance(');
const script=new vm.Script(handlers+'\n({gateKill,hadesKill});');
const install=env=>script.runInNewContext(env);

const {multiply,activeAt,normalizeAction,specialGateQuantity}=events;
const payout={credits:100,xp:200,uridium:30,honor:10};
function setup(factor=2){
 const g={built:true,wave:0,lives:3,kills:[]},calls=[];
 const c={query:async(sql,args)=>{calls.push(args);return {rows:[{}]};}};
 const env={PLAYABLE:['alpha'],WAVES:{alpha:[[['NPC',2]]],hades:[[['NPC',2]]]},fail:(msg,status=400)=>Object.assign(Error(msg),{status}),transaction:async(id,fn)=>fn(c),hadesTransaction:async(ids,fn)=>fn(c,ids.map(id=>({id,g})),g),gateRows:async()=>({alpha:g}),saveGateRow:async()=>{},uridiumFactor:async()=>factor,drones:{award:async()=>false},multiply};
 return {g,calls,...install(env)};
}
async function rejected(fn){try{await fn();return false;}catch{return true;}}
const cases=[
 ['uridium x2 only for NPC gate reward',async()=>{const s=setup();const r=await s.gateKill('p','alpha',0,'0:0',payout);return r.payout.uridium===60&&r.payout.credits===100&&r.payout.xp===200&&r.payout.honor===10;}],
 ['uridium normal when event inactive',async()=>{const s=setup(1);return (await s.gateKill('p','alpha',0,'0:0',payout)).payout.uridium===30;}],
 ['gate duplicate is not paid twice',async()=>{const s=setup();await s.gateKill('p','alpha',0,'0:0',payout);return (await s.gateKill('p','alpha',0,'0:0',payout)).duplicate&&s.calls.length===1;}],
 ['leading zero alias rejected in gate',async()=>{const s=setup();return await rejected(()=>s.gateKill('p','alpha',0,'00:0',payout))&&s.calls.length===0;}],
 ['leading zero alias rejected in Hades',async()=>{const s=setup();return await rejected(()=>s.hadesKill(['p'],0,'0:00',payout,'p'))&&s.calls.length===0;}],
 ['out of range NPC rejected',async()=>{const s=setup();return await rejected(()=>s.gateKill('p','alpha',0,'0:2',payout));}],
 ['unsafe doubled reward rejected',async()=>rejected(async()=>multiply(Number.MAX_SAFE_INTEGER,true))],
 ['special item whitelist',async()=>['LF-4','Havoc','Hercules','Spartan'].every(x=>specialGateQuantity(x,2)===2)],
 ['other gate rewards not doubled',async()=>['Saturn','LF-P01','SG3N-B03','MUL-B03'].every(x=>specialGateQuantity(x,2)===1)&&specialGateQuantity(null,2)===0],
 ['scheduled event boundaries',async()=>{const s=normalizeAction({action:'schedule',startAt:'2027-01-01T00:00:00Z',endAt:'2027-01-01T01:00:00Z'},0);const t=Date.parse(s.startAt),end=Date.parse(s.endAt);return !activeAt(s,t-1)&&activeAt(s,t)&&activeAt(s,end-1)&&!activeAt(s,end);}],
 ['manual stop overrides schedule',async()=>!activeAt(normalizeAction({action:'stop'}),0)],
 ['invalid calendar date rejected',async()=>rejected(async()=>normalizeAction({action:'schedule',startAt:'2027-02-30T00:00:00Z',endAt:'2027-03-03T00:00:00Z'},0))]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
