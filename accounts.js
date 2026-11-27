'use strict';
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const {Pool}=require('pg');
const {createInventory}=require('./inventory-v13');const {createClans}=require('./clans-v15');const {createDaily}=require('./daily-v16');const {createMissions}=require('./missions-v16');const {createMinerals}=require('./minerals-v17');const {createUpgrades}=require('./upgrades-v18');const {createAssembly}=require('./assembly-v19');const {createFormations}=require('./formations-v19');const drones=require('./drones-v19');const {createPilot}=require('./pilot-v19');
const catalogV13=require('./data/catalog-v13.json');const {createBoosters}=require('./boosters-v112');const {createUBA}=require('./uba-v126');const invasion=require('./invasion-v134');const spaceball=require('./spaceball-v138');const hitac=require('./hitac-v141');const ice=require('./ice-v146');const {createIceRewards}=require('./ice-rewards-v148');const {createEventQueue}=require('./event-queue-v149');const {createLottery}=require('./hitac-lottery-v143');const {createHitacRewards}=require('./hitac-rewards-v145');const {createSpaceballRewards}=require('./spaceball-rewards-v140');const {createResults}=require('./invasion-results-v137');const {createAchievements}=require('./achievements-v125');const {createRankings}=require('./rankings-v123');const {createStations}=require('./stations-v113');const {createAuctions}=require('./auction-v114');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const nameOK=s=>typeof s==='string'&&/^[\p{L}\p{N} _-]{2,18}$/u.test(s);
const emailOK=s=>typeof s==='string'&&s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const passOK=s=>typeof s==='string'&&s.length>=10&&s.length<=128;
const tokenFrom=headers=>{const m=(headers.cookie||'').match(/(?:^|;\s*)gg_session=([a-f0-9]{64})(?:;|$)/);return m?.[1]||null;};
async function hashPassword(password){const salt=crypto.randomBytes(16).toString('hex');const key=await scrypt(password,salt,64);return `scrypt:${salt}:${key.toString('hex')}`;}
async function verifyPassword(password,hash){const [kind,salt,key]=String(hash||'').split(':');const valid=kind==='scrypt'&&/^[a-f0-9]{32}$/.test(salt||'')&&/^[a-f0-9]{128}$/.test(key||'');const derived=await scrypt(password,valid?salt:'00000000000000000000000000000000',64);return valid&&crypto.timingSafeEqual(derived,Buffer.from(key,'hex'));}
function createAccounts(url){if(!url)throw new Error('Falta DATABASE_URL');const pool=new Pool({connectionString:url,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,statement_timeout:10000});pool.on('error',err=>console.error('PostgreSQL:',err.code||'error'));
 const inventory=createInventory(pool),clans=createClans(pool),daily=createDaily(pool),missions=createMissions(pool),minerals=createMinerals(pool),upgrades=createUpgrades(pool),assembly=createAssembly(pool),formations=createFormations(pool),pilot=createPilot(pool),boosters=createBoosters(pool),stations=createStations(pool),auctions=createAuctions(pool),rankings=createRankings(pool),achievements=createAchievements(pool),uba=createUBA(pool),invasionResults=createResults(pool),spaceballRewards=createSpaceballRewards(pool),hitacLottery=createLottery(pool),hitacRewards=createHitacRewards(pool),iceRewards=createIceRewards(pool);const eventQueue=createEventQueue(pool,{ice:p=>iceRewards.settle(p.eventId,p.contributors),hitac:p=>hitacRewards.claim(p.accountId,p.unitId),invasion:p=>invasionResults.settle(p)});
 const attempts=new Map();let globalWindow=0,globalCount=0,activeAuth=0;
 function limit(req,res,next){const now=Date.now();if(now-globalWindow>60000){globalWindow=now;globalCount=0;for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);}const name=String(req.body?.username||'').toLowerCase().slice(0,40),a=attempts.get(name)||{n:0,until:now+60000};if(a.until<now){a.n=0;a.until=now+60000;}if(globalCount>=60||a.n>=8||activeAuth>=4)return res.status(429).json({error:'Demasiados intentos; reintenta en un minuto.'});globalCount++;a.n++;attempts.set(name,a);activeAuth++;res.once('finish',()=>activeAuth--);next();}
 const cookie=(res,token)=>res.cookie('gg_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production'||!!process.env.RENDER,sameSite:'strict',path:'/',maxAge:7*86400000});
 async function session(client,id){const token=crypto.randomBytes(32).toString('hex');await client.query('INSERT INTO player_sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval \'7 days\')',[digest(token),id]);return token;}
 function endpoints(app){
 app.use('/api/v13',async(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(req.method!=='GET'){
   if(!req.is('application/json'))return res.status(415).json({error:'JSON requerido'});
   try{if(new URL(req.get('Origin')||'invalid').host!==req.get('Host'))return res.status(403).json({error:'Origen inválido'});}catch{return res.status(403).json({error:'Origen inválido'});}
  }
  try{const a=await authenticate(req.headers);if(!a)return res.status(401).json({error:'Inicia sesión'});req.pilotV13=a;next();}catch{return res.status(503).json({error:'Servicio no disponible'});}
 });
 const routeV13=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||(/^[0-9A-Z]{5}$/.test(e.code||'')?503:400)).json({error:e.status?e.message:'No se pudo completar la operación'});}};
 app.get('/api/v13/rankings',routeV13(req=>rankings.status(req.pilotV13.id,req.query.board||'rank')));
 app.get('/api/v13/auction-cbs',routeV13(req=>auctions.status(req.pilotV13.id,req.query.board||'weekly-cbs')));
 app.get('/api/v13/stations',routeV13(req=>stations.status(req.pilotV13.id)));
 app.get('/api/v13/boosters',routeV13(req=>boosters.status(req.pilotV13.id)));
 app.post('/api/v13/hitac-lottery/draw',routeV13(req=>{if(process.env.GG_HITAC_ENABLED!=='1'||process.env.GG_HITAC_LOTTERY_ENABLED!=='1')throw Object.assign(Error('Lotería deshabilitada'),{status:403});return hitacLottery.draw(req.pilotV13.id,req.body?.requestId);}));
 app.get('/api/v13/hitac-lottery',routeV13(req=>hitacLottery.status(req.pilotV13.id)));
 app.get('/api/v13/ice',routeV13(()=>ice.preview()));
 app.get('/api/v13/hitac',routeV13(()=>hitac.preview()));
 app.get('/api/v13/spaceball',routeV13(()=>spaceball.preview()));
 app.get('/api/v13/invasion',routeV13(async req=>{const p=(await pool.query('SELECT level FROM player_progress WHERE account_id=$1',[req.pilotV13.id])).rows[0];return {...invasion.preview(p?.level),...await invasionResults.status(req.pilotV13.id)};}));
 app.get('/api/v13/uba',routeV13(req=>uba.status(req.pilotV13.id)));
 app.get('/api/v13/achievements',routeV13(req=>achievements.status(req.pilotV13.id)));
 app.post('/api/v13/achievements',routeV13(req=>achievements.select(req.pilotV13.id,req.body?.title)));
 app.get('/api/v13/pilot',routeV13(req=>pilot.status(req.pilotV13.id)));
 app.post('/api/v13/pilot',routeV13(req=>pilot.action(req.pilotV13.id,req.body||{})));
 app.get('/api/v13/drones',routeV13(req=>drones.read(pool,req.pilotV13.id)));
 app.post('/api/v13/drones/design',routeV13(async req=>{const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT account_id FROM player_progress WHERE account_id=$1 FOR UPDATE',[req.pilotV13.id]);const r=await drones.equipDesign(c,req.pilotV13.id,req.body?.droneId,req.body?.designId);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}));
 app.get('/api/v13/formations',routeV13(req=>formations.status(req.pilotV13.id)));
 app.post('/api/v13/formations/buy',routeV13(req=>formations.buy(req.pilotV13.id,req.body?.code)));
 app.get('/api/v13/assembly',routeV13(req=>assembly.status(req.pilotV13.id)));
 app.post('/api/v13/assembly',routeV13(req=>assembly.craft(req.pilotV13.id,req.body||{})));
 app.post('/api/v13/assembly/collect',routeV13(req=>assembly.collect(req.pilotV13.id,req.body?.jobId)));
 app.post('/api/v13/assembly/upgrade',routeV13(req=>assembly.upgrade(req.pilotV13.id,req.body||{})));
 app.post('/api/v13/assembly/drone',routeV13(req=>assembly.drone(req.pilotV13.id,req.body||{})));
 app.get('/api/v13/upgrades',routeV13(req=>upgrades.status(req.pilotV13.id)));
 app.get('/api/v13/minerals',routeV13(req=>minerals.status(req.pilotV13.id)));
 app.post('/api/v13/minerals',routeV13(req=>minerals.action(req.pilotV13.id,req.body||{})));
 app.get('/api/v13/daily',routeV13(req=>daily.status(req.pilotV13.id)));
 app.post('/api/v13/daily',routeV13(req=>daily.claim(req.pilotV13.id)));
 app.get('/api/v13/missions',routeV13(req=>missions.view(req.pilotV13.id)));
 app.post('/api/v13/missions',routeV13(req=>missions.action(req.pilotV13.id,req.body||{})));
 app.get('/api/v13/clan',routeV13(req=>clans.view(req.pilotV13.id)));
 app.post('/api/v13/clan',routeV13(req=>clans.action(req.pilotV13.id,req.body||{})));
 app.get('/api/v13/gate-log',routeV13(req=>inventory.gateRewardLog(req.pilotV13.id)));
 app.get('/api/v13/gates',routeV13(req=>inventory.gateStatus(req.pilotV13.id)));
 app.post('/api/v13/gates/spin',routeV13(req=>inventory.gateSpin(req.pilotV13.id,req.body||{})));
 app.post('/api/v13/gates/build',routeV13(req=>inventory.gateBuild(req.pilotV13.id,req.body||{})));
 app.post('/api/v13/gates/life',routeV13(req=>inventory.gateLife(req.pilotV13.id,req.body||{})));
 app.get('/api/v13/catalog',routeV13(async()=>catalogV13));
 app.get('/api/v13/inventory',routeV13(req=>inventory.snapshot(req.pilotV13.id)));
 app.post('/api/v13/purchase',routeV13(req=>inventory.purchase(req.pilotV13.id,req.body||{})));
 app.post('/api/v13/equip',routeV13(req=>inventory.equip(req.pilotV13.id,req.body||{})));
app.use('/api/auth',(req,res,next)=>{res.set('Cache-Control','no-store');if(req.method==='POST'){const origin=req.get('Origin');const host=req.get('Host');if(origin){try{if(new URL(origin).host!==host)return res.status(403).json({error:'Origen inválido'});}catch{return res.status(403).json({error:'Origen inválido'});}}if(!req.is('application/json'))return res.status(415).json({error:'JSON requerido'});}next();});
 app.post('/api/auth/register',limit,async(req,res)=>{const {username,email,password,ship}=req.body||{};const name=typeof username==='string'?username.trim():'';if(!nameOK(name)||!emailOK(email)||!passOK(password)||!['scout','tank'].includes(ship))return res.status(400).json({error:'Usuario de 2–18 caracteres, correo válido y contraseña de 10–128 caracteres requeridos.'});let c;try{const hash=await hashPassword(password);c=await pool.connect();await c.query('BEGIN');const a=(await c.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id,username',[name,email.trim().toLowerCase(),hash])).rows[0];await c.query('INSERT INTO player_progress(account_id,ship) VALUES($1,$2)',[a.id,ship]);const token=await session(c,a.id);await c.query('COMMIT');cookie(res,token);res.json({ok:true,username:a.username,ship});}catch(e){if(c)await c.query('ROLLBACK').catch(()=>{});res.status(e.code==='23505'?409:503).json({error:e.code==='23505'?'Usuario o correo ya registrado.':'Registro no disponible; reintenta.'});}finally{c?.release();}});
 app.post('/api/auth/login',limit,async(req,res)=>{const {username,password}=req.body||{};if(!nameOK(username?.trim?.())||!passOK(password))return res.status(400).json({error:'Datos de acceso inválidos.'});try{const a=(await pool.query('SELECT a.id,a.username,a.password_hash,p.ship FROM accounts a JOIN player_progress p ON p.account_id=a.id WHERE lower(a.username)=lower($1)',[username.trim()])).rows[0];if(!await verifyPassword(password,a?.password_hash))return res.status(401).json({error:'Usuario o contraseña incorrectos.'});const token=await session(pool,a.id);cookie(res,token);res.json({ok:true,username:a.username,ship:a.ship});}catch{res.status(503).json({error:'Acceso no disponible; reintenta.'});}});
 app.post('/api/auth/logout',async(req,res)=>{try{const token=tokenFrom(req.headers);if(token)await pool.query('DELETE FROM player_sessions WHERE token_hash=$1',[digest(token)]);res.clearCookie('gg_session',{path:'/'}).json({ok:true});}catch{res.status(503).json({error:'No se pudo cerrar sesión; reintenta.'});}});
 }
 async function authenticate(headers){const token=tokenFrom(headers);if(!token)return null;return (await pool.query('SELECT a.id,a.username,p.ship,p.credits,p.experience,p.level,p.honor,p.uridium FROM player_sessions s JOIN accounts a ON a.id=s.account_id JOIN player_progress p ON p.account_id=a.id WHERE s.token_hash=$1 AND s.expires_at>now()',[digest(token)])).rows[0]||null;}
 // Cada recompensa se confirma en PostgreSQL antes de mostrarse al jugador.
 async function reward(id,credits,xp,uridium=0,honor=0,dronePoints=0){const c=await pool.connect();try{await c.query('BEGIN');const r=(await c.query('UPDATE player_progress SET credits=credits+$2,experience=experience+$3,uridium=uridium+$4,honor=honor+$5,level=CASE WHEN experience+$3<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$3)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1 RETURNING credits,experience,level,uridium,honor',[id,credits,xp,uridium,honor])).rows[0];if(!r)throw Error('Cuenta sin progreso');r.rankChanged=await drones.award(c,id,dronePoints);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async function ready(){const lock=await pool.connect();try{await lock.query('SELECT pg_advisory_lock(71413002)');await pool.query('SELECT a.id,p.account_id,s.token_hash,i.item_code FROM accounts a LEFT JOIN player_progress p ON p.account_id=a.id LEFT JOIN player_sessions s ON s.account_id=a.id LEFT JOIN player_inventory i ON i.account_id=a.id LIMIT 0');await inventory.ready();await drones.ready(pool);await clans.ready();await daily.ready();await missions.ready();await minerals.ready();await upgrades.ready();await assembly.ready();await formations.ready();await pilot.ready();await boosters.ready();await stations.ready();await auctions.ready();await rankings.ready();await achievements.ready();await uba.ready();await invasionResults.ready();await spaceballRewards.ready();await hitacLottery.ready();await hitacRewards.ready();await iceRewards.ready();await eventQueue.ready();}finally{try{await lock.query('SELECT pg_advisory_unlock(71413002)');}finally{lock.release();}}}
 async function progressRead(id){return (await pool.query('SELECT credits,experience,level,honor,uridium FROM player_progress WHERE account_id=$1',[id])).rows[0]||null;}
 return {endpoints,authenticate,reward,ready,progressRead,ubaSettle:uba.settle,ubaAuthorizeAmmo:uba.authorizeAmmo,invasionSettle:p=>eventQueue.deliver('invasion',p.id,p),eventDrain:eventQueue.drain,spaceballClaim:spaceballRewards.claim,hitacLotteryOpen:hitacLottery.open,hitacLotteryClose:hitacLottery.close,hitacCapsuleGrant:hitacLottery.grant,hitacReward:(accountId,unitId)=>eventQueue.deliver('hitac',unitId,{accountId,unitId}),iceSettle:(eventId,contributors)=>eventQueue.deliver('ice',eventId,{eventId,contributors}),iceBoxClaim:iceRewards.claim,achievementAdd:achievements.add,achievementRead:achievements.read,rankingRefresh:rankings.refresh,recordDeath:rankings.death,stationStatus:stations.status,stationBuild:stations.build,stationHit:stations.hit,stationEmergency:stations.emergency,stationDefense:stations.defenseSnapshot,stationLower:stations.lower,auctionBid:auctions.bid,auctionSettle:auctions.settle,boosterRead:boosters.read,boosterStatus:boosters.status,boosterAction:boosters.action,collectMinerals:minerals.collect,stationMineralSale:minerals.action,upgradeStatus:upgrades.status,assemblyStatus:assembly.status,formationStatus:formations.status,selectFormation:formations.select,activateTechnology:assembly.activate,chargeMineral:upgrades.charge,upgradedShot:upgrades.shot,consumeOrdnance:upgrades.ordnance,generatorRound:upgrades.generatorRound,clanMembership:clans.membership,clanTags:clans.tags,collectClanTaxes:clans.collectTaxes,dailyClaim:daily.claim,missionEvent:async(id,type,target,count=1)=>{await missions.event(id,type,target,count);if(['alien','box'].includes(type))await achievements.add(id,type,count);},combatLoadout:inventory.combatLoadout,useCpu:inventory.useCpu,consumeAmmo:inventory.consumeAmmo,petInterval:inventory.petInterval,petKamikaze:inventory.petKamikaze,location:inventory.location,chooseCompany:inventory.chooseCompany,pvpReward:inventory.pvpReward,saveLocation:inventory.saveLocation,awardBox:inventory.awardBox,hadesEligibility:inventory.hadesEligibility,hadesStart:inventory.hadesStart,hadesKill:inventory.hadesKill,hadesAdvance:inventory.hadesAdvance,gateStatus:inventory.gateStatus,gateCheckpoint:inventory.gateCheckpoint,gateKill:inventory.gateKill,gateAdvance:inventory.gateAdvance,close:()=>pool.end()};
}
module.exports={createAccounts,hashPassword,verifyPassword};
