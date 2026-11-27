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
  // Emergency repair charges only once; use a damaged module in the isolated fixture.
  await pool.query('UPDATE player_progress SET uridium=1000 WHERE account_id=$1',[ids[0]]);
  await service.hit(ids[1],{...shot,damage:100000,requestId:randomUUID()},position);
  const snapshot=await service.defenseSnapshot(),defending=snapshot.stations.find(s=>s.asteroid_id===asteroid.id);
  assert.deepEqual(defending.attackers,[ids[1]]);
  await pool.query("INSERT INTO gg_v15_clan_diplomacy(source,target,state) VALUES($1,$2,'alliance')",[clans[0],clans[1]]);
  assert.deepEqual((await service.defenseSnapshot()).stations.find(s=>s.asteroid_id===asteroid.id).attackers,[]);
  await pool.query('DELETE FROM gg_v15_clan_diplomacy WHERE source=$1 AND target=$2',[clans[0],clans[1]]);
  const emergency={asteroidId:asteroid.id,slot:2,requestId:randomUUID()};
  await assert.rejects(service.emergency(ids[1],emergency),/Estación no disponible/);
  const repair=await service.emergency(ids[0],emergency);
  assert.equal(repair.uridium,500);assert.deepEqual(await service.emergency(ids[0],emergency),repair);
  await assert.rejects(service.emergency(ids[0],{...emergency,requestId:randomUUID()}),/activa/);
  assert.equal(Number((await pool.query('SELECT uridium FROM player_progress WHERE account_id=$1',[ids[0]])).rows[0].uridium),500);
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

test('CBS passive and emergency repair use elapsed time once, never revive destroyed modules',()=>{
 const {repairState,moduleLimits}=require('../stations-v113');
 const now=10000000,modules=validateModules(items(),300000).map(m=>m.slot===2?{...m,hp:m.hp-500000}:m.slot===3?{...m,hp:0}:m);
 const station={ready_at:now-20000,repair_at:now-20000,last_hit:now-20000,emergency_slot:2,emergency_until:now,modules};
 const r=repairState(station,now);
 assert.equal(r.modules[2].hp,modules[2].hp+205000+150000);assert.equal(r.modules[3].hp,0);
 const next=repairState({...station,modules:r.modules,repair_at:r.repairAt},now);
 assert.deepEqual(next.modules,r.modules);
 const after=repairState({...station,modules:r.modules,repair_at:r.repairAt},now+100000);
 assert.equal(after.modules[2].hp,moduleLimits(modules[2]).hp);
 const pending=repairState({...station,ready_at:now+10000},now);
 assert.equal(pending.modules[2].hp,modules[2].hp);
});

test('CBS turret damage, range, chance and cooldown use wiki stats',()=>{
 const {defenseShots}=require('../stations-v113'),a=ASTEROIDS[0],now=100000,accountId=randomUUID(),friendly=randomUUID();
 const modules=validateModules(items(),300000),s={asteroid_id:a.id,ready_at:now-1,modules,attackers:[accountId]};
 const p={id:'enemy',accountId,zone:a.map,x:a.x+500,y:a.y},ally={...p,id:'ally',accountId:friendly,x:a.x+10};
 const cd=new Map(),shots=defenseShots(s,[p,ally],cd,now,()=>0);
 assert.equal(shots.length,4);assert.ok(shots.every(x=>x.targetId==='enemy'));
 assert.deepEqual(shots.map(x=>x.damage),[59850,59850,85500,71250]);
 assert.equal(defenseShots(s,[p],cd,now+999,()=>0).length,0);
 assert.equal(defenseShots(s,[p],cd,now+1000,()=>0).length,2);
 assert.equal(defenseShots(s,[{...p,x:a.x+950}],new Map(),now,()=>0).length,0);
 assert.equal(defenseShots(s,[{...p,safe:true}],new Map(),now,()=>0).length,0);
 assert.ok(defenseShots(s,[p],new Map(),now,()=>.99).every(x=>x.damage===0));
 assert.equal(defenseShots({...s,modules:modules.map(m=>({...m,hp:0}))},[p],new Map(),now,()=>0).length,0);
});

test('CBS clan boosts respect ownership, map, health and wiki caps',()=>{
 const {clanStationEffects}=require('../stations-v113'),now=100000,a=ASTEROIDS[0],clanId=randomUUID();
 const modules=validateModules(items(),300000).map(m=>({...m,level:16}));
 const station={asteroid_id:a.id,ready_at:now-1,clan_id:clanId,modules};
 const p={x:a.x+700,y:a.y};
 const effects=clanStationEffects([station],clanId,a.map,p,now);
 assert.equal(effects.safe,true);assert.equal(effects.damage,1.1);assert.equal(effects.xp,1.1);assert.equal(effects.honor,1.1);
 assert.equal(clanStationEffects([station],clanId,a.map,{x:a.x+701,y:a.y},now).safe,false);
 assert.equal(clanStationEffects([station],clanId,'1-1',p,now).damage,1);
 assert.equal(clanStationEffects([station],clanId,'1-1',p,now).xp,1.1);
 assert.deepEqual(clanStationEffects([station],randomUUID(),a.map,p,now),{safe:false,xp:1,honor:1,damage:1});
 assert.equal(clanStationEffects(Array(7).fill(station),clanId,a.map,p,now).xp,1.5);
 assert.equal(clanStationEffects(Array(7).fill(station),clanId,a.map,p,now).honor,1.5);
 const broken={...station,modules:modules.map(m=>({...m,hp:0}))};
 assert.equal(clanStationEffects([broken],clanId,a.map,p,now).damage,1);
 assert.equal(clanStationEffects([{...station,ready_at:now+1}],clanId,a.map,p,now).safe,false);
});
