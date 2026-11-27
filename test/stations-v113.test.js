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
  await assert.rejects(service.build(ids[0],request,{...position,x:NaN}),/Acércate/);
  assert.equal((await service.status(ids[0])).canManage,true);
  const first=await service.build(ids[0],request,position),second=await service.build(ids[0],request,position);
  assert.equal(first.readyAt,second.readyAt);assert.equal(first.downUntil-first.readyAt,1800000);
  const built=await service.status(ids[0]);assert.equal(built.inventory.length,0);assert.equal(built.asteroids.find(a=>a.id===asteroid.id).station.owned,true);assert.equal((await service.status(ids[1])).asteroids.find(a=>a.id===asteroid.id).station.owned,false);
  await assert.rejects(service.build(ids[1],{...request,moduleIds:inv[1].map(x=>x.instanceId),requestId:randomUUID()},position),/ocupado/);
  assert.equal((await service.status(ids[1])).inventory.length,10);
  // Isolated fixture: move construction clock into the vulnerable phase without waiting.
  const now=Date.now();await pool.query('UPDATE gg_cbs_stations SET ready_at=$2,down_until=$3 WHERE asteroid_id=$1',[asteroid.id,now-1000,now+1799000]);
  const shot={asteroidId:asteroid.id,slot:2,damage:20000000,requestId:randomUUID()};
  await assert.rejects(service.hit(ids[0],shot,position),/propia estación/);
  await assert.rejects(service.hit(ids[1],{...shot,slot:0},position),/protegido/);
  const weapon={code:'LCB-10',count:2};
  await assert.rejects(service.hit(ids[1],shot,position,weapon),/Munición insuficiente/);
  await pool.query("INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,'LCB-10',10)",[ids[1]]);
  await assert.rejects(service.hit(ids[1],{...shot,slot:0},position,weapon),/protegido/);
  const firstHit=await service.hit(ids[1],shot,position,weapon);assert.equal(firstHit.uridium,700);assert.equal(firstHit.stock,8);assert.deepEqual(await service.hit(ids[1],shot,position,weapon),firstHit);
  assert.equal(Number((await pool.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='LCB-10'",[ids[1]])).rows[0].quantity),8);
  await assert.rejects(service.hit(ids[1],{...shot,requestId:randomUUID()},position),/destruido/);
  for(const slot of [1,3,4,5,6,7,8,9])await service.hit(ids[1],{...shot,slot,requestId:randomUUID()},position);
  const finalShot={...shot,slot:0,requestId:randomUUID()},final=await service.hit(ids[1],finalShot,position);assert.equal(final.stationDestroyed,true);assert.deepEqual(await service.hit(ids[1],finalShot,position),final);
  assert.equal((await service.status(ids[0])).asteroids.find(a=>a.id===asteroid.id).station,null);
  const broken=(await pool.query("SELECT instance_id,level FROM gg_v13_inventory WHERE account_id=$1 AND category='cbs-broken'",[ids[0]])).rows;
  assert.equal(broken.length,10);assert.deepEqual(broken.map(x=>x.instance_id).sort(),inv[0].map(x=>x.instanceId).sort());
  const reward=(await pool.query('SELECT credits,experience,honor,uridium FROM player_progress WHERE account_id=$1',[ids[1]])).rows[0];
  assert.equal(Number(reward.credits),50000000);assert.equal(Number(reward.experience),10000000);assert.equal(Number(reward.honor),500000);assert.equal(Number(reward.uridium),9200);

 }finally{for(const clan of clans)await pool.query('DELETE FROM gg_v15_clans WHERE id=$1',[clan]);for(const id of ids)await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});

test('CBS combat rules protect deflector, require edge destruction, and limit repairs',()=>{
 const {stationHit,repairModule,passiveRepairRate,destructionShares,DESTRUCTION_REWARD,EMERGENCY}=require('../stations-v113');
 const now=Date.UTC(2026,10,27,18),modules=validateModules(items(),300000),station={ready_at:now,down_until:now+1800000,modules};
 assert.equal(stationHit(station,0,1000,now).applied,0);
 const hit=stationHit(station,2,1000,now);assert.equal(hit.applied,1000);
 assert.equal(hit.modules[2].shield,modules[2].shield-800);assert.equal(hit.modules[2].hp,modules[2].hp-200);
 assert.equal(stationHit(station,2,1000,now+1800000).applied,0);
 assert.equal(passiveRepairRate(modules,now-9000,now),0);assert.equal(passiveRepairRate(modules,now-10000,now),20500);
 assert.equal(passiveRepairRate(modules.filter(m=>m.code!=='REPM-1'),now-10000,now),1025);
 assert.equal(repairModule(hit.modules[2],EMERGENCY.rate,EMERGENCY.duration).hp,modules[2].hp);
 const last={...station,modules:modules.map(m=>m.slot===0?m:{...m,hp:0,shield:0})};
 assert.equal(stationHit(last,0,10000000,now).stationDestroyed,true);
 const a=randomUUID(),b=randomUUID(),c=randomUUID(),shares=destructionShares([{accountId:a,at:now,damage:1},{accountId:a,at:now,damage:2},{accountId:b,at:now-600000,damage:3},{accountId:c,at:now-600001,damage:10}],now);
 assert.equal(shares.length,2);assert.equal(shares.reduce((n,x)=>n+x.credits,0),DESTRUCTION_REWARD.credits);
 assert.equal(shares.reduce((n,x)=>n+x.xp,0),DESTRUCTION_REWARD.xp);
 assert.equal(shares.reduce((n,x)=>n+x.honor,0),DESTRUCTION_REWARD.honor);
});
