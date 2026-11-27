'use strict';
const crypto=require('node:crypto');const {extend:extendBooster}=require('./boosters-v112');const {settle:settleEquipment}=require('./equipment-upgrade-v19');const {createFormations}=require('./formations-v19');const drones=require('./drones-v19');const {createPilot,bonus:pilotBonus}=require('./pilot-v19');
const {bonusLoot,pirateLoot,pirateEventsForDay,pirateEventLoot}=require('./loot-v14');
const {MAPS,boxFactor}=require('./maps-v14');
const {rewardFor}=require('./pvp-v15');
const {DEFS,GATES,SHARED,KRONOS,REWARDS,PLAYABLE,PROVISIONAL,WAVES,spinGate,itemDraw}=require('./gates-v14');
const {quote,configurations}=require('./equipment-v13');
const {assertShipDoesNotUsePet,hasMountedGear}=require('./pet-equipment-rules-v173');
const catalog=require('./data/catalog-v13.json');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const {specialGateQuantity}=require('./uridium-event-v157');
function createInventory(pool,{uridiumFactor=async()=>1,gateSpecialFactor=async()=>1}={}){
 const formations=createFormations(pool),pilot=createPilot(pool);
 async function ready(){
  await pool.query(`CREATE TABLE IF NOT EXISTS gg_v13_inventory (
   account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
   instance_id uuid NOT NULL, code text NOT NULL, category text NOT NULL,
   level integer NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 16),
   PRIMARY KEY(account_id,instance_id));
   CREATE TABLE IF NOT EXISTS gg_v13_ammo (
   account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
   code text NOT NULL, quantity bigint NOT NULL CHECK(quantity>=0),
   PRIMARY KEY(account_id,code));
   CREATE TABLE IF NOT EXISTS gg_pet_equipment_v173(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,equipment jsonb NOT NULL DEFAULT '{"laser":[],"generator":[]}');
   CREATE TABLE IF NOT EXISTS gg_v13_hangar (
   account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
   ship text NOT NULL DEFAULT 'phoenix', configs jsonb NOT NULL DEFAULT '[[],[]]',
   active integer NOT NULL DEFAULT 0 CHECK(active IN (0,1)));
   ALTER TABLE gg_v13_hangar ADD COLUMN IF NOT EXISTS design text;
   CREATE TABLE IF NOT EXISTS gg_v13_purchases (
   account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
   request_id uuid NOT NULL, response jsonb NOT NULL,
   PRIMARY KEY(account_id,request_id));
   CREATE TABLE IF NOT EXISTS gg_v14_location (account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE, company integer NOT NULL DEFAULT 1 CHECK(company BETWEEN 1 AND 3), map text NOT NULL DEFAULT '1-1');
   ALTER TABLE gg_v14_location ADD COLUMN IF NOT EXISTS company_chosen boolean NOT NULL DEFAULT false;
   CREATE TABLE IF NOT EXISTS gg_v15_honor_penalty(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE, ally_step integer NOT NULL DEFAULT 0, ally_last bigint NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS gg_v14_gates (
   account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
   gate text NOT NULL, pieces jsonb NOT NULL DEFAULT '[]',
   multiplier integer NOT NULL DEFAULT 1 CHECK(multiplier BETWEEN 1 AND 6),
   built boolean NOT NULL DEFAULT false, wave integer NOT NULL DEFAULT 0 CHECK(wave BETWEEN 0 AND 30),
   lives integer NOT NULL DEFAULT 0 CHECK(lives BETWEEN 0 AND 10),
   completions integer NOT NULL DEFAULT 0 CHECK(completions>=0),
   PRIMARY KEY(account_id,gate));
   ALTER TABLE gg_v14_gates ADD COLUMN IF NOT EXISTS kills jsonb NOT NULL DEFAULT '[]';
   CREATE TABLE IF NOT EXISTS gg_gate_reward_log(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,gate text NOT NULL,completion integer NOT NULL,payout jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(account_id,gate,completion));
   CREATE TABLE IF NOT EXISTS gg_v14_gate_spins (
   account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
   request_id uuid NOT NULL, response jsonb NOT NULL,
   PRIMARY KEY(account_id,request_id));`);
 }
 async function transaction(id,fn){
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   const p=(await c.query('SELECT credits,uridium FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];
   if(!p)throw fail('Cuenta no encontrada',404);
   const result=await fn(c,p);
   await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async function purchase(id,{category,code,quantity,requestId}){
  if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw fail('Identificador de compra inválido');
  let q=category==='drones'||category==='pet'||category==='fuel'||category==='petGear'?null:quote(category,code,quantity);
  return transaction(id,async(c,p)=>{
   const previous=(await c.query('SELECT response FROM gg_v13_purchases WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];
   if(previous)return previous.response;
   if(category==='fuel'){
    if(code!=='pet-fuel'||!Number.isSafeInteger(quantity)||quantity<4||quantity%4!==0||quantity>50000)throw fail('Compra combustible en múltiplos de cuatro');
    if(!(await c.query("SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND category='pet'",[id])).rowCount)throw fail('Necesitas un P.E.T.');
    const existing=Number((await c.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='pet-fuel'",[id])).rows[0]?.quantity||0);
    if(existing+quantity>50000)throw fail('Capacidad del depósito excedida');
    q={id:code,category,quantity,currency:'uridium',total:quantity/4};
   }
   if(category==='petGear'){
    if(!['G-AL1','G-KK1'].includes(code)||quantity!==1)throw fail('Engranaje inválido');
    const rows=(await c.query("SELECT instance_id AS \"instanceId\",category,code FROM gg_v13_inventory WHERE account_id=$1 AND category IN ('pet','petGear')",[id])).rows;
    if(!rows.some(x=>x.category==='pet'))throw fail('Necesitas un P.E.T.');
    if(rows.some(x=>x.code===code))throw fail('Engranaje ya adquirido');
    q={id:code,category,quantity,currency:'uridium',total:7500};
   }
   if(category==='pet'){
    if(code!=='pet-10'||quantity!==1)throw fail('P.E.T. inválido');
    if((await c.query("SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND category='pet'",[id])).rowCount)throw fail('Ya tienes un P.E.T.');
    q={id:code,category,quantity,currency:'uridium',total:50000};
   }
   if(category==='drones'){const d=catalog.drones[code];if(!['flax','iris'].includes(code)||!d||!Number.isSafeInteger(quantity)||quantity<1||quantity>8)throw fail('Dron o cantidad inválida');const n=Number((await c.query("SELECT count(*) AS n FROM gg_v13_inventory WHERE account_id=$1 AND category='drones' AND code IN ('flax','iris')",[id])).rows[0].n);if(n+quantity>8)throw fail('Límite de ocho VANT normales');q={id:code,category,quantity,currency:d.currency,total:d.prices.slice(n,n+quantity).reduce((a,b)=>a+b,0)};}
   if(category==='cpus'&&(await c.query("SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND code=$2 AND category='cpus'",[id,code])).rowCount)throw fail('CPU ya adquirido');
   if(category==='designs'&&(await c.query("SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND code=$2 AND category='ship-designs'",[id,code])).rowCount)throw fail('Diseño ya adquirido');
   if(category==='ships'&&(code==='phoenix'||(await c.query('SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND code=$2 AND category=$3',[id,code,category])).rowCount))throw fail('Nave ya disponible');
   if(Number(p[q.currency])<q.total)throw fail('Saldo insuficiente',409);
   const column=q.currency==='credits'?'credits':'uridium';
   const balance=(await c.query('UPDATE player_progress SET '+column+'='+column+'-$2 WHERE account_id=$1 RETURNING credits,uridium',[id,q.total])).rows[0];
   if(['ammo','fuel','rockets','specialRockets','launcherAmmo','mines','consumables'].includes(category)){
    await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,code,q.quantity]);
   }else{
    for(let i=0;i<q.quantity;i++)await c.query('INSERT INTO gg_v13_inventory(account_id,instance_id,code,category) VALUES($1,$2,$3,$4)',[id,crypto.randomUUID(),code,category==='designs'?'ship-designs':category]);
   }
   if(category==='cpus'){const uses=catalog.cpus.find(x=>x.id===code)?.uses;if(uses)await addStack(c,id,code+'-uses',uses);}
   const result={ok:true,...q,balance};
   await c.query('INSERT INTO gg_v13_purchases(account_id,request_id,response) VALUES($1,$2,$3)',[id,requestId,JSON.stringify(result)]);
   return result;
  });
 }
 async function snapshot(id){
  return transaction(id,async(c,p)=>{
   await settleEquipment(c,id);
   // Reading inventory must not activate an empty combat loadout.
   const hangar=(await c.query('SELECT ship,configs,active,design FROM gg_v13_hangar WHERE account_id=$1',[id])).rows[0]||{ship:'phoenix',configs:[[],[]],active:0};
   const items=(await c.query('SELECT instance_id AS "instanceId",code,category,level,drone_points AS points FROM gg_v13_inventory WHERE account_id=$1 ORDER BY category,code,instance_id',[id])).rows;
   const ammo=(await c.query('SELECT code,quantity FROM gg_v13_ammo WHERE account_id=$1',[id])).rows;
   const petEquipment=(await c.query('SELECT equipment FROM gg_pet_equipment_v173 WHERE account_id=$1',[id])).rows[0]?.equipment||{laser:[],generator:[]};
   return {balance:p,hangar,items,ammo,petEquipment,petGearEquipEnabled:require('./pet-test-kit-v175').gearEnabled(id)};
  });
 }
 async function equip(id,{ship,configs,active,design=null}){
  if(!catalog.ships.some(s=>s.id===ship)||![0,1].includes(active))throw fail('Nave o configuración inválida');
  return transaction(id,async c=>{
   await settleEquipment(c,id);
   const rows=(await c.query("SELECT i.instance_id AS \"instanceId\",i.code,i.category,i.level,i.drone_points AS points,d.code AS design FROM gg_v13_inventory i LEFT JOIN gg_v13_inventory d ON d.account_id=i.account_id AND d.instance_id=i.drone_design AND d.category='drone-designs' WHERE i.account_id=$1",[id])).rows;
   if(ship!=='phoenix'&&!rows.some(x=>x.category==='ships'&&x.code===ship))throw fail('Nave no adquirida');
   if(design!==null&&(!catalog.designs.some(d=>d.id===design&&d.ship===ship)||!rows.some(x=>x.category==='ship-designs'&&x.code===design)))throw fail('Diseño no adquirido o incompatible');
   const owned=new Map(rows.filter(x=>['lasers','engines','shields','drones','launchers','cpus','robots'].includes(x.category)).map(x=>[x.instanceId,x]));
   const computed=configurations(ship,configs,owned);
   const petEquipment=(await c.query('SELECT equipment FROM gg_pet_equipment_v173 WHERE account_id=$1',[id])).rows[0]?.equipment;
   assertShipDoesNotUsePet(configs,petEquipment);
   await c.query('INSERT INTO gg_v13_hangar(account_id,ship,configs,active,design) VALUES($1,$2,$3,$4,$5) ON CONFLICT(account_id) DO UPDATE SET ship=EXCLUDED.ship,configs=EXCLUDED.configs,active=EXCLUDED.active,design=EXCLUDED.design',[id,ship,JSON.stringify(configs),active,design]);
   return {ok:true,stats:computed[active]};
  });
 }
 async function activateConfig(id,active){
  if(![0,1].includes(active))throw fail('Configuración inválida');
  return transaction(id,async c=>{
   const r=await c.query('UPDATE gg_v13_hangar SET active=$2 WHERE account_id=$1 RETURNING active',[id,active]);
   if(!r.rowCount)throw fail('Configura primero tu nave en el hangar');
   return {ok:true,active:r.rows[0].active};
  });
 }
 async function combatLoadout(id){
  return transaction(id,async c=>{
   const upgrades=await settleEquipment(c,id);
   const h=(await c.query('SELECT ship,configs,active,design FROM gg_v13_hangar WHERE account_id=$1',[id])).rows[0];
   if(!h)return null;
   const items=(await c.query("SELECT i.instance_id AS \"instanceId\",i.code,i.category,i.level,i.drone_points AS points,d.code AS design FROM gg_v13_inventory i LEFT JOIN gg_v13_inventory d ON d.account_id=i.account_id AND d.instance_id=i.drone_design AND d.category='drone-designs' WHERE i.account_id=$1",[id])).rows;
   const stats=configurations(h.ship,h.configs,new Map(items.map(i=>[i.instanceId,i])));
   const d=catalog.designs.find(d=>d.id===h.design&&d.ship===h.ship&&items.some(i=>i.category==='ship-designs'&&i.code===d.id));
   const f=await formations.read(c,id),dr=await drones.read(c,id),mounted=new Set((h.configs[h.active]?.drones||[]).map(d=>d.id));return {ship:h.ship,pilotBonus:pilotBonus((await pilot.read(c,id)).skills),droneVisuals:dr.drones.filter(d=>mounted.has(d.instanceId)).map(d=>({code:d.code,design:d.design,rank:d.rank})),formation:f.active,formationReadyAt:f.readyAt,nextUpgradeAt:upgrades.nextDue,design:d?.id||null,designBonus:d?.bonus||{},active:h.active,...stats[h.active]};
  });
 }
 async function useCpu(id,code,destination=null){
  return transaction(id,async c=>{
   const h=(await c.query('SELECT configs,active FROM gg_v13_hangar WHERE account_id=$1',[id])).rows[0];
   const config=h?.configs?.[h.active],ids=Array.isArray(config)?config:config?.ship||[];
   const items=(await c.query("SELECT instance_id,code FROM gg_v13_inventory WHERE account_id=$1 AND category='cpus'",[id])).rows;
   if(!items.some(i=>i.code===code&&ids.includes(i.instance_id)))throw fail('Equipa este CPU primero');
   const costs=code==='AJP-01'?[['jump-voucher',1]]:['ISH-01','SMB-01'].includes(code)?[['ACM-01',10],['xenomit',100]]:['CLO4K-CPU','CLO4K-XL-CPU'].includes(code)?[[code+'-uses',1]]:null;
   if(!costs)throw fail('CPU no activable');
   if(code==='AJP-01'){const loc=(await c.query('SELECT map,company FROM gg_v14_location WHERE account_id=$1',[id])).rows[0];if(!loc||!Object.hasOwn(MAPS,destination)||destination===loc.map||/^5-|^B-L/.test(loc.map)||/^5-|^B-L/.test(destination))throw fail('Mapa no permitido para AJP');}
   const remaining={};
   for(const [item,n] of costs){const r=(await c.query('UPDATE gg_v13_ammo SET quantity=quantity-$3 WHERE account_id=$1 AND code=$2 AND quantity>=$3 RETURNING quantity',[id,item,n])).rows[0];if(!r)throw fail('Necesitas '+n+' '+item);remaining[item]=Number(r.quantity);}
   if(code==='AJP-01')await c.query('UPDATE gg_v14_location SET map=$2 WHERE account_id=$1',[id,destination]);
   return remaining;
  });
 }
 async function consumeAmmo(id,code,count){
  if(!(catalog.ammo.some(a=>a.id===code)||(code==='EMP'&&count===1))||!Number.isSafeInteger(count)||count<1||count>100)throw fail('Munición inválida');
  return transaction(id,async c=>{
   const row=(await c.query('UPDATE gg_v13_ammo SET quantity=quantity-$3 WHERE account_id=$1 AND code=$2 AND quantity>=$3 RETURNING quantity',[id,code,count])).rows[0];
   return row?Number(row.quantity):null;
  });
 }
 // El combustible se cobra antes de activar cada intervalo de vuelo.
 async function requireMountedGear(c,id,owned,code){
  if(!require('./pet-test-kit-v175').gearEnabled(id))return;
  const equipment=(await c.query('SELECT equipment FROM gg_pet_equipment_v173 WHERE account_id=$1',[id])).rows[0]?.equipment;
  if(!hasMountedGear(equipment,owned,code))throw fail('Equipa el módulo '+code+' en el hangar del P.E.T.');
 }
 async function petKamikaze(id){
  return transaction(id,async c=>{
   const owned=(await c.query("SELECT instance_id AS \"instanceId\",code,category FROM gg_v13_inventory WHERE account_id=$1 AND category IN ('pet','petGear')",[id])).rows;
   if(!owned.some(x=>x.category==='pet')||!owned.some(x=>x.code==='G-KK1'))throw fail('Compra el módulo G-KK1 Kamikaze en la tienda');
   await requireMountedGear(c,id,owned,'G-KK1');
   const r=(await c.query("UPDATE gg_v13_ammo SET quantity=quantity-10 WHERE account_id=$1 AND code='pet-fuel' AND quantity>=10 RETURNING quantity",[id])).rows[0];
   if(!r)throw fail('Necesitas 10 unidades de combustible');
   return {fuel:Number(r.quantity)};
  });
 }
 async function petInterval(id,mode){
  if(!['passive','guard','loot'].includes(mode))throw fail('Modo inválido');
  return transaction(id,async c=>{
   const owned=(await c.query("SELECT instance_id AS \"instanceId\",category,code FROM gg_v13_inventory WHERE account_id=$1 AND category IN ('pet','petGear')",[id])).rows;
   if(!owned.some(x=>x.category==='pet'))throw fail('Necesitas un P.E.T.');
   if(mode==='loot'&&!owned.some(x=>x.code==='G-AL1'))throw fail('Necesitas el engranaje G-AL1');
   if(mode==='loot')await requireMountedGear(c,id,owned,'G-AL1');
   if(process.env.GG_PET_VITALS_ENABLED==='1'){
    const v=(await c.query('SELECT hp FROM gg_pet_vitals_v173 WHERE account_id=$1',[id])).rows[0];
    if(v&&Number(v.hp)===0)throw fail('El P.E.T. está destruido. Repáralo primero');
   }
   // The source table does not specify its time unit. Enable only with an explicit 10-second period.
   let cost=10;
   if(process.env.GG_PET_FUEL_TABLE_PERIOD_MS==='10000'){
    const row=(await c.query('SELECT experience FROM gg_pet_progress_v173 WHERE account_id=$1',[id])).rows[0];
    cost=require('./pet-progression-v173').levelForExperience(Number(row?.experience||0)).fuel;
   }
   const r=(await c.query("UPDATE gg_v13_ammo SET quantity=quantity-$2 WHERE account_id=$1 AND code='pet-fuel' AND quantity>=$2 RETURNING quantity",[id,cost])).rows[0];
   if(!r)throw fail('Combustible insuficiente');
   return {fuel:Number(r.quantity)};
  });
 }
 async function location(id){return transaction(id,async c=>{const r=(await c.query('SELECT company,map,company_chosen FROM gg_v14_location WHERE account_id=$1',[id])).rows[0];return r&&MAPS[r.map]?r:{company:1,map:'1-1',company_chosen:false};});}
 async function chooseCompany(id,company){
  if(![1,2,3].includes(company))throw fail('Compañía inválida');
  return transaction(id,async(c,p)=>{
   const old=(await c.query('SELECT company,company_chosen FROM gg_v14_location WHERE account_id=$1',[id])).rows[0];
   if(old?.company_chosen&&old.company===company)throw fail('Ya perteneces a esta compañía');
   const cost=old?.company_chosen?5000:0;
   if(Number(p.uridium)<cost)throw fail('Uridium insuficiente');
   const balance=(await c.query('UPDATE player_progress SET uridium=uridium-$2,honor=CASE WHEN $2>0 AND honor>0 THEN honor/2 ELSE honor END,updated_at=now() WHERE account_id=$1 RETURNING credits,uridium,honor',[id,cost])).rows[0];
   const map=company+'-1';await c.query('INSERT INTO gg_v14_location(account_id,company,map,company_chosen) VALUES($1,$2,$3,true) ON CONFLICT(account_id) DO UPDATE SET company=EXCLUDED.company,map=EXCLUDED.map,company_chosen=true',[id,company,map]);
   return {company,map,company_chosen:true,cost,balance};
  });
 }
 async function pvpReward(attacker,victim,ship,honorFactor=1,dronePoints=0){
  if(attacker===victim)throw fail('Piloto inválido');
  return transaction(attacker,async c=>{
   const a=(await c.query('SELECT p.level,p.honor,COALESCE(l.company,1) AS company FROM player_progress p LEFT JOIN gg_v14_location l USING(account_id) WHERE p.account_id=$1',[attacker])).rows[0];
   const b=(await c.query('SELECT p.honor,COALESCE(l.company,1) AS company FROM player_progress p LEFT JOIN gg_v14_location l USING(account_id) WHERE p.account_id=$1',[victim])).rows[0];
   if(!a||!b)throw fail('Piloto inválido');
   const prev=(await c.query('SELECT ally_step,ally_last FROM gg_v15_honor_penalty WHERE account_id=$1',[attacker])).rows[0];
   const war=(await c.query("SELECT 1 FROM gg_v15_clan_members x JOIN gg_v15_clan_members y ON y.account_id=$2 JOIN gg_v15_clan_diplomacy d ON ((d.source=x.clan_id AND d.target=y.clan_id) OR (d.source=y.clan_id AND d.target=x.clan_id)) WHERE x.account_id=$1 AND d.state='war' LIMIT 1",[attacker,victim])).rowCount>0;
   const reward=rewardFor({...a,company:war?0:a.company,honor:Number(a.honor)},{...b,ship,honor:Number(b.honor)},prev?.ally_step||0,Number(prev?.ally_last||0),Date.now());
   if(reward.honor>0)reward.honor=Math.round(reward.honor*Math.max(1,Math.min(1.5,Number(honorFactor)||1)));
   if(reward.penalty)await c.query('INSERT INTO gg_v15_honor_penalty(account_id,ally_step,ally_last) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET ally_step=EXCLUDED.ally_step,ally_last=EXCLUDED.ally_last',[attacker,reward.penalty.next,reward.penalty.last]);
   const balance=(await c.query('UPDATE player_progress SET credits=GREATEST(0,credits+$2),experience=experience+$3,uridium=uridium+$4,honor=honor+$5,level=CASE WHEN experience+$3<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$3)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1 RETURNING credits,experience,level,uridium,honor',[attacker,reward.credits,reward.xp,reward.uridium,reward.honor])).rows[0];
   await c.query('INSERT INTO gg_rank_kills(attacker,victim,ally) VALUES($1,$2,$3)',[attacker,victim,!!reward.penalty]);
   const rankChanged=reward.honor>=0&&await drones.award(c,attacker,dronePoints);return {reward,balance,rankChanged};
  });
 }
 async function saveLocation(id,company,map){if(![1,2,3].includes(company)||!Object.hasOwn(MAPS,map))throw fail('Mapa inválido');return transaction(id,async c=>{await c.query('INSERT INTO gg_v14_location(account_id,company,map) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET map=EXCLUDED.map',[id,company,map]);return {company,map};});}
 async function awardBox(id,map='1-1',level=1,kind='bonus',resourceFactor=1){
   if(kind==='pirate'){
    if(!Object.hasOwn(MAPS,map))throw fail('Mapa inválido para cofre pirata');
    return transaction(id,async(c,p)=>{
     const key=(await c.query("UPDATE gg_v13_ammo SET quantity=quantity-1 WHERE account_id=$1 AND code='green-key' AND quantity>=1 RETURNING quantity",[id])).rows[0];
     if(!key)throw Object.assign(fail('Necesitas una llave verde',409),{code:'NO_GREEN_KEY'});
     const events=pirateEventsForDay(),roll=()=>crypto.randomInt(1000000)/1000000;
     let loot=events.helix||events.apisZeus?pirateEventLoot(roll(),roll(),roll(),events):pirateLoot(crypto.randomInt(1000),roll(),roll());
     if(loot.category==='drones'){
      const owned=(await c.query("SELECT code FROM gg_v13_inventory WHERE account_id=$1 AND category='drones'",[id])).rows;
      // Wiki does not define duplicate special drone compensation; award one matching part.
      if(owned.length>=10||owned.some(d=>d.code===loot.code))loot={code:loot.code+'-piece',quantity:1,duplicate:true};
     }
     if(loot.category==='ship-designs'||loot.category==='cpus'){
      const owned=(await c.query('SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND code=$2 AND category=$3',[id,loot.code,loot.category])).rows.length>0;
      if(owned&&loot.category==='ship-designs')loot={code:'green-key',quantity:1,duplicate:true};
      else if(owned&&loot.category==='cpus')loot={code:loot.code+'-uses',quantity:10,duplicate:true};
     }
     if(loot.category==='booster'){
      // Duration per booster uses the standard ten-hour award; activation is a separate feature.
      await c.query('INSERT INTO gg_v16_entitlements(account_id,code,seconds) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET seconds=gg_v16_entitlements.seconds+EXCLUDED.seconds',[id,loot.code,36000]);
     }else if(loot.category){
      await c.query('INSERT INTO gg_v13_inventory(account_id,instance_id,code,category) VALUES($1,$2,$3,$4)',[id,crypto.randomUUID(),loot.code,loot.category]);
      if(loot.category==='cpus')await addStack(c,id,loot.code+'-uses',10);
     }else await addStack(c,id,loot.code,loot.quantity);
     return {loot,balance:p,keys:Number(key.quantity)+(loot.code==='green-key'?loot.quantity:0)};
    });
   }
  const loot=bonusLoot(crypto.randomInt(100),crypto.randomInt(1000000)/1000000);loot.quantity=Math.floor(loot.quantity*boxFactor(map,level));
  return transaction(id,async(c,p)=>{
   const b=pilotBonus((await pilot.read(c,id)).skills);loot.quantity=Math.floor(loot.quantity*b.box*Math.max(1,Math.min(2,Number(resourceFactor)||1))*(loot.code==='uridium'?b.luck:1));let balance=p;
   if(['credits','uridium'].includes(loot.code)){
    balance=(await c.query('UPDATE player_progress SET '+loot.code+'='+loot.code+'+$2 WHERE account_id=$1 RETURNING credits,uridium',[id,loot.quantity])).rows[0];
   }else{
    await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,loot.code,loot.quantity]);
   }
   return {loot,balance};
  });
 }
 const validRequest=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
 async function gateRows(c,id){
  const rows=Object.fromEntries(GATES.map(g=>[g,{gate:g,pieces:[],multiplier:1,built:false,wave:0,lives:0,completions:0,kills:[]}]));
  for(const row of (await c.query('SELECT gate,pieces,multiplier,built,wave,lives,completions,kills FROM gg_v14_gates WHERE account_id=$1',[id])).rows)if(rows[row.gate])rows[row.gate]=row;
  return rows;
 }
 async function saveGateRow(c,id,g){
  await c.query('INSERT INTO gg_v14_gates(account_id,gate,pieces,multiplier,built,wave,lives,completions,kills) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(account_id,gate) DO UPDATE SET pieces=EXCLUDED.pieces,multiplier=EXCLUDED.multiplier,built=EXCLUDED.built,wave=EXCLUDED.wave,lives=EXCLUDED.lives,completions=EXCLUDED.completions,kills=EXCLUDED.kills',[id,g.gate,JSON.stringify(g.pieces),g.multiplier,g.built,g.wave,g.lives,g.completions,JSON.stringify(g.kills||[])]);
 }
 async function addStack(c,id,code,quantity){
  if(quantity>0)await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,code,quantity]);
 }
 async function gateView(c,id,rows){
  const energy=Number((await c.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='gate-energy'",[id])).rows[0]?.quantity||0);
  const balance=(await c.query('SELECT credits,uridium FROM player_progress WHERE account_id=$1',[id])).rows[0];
  const states=Object.fromEntries(GATES.map(g=>[g,{...DEFS[g],...rows[g],required:DEFS[g].pieces,ready:rows[g].built,canBuild:!rows[g].built&&rows[g].pieces.length===DEFS[g].pieces,combatAvailable:PLAYABLE.includes(g),provisional:PROVISIONAL[g]||null}]));
  return {gates:GATES,states,alpha:states.alpha,energy,balance};
 }
 async function gateStatus(id){return transaction(id,async c=>gateView(c,id,await gateRows(c,id)));}
 async function gateAction(id,body,action){
  const {gate,requestId,useMultiplier=false,allowUridium=false}=body||{};
  if(!GATES.includes(gate)||!validRequest(requestId)||typeof useMultiplier!=='boolean'||typeof allowUridium!=='boolean')throw fail('Solicitud de puerta inválida');
  return transaction(id,async(c,p)=>{
   const old=(await c.query('SELECT response FROM gg_v14_gate_spins WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];if(old)return old.response;
   const rows=await gateRows(c,id),g=rows[gate],def=DEFS[gate];let reward=null,batch=null;
   if(action==='spin'){
    if(gate==='kronos')throw fail('Kronos se construye completando otras puertas');
    const pool=SHARED.includes(gate)?SHARED:[gate];
    if(!pool.some(k=>(!SHARED.includes(gate)||!rows[k].built)&&rows[k].pieces.length<DEFS[k].pieces))throw fail('No hay puertas disponibles para recibir piezas');
    const count=body.count===undefined?1:body.count;
    if(![1,10,100,1000].includes(count))throw fail('Cantidad de tiradas inválida');
    const availableEnergy=Number((await c.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='gate-energy'",[id])).rows[0]?.quantity||0);
    const availableUri=Number(p.uridium);
    const totals=new Map();let spins=0,energyUsed=0,uridiumUsed=0;
    for(let i=0;i<count;i++){
     if(!pool.some(k=>(!SHARED.includes(gate)||!rows[k].built)&&rows[k].pieces.length<DEFS[k].pieces))break;
     if(energyUsed<availableEnergy)energyUsed++;
     else if(allowUridium&&availableUri-uridiumUsed>=100)uridiumUsed+=100;
     else break;
     const next=spinGate(rows,gate,crypto.randomInt(100),n=>crypto.randomInt(n),useMultiplier);
     if(next.target)rows[next.target].pieces=next.pieces;
     for(const k of pool)rows[k].multiplier=next.multiplier;
     reward=next.reward;spins++;
     const key=reward.code+(reward.gate?':'+reward.gate:'');const old=totals.get(key);
     totals.set(key,{...reward,quantity:(old?.quantity||0)+reward.quantity});
    }
    if(!spins)throw fail('Autoriza el gasto de 100 uridium o consigue energía');
    if(energyUsed)await c.query("UPDATE gg_v13_ammo SET quantity=quantity-$2 WHERE account_id=$1 AND code='gate-energy'",[id,energyUsed]);
    if(uridiumUsed)await c.query('UPDATE player_progress SET uridium=uridium-$2 WHERE account_id=$1',[id,uridiumUsed]);
    for(const k of pool)await saveGateRow(c,id,rows[k]);
    for(const item of totals.values()){
     if(item.code==='nanohull-percent')await addStack(c,id,'nanohull-basis-points',Math.round(item.quantity*100));
     else if(item.code!=='piece')await addStack(c,id,item.code,item.quantity);
    }
    batch={requested:count,spins,energyUsed,uridiumUsed,rewards:[...totals.values()]};
   }else if(action==='build'){
    if(g.built||g.pieces.length!==def.pieces)throw fail('Completa las piezas antes de construir');
    g.built=true;g.pieces=[];g.wave=0;g.lives=3;g.kills=[];await saveGateRow(c,id,g);
   }else if(action==='life'){
    if(!g.built||g.lives>=10)throw fail('No se pueden comprar más vidas');
    if(!allowUridium||Number(p.uridium)<25000)throw fail('Se necesitan 25.000 uridium y autorización');
    await c.query('UPDATE player_progress SET uridium=uridium-25000 WHERE account_id=$1',[id]);g.lives++;await saveGateRow(c,id,g);
   }else throw fail('Acción inválida');
   const result={...await gateView(c,id,rows),reward,batch};
   await c.query('INSERT INTO gg_v14_gate_spins(account_id,request_id,response) VALUES($1,$2,$3)',[id,requestId,JSON.stringify(result)]);return result;
  });
 }
 const gateSpin=(id,body)=>gateAction(id,body,'spin');
 const gateBuild=(id,body)=>gateAction(id,body,'build');
 const gateLife=(id,body)=>gateAction(id,body,'life');
 // Hades operations lock every participating account in a stable order.
 async function hadesTransaction(ids,fn){
  if(!Array.isArray(ids)||ids.length<4||ids.length>8||new Set(ids).size!==ids.length)throw fail('Hades requiere 4–8 pilotos');
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   const sorted=[...ids].sort();
   for(const id of sorted){if(!(await c.query('SELECT account_id FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rowCount)throw fail('Piloto no disponible');}
   const rows=await Promise.all(sorted.map(async id=>({id,g:(await gateRows(c,id)).hades})));
   if(rows.some(({g})=>!g.built||g.lives<1||g.wave>=DEFS.hades.waves))throw fail('Todos necesitan Hades construido');
   const wave=rows[0].g.wave,kills=[...rows[0].g.kills].sort();
   if(rows.some(({g})=>g.wave!==wave||JSON.stringify([...g.kills].sort())!==JSON.stringify(kills)))throw fail('El grupo necesita el mismo progreso de Hades');
   const result=await fn(c,rows,{wave,kills,lives:Math.min(...rows.map(x=>x.g.lives))});
   await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async function hadesStart(ids){
  return hadesTransaction(ids,async(c,rows,state)=>{
   for(const {id,g} of rows){g.lives=state.lives;await saveGateRow(c,id,g);}
   return state;
  });
 }
 async function hadesKill(ids,wave,key,payout,killer,dronePoints=0){
  if(typeof key!=='string'||!/^\d+:\d+$/.test(key)||!ids.includes(killer))throw fail('Enemigo inválido');
  const [group,slot]=key.split(':').map(Number),entry=WAVES.hades[wave]?.[group];
  if(!entry||slot<0||slot>=entry[1]||!payout||!['credits','xp','uridium','honor'].every(k=>Number.isSafeInteger(payout[k])&&payout[k]>=0))throw fail('Recompensa inválida');
  return hadesTransaction(ids,async(c,rows,state)=>{
   if(state.wave!==wave)throw fail('Sección inválida');
   if(state.kills.includes(key))return {duplicate:true};
   const balances={},payouts={};
   // Provisional: split the alien reward equally, with rounding remainder to the killer.
   const share=(amount,id)=>Math.floor(amount/ids.length)+(id===killer?amount%ids.length:0);const factor=await uridiumFactor(c);
   for(const {id,g} of rows){
    g.kills.push(key);await saveGateRow(c,id,g);
    const paid={credits:share(payout.credits,id),xp:share(payout.xp,id),uridium:share(payout.uridium,id)*factor,honor:share(payout.honor,id)};payouts[id]=paid;
    balances[id]=(await c.query('UPDATE player_progress SET credits=credits+$2,experience=experience+$3,uridium=uridium+$4,honor=honor+$5,level=CASE WHEN experience+$3<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$3)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1 RETURNING credits,experience,level,uridium,honor',[id,paid.credits,paid.xp,paid.uridium,paid.honor])).rows[0];
   }
   return {balances,payouts,rankChanged:await drones.award(c,killer,dronePoints)};
  });
 }
 async function hadesAdvance(ids,wave,outcome){
  if(!['clear','death'].includes(outcome))throw fail('Acción inválida');
  return hadesTransaction(ids,async(c,rows,state)=>{
   if(state.wave!==wave)throw fail('Sección inválida');
   if(outcome==='clear'&&state.kills.length!==WAVES.hades[wave].reduce((n,x)=>n+x[1],0))throw fail('Quedan enemigos');
   const complete=outcome==='clear'&&wave===2,failed=outcome==='death'&&state.lives===1;
   const lives=complete||failed?0:state.lives-(outcome==='death'?1:0),nextWave=complete||failed?0:wave+(outcome==='clear'?1:0),payouts={};
   for(const {id,g} of rows){
    if(complete){
     const [u,xp,honor,ammo,baseDisks,,,baseKeys]=REWARDS.hades;const specialFactor=await gateSpecialFactor(c),disks=baseDisks*specialFactor,keys=baseKeys*specialFactor;
     const balance=(await c.query('UPDATE player_progress SET uridium=uridium+$2,experience=experience+$3,honor=honor+$4,level=CASE WHEN experience+$3<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$3)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1 RETURNING credits,uridium,experience,level,honor',[id,u,xp,honor])).rows[0];
     for(const [code,n] of [['UCB-100',ammo],['log-disk',disks],['green-key',keys]])await addStack(c,id,code,n);
     const item=itemDraw('hades',g.completions===0,crypto.randomInt(1000)),quantity=specialGateQuantity(item,specialFactor);
     for(let i=0;i<quantity;i++)await c.query('INSERT INTO gg_v13_inventory(account_id,instance_id,code,category) VALUES($1,$2,$3,$4)',[id,crypto.randomUUID(),item,'lasers']);
     g.completions++;payouts[id]={balance,uridium:u,xp,honor,ammo,disks,xenomit:0,vouchers:0,keys,item,itemQuantity:quantity};await logGateReward(c,id,'hades',g.completions,payouts[id]);
    }
    g.wave=nextWave;g.lives=lives;if(complete||failed)g.built=false;if(outcome==='clear'||failed)g.kills=[];await saveGateRow(c,id,g);
   }
   return {wave:nextWave,lives,complete,failed,payouts,kills:outcome==='clear'||failed?[]:state.kills};
  });
 }
 async function hadesEligibility(id){
  return transaction(id,async c=>{
   const g=(await gateRows(c,id)).hades;
   if(!g.built||g.lives<1||g.wave>=DEFS.hades.waves)throw fail('Construye Hades antes de formar un grupo');
   return {wave:g.wave,lives:g.lives};
  });
 }
 async function gateCheckpoint(id,gate='alpha'){
  if(!PLAYABLE.includes(gate))throw fail('Combate de esta puerta aún en desarrollo');
  return transaction(id,async c=>{
   const g=(await gateRows(c,id))[gate];if(!g.built||g.lives<1||g.wave>=DEFS[gate].waves)throw fail('Puerta no disponible');
   return {gate,wave:g.wave,lives:g.lives,completions:g.completions,kills:g.kills};
  });
 }
 async function gateKill(id,gate,wave,key,payout,dronePoints=0){
  if(!PLAYABLE.includes(gate)||!Number.isInteger(wave)||typeof key!=='string'||!/^\d+:\d+$/.test(key))throw fail('Enemigo inválido');
  const [group,slot]=key.split(':').map(Number),entry=WAVES[gate]?.[wave]?.[group];
  if(!entry||slot<0||slot>=entry[1]||!payout||!['credits','xp','uridium','honor'].every(k=>Number.isSafeInteger(payout[k])&&payout[k]>=0))throw fail('Recompensa inválida');
  return transaction(id,async c=>{
   const g=(await gateRows(c,id))[gate];
   if(!g.built||g.wave!==wave||g.lives<1)throw fail('Progreso de puerta inválido');
   if(g.kills.includes(key))return {duplicate:true};
   g.kills.push(key);await saveGateRow(c,id,g);
   const {credits,xp,uridium,honor}=payout,paidUridium=uridium*(await uridiumFactor(c));
   const balance=(await c.query('UPDATE player_progress SET credits=credits+$2,experience=experience+$3,uridium=uridium+$4,honor=honor+$5,level=CASE WHEN experience+$3<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$3)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1 RETURNING credits,experience,level,uridium,honor',[id,credits,xp,paidUridium,honor])).rows[0];
   return {balance,payout:{credits,xp,uridium:paidUridium,honor},rankChanged:await drones.award(c,id,dronePoints)};
  });
 }
 async function gateRewardLog(id){
  const rows=(await pool.query('SELECT gate,completion,payout,created_at FROM gg_gate_reward_log WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100',[id])).rows;
  const completed=(await pool.query('SELECT gate,completions FROM gg_v14_gates WHERE account_id=$1 AND completions>0 ORDER BY gate',[id])).rows;
  return {entries:rows,completed:completed.map(g=>{const [uridium,xp,honor,ammo,disks,xenomit,vouchers,keys]=REWARDS[g.gate]||[];return {...g,baseReward:{uridium,xp,honor,ammo,disks,xenomit,vouchers,keys}};})};
 }
 async function logGateReward(c,id,gate,completion,payout){await c.query('INSERT INTO gg_gate_reward_log(account_id,gate,completion,payout) VALUES($1,$2,$3,$4)',[id,gate,completion,JSON.stringify(payout)]);}
 async function gateAdvance(id,expectedWave,outcome,gate='alpha'){
  if(!PLAYABLE.includes(gate)||!Number.isInteger(expectedWave)||expectedWave<0||expectedWave>=DEFS[gate].waves||!['clear','death'].includes(outcome))throw fail('Progreso inválido');
  return transaction(id,async c=>{
   const rows=await gateRows(c,id),g=rows[gate];
   if(!g.built||g.wave!==expectedWave||g.lives<1)throw fail('La puerta cambió; vuelve a entrar');
   if(outcome==='clear'&&g.kills.length!==WAVES[gate][g.wave].reduce((sum,group)=>sum+group[1],0))throw fail('Todavía quedan enemigos pendientes');
   const complete=outcome==='clear'&&g.wave+1===DEFS[gate].waves,failed=outcome==='death'&&g.lives===1;
   let payout=null;
   if(complete){
    const [uridium,xp,honor,ammo,baseDisks,xenomit,vouchers,baseKeys]=REWARDS[gate];const specialFactor=await gateSpecialFactor(c),disks=baseDisks*specialFactor,keys=baseKeys*specialFactor;
    const balance=(await c.query('UPDATE player_progress SET uridium=uridium+$2,experience=experience+$3,honor=honor+$4,level=CASE WHEN experience+$3<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$3)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1 RETURNING credits,uridium,experience,level,honor',[id,uridium,xp,honor])).rows[0];
    for(const [code,n] of [['UCB-100',ammo],['log-disk',disks],['xenomit',xenomit],['repair-voucher',vouchers],['green-key',keys]])await addStack(c,id,code,n);
    if(gate==='kronos'){await addStack(c,id,'UBR-100',500);await addStack(c,id,'RSB-75',5000);await addStack(c,id,'gate-energy',250);}
    const k=rows.kronos;if(!k.built&&KRONOS[gate]){const offset=Object.keys(KRONOS).slice(0,Object.keys(KRONOS).indexOf(gate)).reduce((sum,key)=>sum+KRONOS[key],0);for(let n=offset+1;n<=offset+KRONOS[gate];n++){if(!k.pieces.includes(n)){k.pieces.push(n);await saveGateRow(c,id,k);break;}}}
    // Draw once; only whitelisted special rewards are multiplied by the independent event.
    const item=itemDraw(gate,g.completions===0,crypto.randomInt(1000));
    const itemQuantity=specialGateQuantity(item,specialFactor);
    if(item==='MUL-B03'){
     await extendBooster(c,id,item,18000*itemQuantity);
    }else if(item){
     const category=item==='LF-4'?'lasers':item==='SG3N-B03'?'shields':['Havoc','Hercules','Spartan'].includes(item)?'drone-designs':'ship-designs';
     for(let i=0;i<itemQuantity;i++)await c.query('INSERT INTO gg_v13_inventory(account_id,instance_id,code,category) VALUES($1,$2,$3,$4)',[id,crypto.randomUUID(),item,category]);
    }
    g.completions++;payout={uridium,xp,honor,ammo,disks,xenomit,vouchers,keys,balance,item,itemQuantity,...(gate==='kronos'?{extras:{'UBR-100':500,'RSB-75':5000,'gate-energy':250}}:{})};await logGateReward(c,id,gate,g.completions,payout);
   }
   if(complete||failed){g.built=false;g.wave=0;g.lives=0;g.kills=[];}
   else if(outcome==='clear'){g.wave++;g.kills=[];}
   else g.lives--;
   await saveGateRow(c,id,g);return {gate,wave:g.wave,lives:g.lives,complete,failed,completions:g.completions,payout};
  });
 }
 return {ready,purchase,snapshot,equip,activateConfig,combatLoadout,useCpu,consumeAmmo,petInterval,petKamikaze,location,chooseCompany,pvpReward,saveLocation,awardBox,gateStatus,gateSpin,gateBuild,gateLife,hadesEligibility,hadesStart,hadesKill,hadesAdvance,gateCheckpoint,gateKill,gateAdvance,gateRewardLog};
}
module.exports={createInventory};
