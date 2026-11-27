'use strict';
const crypto=require('node:crypto');
const {bonusLoot}=require('./loot-v14');
const {DEFS,GATES,SHARED,KRONOS,REWARDS,PLAYABLE,PROVISIONAL,WAVES,spinGate,itemDraw}=require('./gates-v14');
const {quote,configurations}=require('./equipment-v13');
const catalog=require('./data/catalog-v13.json');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function createInventory(pool){
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
   CREATE TABLE IF NOT EXISTS gg_v13_hangar (
   account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
   ship text NOT NULL DEFAULT 'phoenix', configs jsonb NOT NULL DEFAULT '[[],[]]',
   active integer NOT NULL DEFAULT 0 CHECK(active IN (0,1)));
   CREATE TABLE IF NOT EXISTS gg_v13_purchases (
   account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
   request_id uuid NOT NULL, response jsonb NOT NULL,
   PRIMARY KEY(account_id,request_id));
   CREATE TABLE IF NOT EXISTS gg_v14_gates (
   account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
   gate text NOT NULL, pieces jsonb NOT NULL DEFAULT '[]',
   multiplier integer NOT NULL DEFAULT 1 CHECK(multiplier BETWEEN 1 AND 6),
   built boolean NOT NULL DEFAULT false, wave integer NOT NULL DEFAULT 0 CHECK(wave BETWEEN 0 AND 30),
   lives integer NOT NULL DEFAULT 0 CHECK(lives BETWEEN 0 AND 10),
   completions integer NOT NULL DEFAULT 0 CHECK(completions>=0),
   PRIMARY KEY(account_id,gate));
   ALTER TABLE gg_v14_gates ADD COLUMN IF NOT EXISTS kills jsonb NOT NULL DEFAULT '[]';
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
    if(code!=='G-AL1'||quantity!==1)throw fail('Engranaje inválido');
    const rows=(await c.query("SELECT category,code FROM gg_v13_inventory WHERE account_id=$1 AND category IN ('pet','petGear')",[id])).rows;
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
   if(category==='ships'&&(code==='phoenix'||(await c.query('SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND code=$2 AND category=$3',[id,code,category])).rowCount))throw fail('Nave ya disponible');
   if(Number(p[q.currency])<q.total)throw fail('Saldo insuficiente',409);
   const column=q.currency==='credits'?'credits':'uridium';
   const balance=(await c.query('UPDATE player_progress SET '+column+'='+column+'-$2 WHERE account_id=$1 RETURNING credits,uridium',[id,q.total])).rows[0];
   if(category==='ammo'||category==='fuel'){
    await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,code,q.quantity]);
   }else{
    for(let i=0;i<q.quantity;i++)await c.query('INSERT INTO gg_v13_inventory(account_id,instance_id,code,category) VALUES($1,$2,$3,$4)',[id,crypto.randomUUID(),code,category]);
   }
   const result={ok:true,...q,balance};
   await c.query('INSERT INTO gg_v13_purchases(account_id,request_id,response) VALUES($1,$2,$3)',[id,requestId,JSON.stringify(result)]);
   return result;
  });
 }
 async function snapshot(id){
  return transaction(id,async(c,p)=>{
   // Reading inventory must not activate an empty combat loadout.
   const hangar=(await c.query('SELECT ship,configs,active FROM gg_v13_hangar WHERE account_id=$1',[id])).rows[0]||{ship:'phoenix',configs:[[],[]],active:0};
   const items=(await c.query('SELECT instance_id AS "instanceId",code,category,level FROM gg_v13_inventory WHERE account_id=$1 ORDER BY category,code,instance_id',[id])).rows;
   const ammo=(await c.query('SELECT code,quantity FROM gg_v13_ammo WHERE account_id=$1',[id])).rows;
   return {balance:p,hangar,items,ammo};
  });
 }
 async function equip(id,{ship,configs,active}){
  if(!catalog.ships.some(s=>s.id===ship)||![0,1].includes(active))throw fail('Nave o configuración inválida');
  return transaction(id,async c=>{
   const rows=(await c.query('SELECT instance_id AS "instanceId",code,category,level FROM gg_v13_inventory WHERE account_id=$1',[id])).rows;
   if(ship!=='phoenix'&&!rows.some(x=>x.category==='ships'&&x.code===ship))throw fail('Nave no adquirida');
   const owned=new Map(rows.filter(x=>['lasers','engines','shields','drones'].includes(x.category)).map(x=>[x.instanceId,x]));
   const computed=configurations(ship,configs,owned);
   await c.query('INSERT INTO gg_v13_hangar(account_id,ship,configs,active) VALUES($1,$2,$3,$4) ON CONFLICT(account_id) DO UPDATE SET ship=EXCLUDED.ship,configs=EXCLUDED.configs,active=EXCLUDED.active',[id,ship,JSON.stringify(configs),active]);
   return {ok:true,stats:computed[active]};
  });
 }
 async function combatLoadout(id){
  return transaction(id,async c=>{
   const h=(await c.query('SELECT ship,configs,active FROM gg_v13_hangar WHERE account_id=$1',[id])).rows[0];
   if(!h)return null;
   const items=(await c.query('SELECT instance_id AS "instanceId",code,category,level FROM gg_v13_inventory WHERE account_id=$1',[id])).rows;
   const stats=configurations(h.ship,h.configs,new Map(items.map(i=>[i.instanceId,i])));
   return {ship:h.ship,active:h.active,...stats[h.active]};
  });
 }
 async function consumeAmmo(id,code,count){
  if(!catalog.ammo.some(a=>a.id===code)||!Number.isSafeInteger(count)||count<1||count>100)throw fail('Munición inválida');
  return transaction(id,async c=>{
   const row=(await c.query('UPDATE gg_v13_ammo SET quantity=quantity-$3 WHERE account_id=$1 AND code=$2 AND quantity>=$3 RETURNING quantity',[id,code,count])).rows[0];
   return row?Number(row.quantity):null;
  });
 }
 // El combustible se cobra antes de activar cada intervalo de vuelo.
 async function petInterval(id,mode){
  if(!['passive','loot'].includes(mode))throw fail('Modo inválido');
  return transaction(id,async c=>{
   const owned=(await c.query("SELECT category,code FROM gg_v13_inventory WHERE account_id=$1 AND category IN ('pet','petGear')",[id])).rows;
   if(!owned.some(x=>x.category==='pet'))throw fail('Necesitas un P.E.T.');
   if(mode==='loot'&&!owned.some(x=>x.code==='G-AL1'))throw fail('Necesitas el engranaje G-AL1');
   const cost=10;
   const r=(await c.query("UPDATE gg_v13_ammo SET quantity=quantity-$2 WHERE account_id=$1 AND code='pet-fuel' AND quantity>=$2 RETURNING quantity",[id,cost])).rows[0];
   if(!r)throw fail('Combustible insuficiente');
   return {fuel:Number(r.quantity)};
  });
 }
 async function awardBox(id){
  const loot=bonusLoot(crypto.randomInt(100),crypto.randomInt(1000000)/1000000);
  return transaction(id,async(c,p)=>{
   let balance=p;
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
   const rows=await gateRows(c,id),g=rows[gate],def=DEFS[gate];let reward=null;
   if(action==='spin'){
    if(gate==='kronos')throw fail('Kronos se construye completando otras puertas');
    const pool=SHARED.includes(gate)?SHARED:[gate];
    if(!pool.some(k=>(!SHARED.includes(gate)||!rows[k].built)&&rows[k].pieces.length<DEFS[k].pieces))throw fail('No hay puertas disponibles para recibir piezas');
    const next=spinGate(rows,gate,crypto.randomInt(100),n=>crypto.randomInt(n),useMultiplier);
    const energy=(await c.query("UPDATE gg_v13_ammo SET quantity=quantity-1 WHERE account_id=$1 AND code='gate-energy' AND quantity>=1 RETURNING quantity",[id])).rows[0];
    if(!energy){
     if(!allowUridium||Number(p.uridium)<100)throw fail('Autoriza el gasto de 100 uridium o consigue energía');
     await c.query('UPDATE player_progress SET uridium=uridium-100 WHERE account_id=$1',[id]);
    }
    if(next.target)rows[next.target].pieces=next.pieces;
    for(const k of pool){rows[k].multiplier=next.multiplier;await saveGateRow(c,id,rows[k]);}
    reward=next.reward;
    if(reward.code==='nanohull-percent')await addStack(c,id,'nanohull-basis-points',250);
    else if(reward.code!=='piece')await addStack(c,id,reward.code,reward.quantity);
   }else if(action==='build'){
    if(g.built||g.pieces.length!==def.pieces)throw fail('Completa las piezas antes de construir');
    g.built=true;g.pieces=[];g.wave=0;g.lives=3;g.kills=[];await saveGateRow(c,id,g);
   }else if(action==='life'){
    if(!g.built||g.lives>=10)throw fail('No se pueden comprar más vidas');
    if(!allowUridium||Number(p.uridium)<25000)throw fail('Se necesitan 25.000 uridium y autorización');
    await c.query('UPDATE player_progress SET uridium=uridium-25000 WHERE account_id=$1',[id]);g.lives++;await saveGateRow(c,id,g);
   }else throw fail('Acción inválida');
   const result={...await gateView(c,id,rows),reward};
   await c.query('INSERT INTO gg_v14_gate_spins(account_id,request_id,response) VALUES($1,$2,$3)',[id,requestId,JSON.stringify(result)]);return result;
  });
 }
 const gateSpin=(id,body)=>gateAction(id,body,'spin');
 const gateBuild=(id,body)=>gateAction(id,body,'build');
 const gateLife=(id,body)=>gateAction(id,body,'life');
 async function gateCheckpoint(id,gate='alpha'){
  if(!PLAYABLE.includes(gate))throw fail('Combate de esta puerta aún en desarrollo');
  return transaction(id,async c=>{
   const g=(await gateRows(c,id))[gate];if(!g.built||g.lives<1||g.wave>=DEFS[gate].waves)throw fail('Puerta no disponible');
   return {gate,wave:g.wave,lives:g.lives,completions:g.completions,kills:g.kills};
  });
 }
 async function gateKill(id,gate,wave,key,payout){
  if(!PLAYABLE.includes(gate)||!Number.isInteger(wave)||typeof key!=='string'||!/^\d+:\d+$/.test(key))throw fail('Enemigo inválido');
  const [group,slot]=key.split(':').map(Number),entry=WAVES[gate]?.[wave]?.[group];
  if(!entry||slot<0||slot>=entry[1]||!payout||!['credits','xp','uridium','honor'].every(k=>Number.isSafeInteger(payout[k])&&payout[k]>=0))throw fail('Recompensa inválida');
  return transaction(id,async c=>{
   const g=(await gateRows(c,id))[gate];
   if(!g.built||g.wave!==wave||g.lives<1)throw fail('Progreso de puerta inválido');
   if(g.kills.includes(key))return {duplicate:true};
   g.kills.push(key);await saveGateRow(c,id,g);
   const {credits,xp,uridium,honor}=payout;
   const balance=(await c.query('UPDATE player_progress SET credits=credits+$2,experience=experience+$3,uridium=uridium+$4,honor=honor+$5,level=CASE WHEN experience+$3<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$3)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1 RETURNING credits,experience,level,uridium,honor',[id,credits,xp,uridium,honor])).rows[0];
   return {balance};
  });
 }
 async function gateAdvance(id,expectedWave,outcome,gate='alpha'){
  if(!PLAYABLE.includes(gate)||!Number.isInteger(expectedWave)||expectedWave<0||expectedWave>=DEFS[gate].waves||!['clear','death'].includes(outcome))throw fail('Progreso inválido');
  return transaction(id,async c=>{
   const rows=await gateRows(c,id),g=rows[gate];
   if(!g.built||g.wave!==expectedWave||g.lives<1)throw fail('La puerta cambió; vuelve a entrar');
   if(outcome==='clear'&&g.kills.length!==WAVES[gate][g.wave].reduce((sum,group)=>sum+group[1],0))throw fail('Todavía quedan enemigos pendientes');
   const complete=outcome==='clear'&&g.wave+1===DEFS[gate].waves,failed=outcome==='death'&&g.lives===1;
   let payout=null;
   if(complete){
    const [uridium,xp,honor,ammo,disks,xenomit,vouchers,keys]=REWARDS[gate];
    const balance=(await c.query('UPDATE player_progress SET uridium=uridium+$2,experience=experience+$3,honor=honor+$4,level=CASE WHEN experience+$3<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$3)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1 RETURNING credits,uridium,experience,level,honor',[id,uridium,xp,honor])).rows[0];
    for(const [code,n] of [['UCB-100',ammo],['log-disk',disks],['xenomit',xenomit],['repair-voucher',vouchers],['green-key',keys]])await addStack(c,id,code,n);
    if(gate==='kronos'){await addStack(c,id,'UBR-100',500);await addStack(c,id,'RSB-75',5000);await addStack(c,id,'gate-energy',250);}
    const k=rows.kronos;if(!k.built&&KRONOS[gate]){const offset=Object.keys(KRONOS).slice(0,Object.keys(KRONOS).indexOf(gate)).reduce((sum,key)=>sum+KRONOS[key],0);for(let n=offset+1;n<=offset+KRONOS[gate];n++){if(!k.pieces.includes(n)){k.pieces.push(n);await saveGateRow(c,id,k);break;}}}
    // Draw once per completed gate; Sunday doubles the item, never the base payout.
    const item=itemDraw(gate,g.completions===0,crypto.randomInt(1000));
    const day=new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'UTC'}).format(new Date());
    const itemQuantity=item?(day==='Sun'?2:1):0;
    if(item==='MUL-B03'){
     // Booster activation needs a running-time subsystem; retain award as a redeemable entitlement.
     await addStack(c,id,item,itemQuantity);
    }else if(item){
     const category=item==='LF-4'?'lasers':item==='SG3N-B03'?'shields':['Havoc','Hercules','Spartan'].includes(item)?'drone-designs':'ship-designs';
     for(let i=0;i<itemQuantity;i++)await c.query('INSERT INTO gg_v13_inventory(account_id,instance_id,code,category) VALUES($1,$2,$3,$4)',[id,crypto.randomUUID(),item,category]);
    }
    g.completions++;payout={uridium,xp,honor,ammo,disks,xenomit,vouchers,keys,balance,item,itemQuantity};
   }
   if(complete||failed){g.built=false;g.wave=0;g.lives=0;g.kills=[];}
   else if(outcome==='clear'){g.wave++;g.kills=[];}
   else g.lives--;
   await saveGateRow(c,id,g);return {gate,wave:g.wave,lives:g.lives,complete,failed,completions:g.completions,payout};
  });
 }
 return {ready,purchase,snapshot,equip,combatLoadout,consumeAmmo,petInterval,awardBox,gateStatus,gateSpin,gateBuild,gateLife,gateCheckpoint,gateKill,gateAdvance};
}
module.exports={createInventory};
