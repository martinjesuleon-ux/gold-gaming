'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','accounts.js'),'utf8');
const line=src.split('\n').find(l=>l.startsWith(' const ready=onceAsync('));
assert.ok(line);
const script=new vm.Script(line+'\nready;');
const install=env=>script.runInNewContext(env);

const names=['eventCalendar','uridiumEvent','gateSpecialEvent','inventory','petProgression','drones','clans','daily','missions','minerals','upgrades','assembly','formations','pilot','boosters','stations','auctions','rankings','achievements','uba','invasionResults','spaceballRewards','hitacLottery','hitacRewards','iceRewards','eventQueue'];
function setup(failAt){
 const calls=[];
 const lock={query:async sql=>{calls.push(sql);if(failAt==='lock'&&sql.includes('pg_advisory_xact_lock'))throw Error('lock failed');},release:()=>calls.push('release')};
 const env={pool:{connect:async()=>lock,query:async()=>calls.push('schema check')},onceAsync:fn=>fn,require:()=>({ready:async()=>calls.push('kit ready'),grant:async()=>false})};
 for(const name of names)env[name]={ready:async()=>{calls.push(name);if(failAt===name)throw Error('migration failed');}};
 return {calls,ready:install(env)};
}
const cases=[
 ['successful startup uses transaction lock and commits',async()=>{const s=setup();await s.ready();return s.calls[0]==='BEGIN'&&s.calls[3]==='SELECT pg_advisory_xact_lock(71413,2)'&&s.calls.includes('kit ready')&&s.calls.at(-2)==='COMMIT'&&s.calls.at(-1)==='release';}],
 ['migration failure rolls back and releases lock',async()=>{const s=setup('inventory');try{await s.ready();return false;}catch{return s.calls.at(-2)==='ROLLBACK'&&s.calls.at(-1)==='release'&&!s.calls.includes('COMMIT')&&!s.calls.includes('petProgression');}}],
 ['lock failure rolls back before schema work',async()=>{const s=setup('lock');try{await s.ready();return false;}catch{return s.calls.at(-2)==='ROLLBACK'&&s.calls.at(-1)==='release'&&!s.calls.includes('schema check');}}]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
