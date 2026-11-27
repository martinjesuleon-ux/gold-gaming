'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {ASTEROIDS,MODULES,RULES,validateModules,stationState,createStations}=require('../stations-v113');
const items=()=>['HULM-1','DEFM-1','REPM-1','HONM-1','XPM-1','DMGM-1','LTM-LR','LTM-LR','RAM-LA','RAM-MA'].map(code=>({code,level:1,instanceId:randomUUID()}));
test('wiki asteroid count, map count and module rules',()=>{
 assert.equal(ASTEROIDS.length,20);assert.equal(new Set(ASTEROIDS.map(a=>a.map)).size,19);assert.equal(Object.keys(MODULES).length,11);
 const valid=items();assert.equal(validateModules(valid,300000)[0].hp,5850000);assert.equal(validateModules(valid,3600000)[1].shield,5850000);
 assert.throws(()=>validateModules(valid,240000));assert.throws(()=>validateModules(valid,3660000));assert.throws(()=>validateModules(valid.slice(1),300000));
 assert.throws(()=>validateModules([valid[1],valid[0],...valid.slice(2)],300000));
 valid[6].code='REPM-1';assert.throws(()=>validateModules(valid,300000));valid[6].code='LTM-LR';valid[6].broken=true;assert.throws(()=>validateModules(valid,300000));
 assert.equal(stationState({ready_at:1000,down_until:1000+RULES.initialDown},999),'building');assert.equal(stationState({ready_at:1000,down_until:1000+RULES.initialDown},1000),'vulnerable');assert.equal(stationState({ready_at:1000,down_until:1000+RULES.initialDown},1000+RULES.initialDown),'ready');
});
test('CBS construction consumes owned modules once and rejects occupied asteroid',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg');const {createAccounts}=require('../accounts');const a=createAccounts(process.env.DATABASE_URL);try{await a.ready();}finally{await a.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());
 const asteroid=ASTEROIDS[0],position={zone:asteroid.map,x:asteroid.x,y:asteroid.y};
 const ids=[],clans=[];
 try{
  for(let i=0;i<2;i++){const name='C'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;ids.push(id);await pool.query("INSERT INTO player_progress(account_id,ship) VALUES($1,'scout')",[id]);
   const clan=randomUUID();clans.push(clan);await pool.query('INSERT INTO gg_v15_clans(id,name,tag,leader) VALUES($1,$2,$3,$4)',[clan,name,name.slice(0,6),id]);await pool.query('INSERT INTO gg_v15_clan_members(account_id,clan_id) VALUES($1,$2)',[id,clan]);}
  const inv=[items(),items()];for(let i=0;i<2;i++)for(const m of inv[i])await pool.query("INSERT INTO gg_v13_inventory(account_id,instance_id,code,category) VALUES($1,$2,$3,'cbs-modules')",[ids[i],m.instanceId,m.code]);
  const service=createStations(pool),request={asteroidId:asteroid.id,moduleIds:inv[0].map(x=>x.instanceId),minutes:5,requestId:randomUUID()};
  await assert.rejects(service.build(ids[0],request,{...position,x:0}),/Acércate/);
  const first=await service.build(ids[0],request,position),second=await service.build(ids[0],request,position);
  assert.equal(first.readyAt,second.readyAt);assert.equal(first.downUntil-first.readyAt,1800000);
  assert.equal((await service.status(ids[0])).inventory.length,0);
  await assert.rejects(service.build(ids[1],{...request,moduleIds:inv[1].map(x=>x.instanceId),requestId:randomUUID()},position),/ocupado/);
  assert.equal((await service.status(ids[1])).inventory.length,10);
 }finally{for(const clan of clans)await pool.query('DELETE FROM gg_v15_clans WHERE id=$1',[clan]);for(const id of ids)await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
