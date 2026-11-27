'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const milestones=require('../referral-milestones-v222'),referrals=require('../referrals-v222');

const {MILESTONES,availableMilestones}=milestones;
function fixture(count=25,blocked=false){
 const claimed=[],items=[],stacks=[],times=[],calls=[];
 const c={release(){},async query(sql,a){calls.push(sql);if(sql.startsWith('SELECT account_id FROM player_progress'))return {rows:[{account_id:'pilot'}]};if(sql.startsWith('SELECT blocked'))return {rows:[{blocked}]};if(sql.startsWith('SELECT count'))return {rows:[{qualified:count}]};if(sql.startsWith('SELECT milestone FROM'))return {rows:claimed.map(milestone=>({milestone}))};if(sql.startsWith('INSERT INTO gg_referral_milestones'))claimed.push(a[1]);if(sql.startsWith('INSERT INTO gg_v13_inventory'))items.push(a);if(sql.startsWith('INSERT INTO gg_v13_ammo'))stacks.push(a);if(sql.startsWith('INSERT INTO gg_v16_entitlements'))times.push(a);return {rows:[]};}};
 return {service:referrals.createReferrals({connect:async()=>c}),claimed,items,stacks,times,calls};
}
const cases=[
 ['five thresholds',async()=>Object.keys(MILESTONES).join(',')==='5,15,25,50,100'],
 ['four recruits no milestone',async()=>availableMilestones(4).length===0],
 ['25 earns all three prior milestones',async()=>availableMilestones(25).join(',')==='5,15,25'],
 ['already claimed excluded',async()=>availableMilestones(50,[5,25]).join(',')==='15,50'],
 ['blocked network has no rewards',async()=>availableMilestones(100,[],true).length===0],
 ['exclusive level 20 rewards',async()=>Object.entries(MILESTONES).flatMap(([n,r])=>r.items.filter(i=>i[3]===20).map(i=>n+':'+i[1])).join(',')==='50:LF-4,100:LF-4,100:SG3N-B03'],
 ['undefined designs remain reserved',async()=>MILESTONES[50].pending.specialPetDesign===1&&MILESTONES[100].pending.specialShipDesign===1],
 ['cumulative claims pay exactly once',async()=>{const f=fixture();const a=await f.service.claim('pilot'),b=await f.service.claim('pilot');return a.awarded.length===3&&b.awarded.length===0&&f.claimed.join(',')==='5,15,25'&&f.items.length===10;}],
 ['100 recruits grants all exclusive items',async()=>{const f=fixture(100);await f.service.claim('pilot');return f.claimed.length===5&&f.items.filter(i=>i[4]===20).length===3&&f.times.some(i=>i[1]==='premium-seconds'&&i[2]===180*86400);}],
 ['blocked claims rollback',async()=>{const f=fixture(100,true);try{await f.service.claim('pilot');return false;}catch{return f.claimed.length===0&&f.calls.includes('ROLLBACK');}}]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
