'use strict';
const crypto=require('node:crypto');
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
 return {ready,purchase,snapshot,equip,combatLoadout,consumeAmmo,petInterval};
}
module.exports={createInventory};
