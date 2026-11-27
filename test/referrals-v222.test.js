'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const referrals=require('../referrals-v222');

const {LEVEL,TTL,RECRUIT,REFERRER,qualifies,ipFingerprint,validInvite,createReferrals}=referrals;
const id='00000000-0000-4000-8000-000000000001',ref='00000000-0000-4000-8000-000000000002',now=100*TTL;
function fixture({level=15,blocked=false,paid=false,used=false,own=false}={}){
 let qualified=paid,grants=0,stackWrites=[],registered=0;const calls=[];
 const c={release(){},async query(sql,args){calls.push(sql);if(sql.startsWith('SELECT r.*,n.blocked'))return {rows:[{referrer_id:ref,blocked,qualified_at:qualified?'date':null}]};if(sql.startsWith('SELECT account_id,level'))return {rows:[{account_id:id,level},{account_id:ref,level:1}]};if(sql.startsWith('UPDATE player_progress SET uridium'))grants++;if(sql.startsWith('INSERT INTO gg_v13_ammo'))stackWrites.push(args);if(sql.startsWith('UPDATE gg_referrals_v222 SET qualified_at'))qualified=true;if(sql.startsWith('SELECT id FROM accounts'))return {rows:[{id:ref}]};if(sql.startsWith('SELECT 1 FROM gg_referral_ip'))return {rows:own?[{}]:[]};if(sql.startsWith('SELECT blocked'))return {rows:[{blocked}]};if(sql.startsWith('INSERT INTO gg_referral_used_ip'))return {rows:used?[]:[{}]};if(sql.startsWith('INSERT INTO gg_referrals_v222('))registered++;return {rows:[]};}};
 return {service:createReferrals({connect:async()=>c}),c,calls,stackWrites,get grants(){return grants},get registered(){return registered}};
}
const cases=[
 ['level fifteen qualifies, fourteen does not',async()=>LEVEL===15&&qualifies(15)&&!qualifies(14)],
 ['invalid level rejected',async()=>!qualifies(NaN)&&!qualifies(15.5)],
 ['invite valid until thirty days',async()=>validInvite({referrer:ref,issuedAt:now-TTL+1},now)&&!validInvite({referrer:ref,issuedAt:now-TTL},now)],
 ['future invite rejected',async()=>!validInvite({referrer:ref,issuedAt:now+1},now)],
 ['invalid IP or short secret rejected',async()=>ipFingerprint('bad','a'.repeat(32))===null&&ipFingerprint('192.0.2.1','short')===null],
 ['IP fingerprint hides raw address and normalizes mapped IPv4',async()=>{const k='a'.repeat(32),h=ipFingerprint('192.0.2.1',k);return h.length===64&&h===ipFingerprint('::ffff:192.0.2.1',k)&&h!==ipFingerprint('192.0.2.1','b'.repeat(32));}],
 ['registration pays nothing',async()=>{const f=fixture();return await f.service.register(f.c,id,{referrer:ref,issuedAt:now},'hash',now)&&f.registered===1&&f.grants===0&&f.stackWrites.length===0;}],
 ['duplicate IP prevents attribution',async()=>{const f=fixture({used:true});return !(await f.service.register(f.c,id,{referrer:ref,issuedAt:now},'hash',now))&&f.registered===0;}],
 ['referrer IP collision blocks network',async()=>{const f=fixture({own:true});return !(await f.service.register(f.c,id,{referrer:ref,issuedAt:now},'hash',now))&&f.calls.some(s=>s.includes('VALUES($1,true)'));}],
 ['below threshold no payout',async()=>{const f=fixture({level:14});return !(await f.service.qualify(id))&&f.grants===0;}],
 ['blocked network no payout',async()=>{const f=fixture({blocked:true});return !(await f.service.qualify(id))&&f.grants===0;}],
 ['qualification pays exact reward once to both',async()=>{const f=fixture();return await f.service.qualify(id)&&!(await f.service.qualify(id))&&f.grants===1&&f.stackWrites.length===9&&f.stackWrites.some(a=>a[0]===id&&a[1]==='UCB-100'&&a[2]===5000)&&f.stackWrites.some(a=>a[0]===ref&&a[1]==='UCB-100'&&a[2]===8000);}]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
