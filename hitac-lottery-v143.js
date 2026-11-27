'use strict';
const crypto=require('node:crypto');
const UNLIMITED=Object.freeze([
 {id:'mcb50',code:'MCB-50',quantity:500},{id:'sab50',code:'SAB-50',quantity:300},{id:'r310',code:'R-310',quantity:150},{id:'acm01',code:'ACM-01',quantity:25},{id:'energy',code:'gate-energy',quantity:1000},{id:'key',code:'green-key',quantity:1}
]);
const LIMITED=Object.freeze([
 {id:'logs',code:'log-disk',quantity:200,stock:20},{id:'seprom',code:'seprom',quantity:1000,stock:10},{id:'lf4',code:'LF-4',quantity:1,stock:5,level:1},{id:'lf4-16',code:'LF-4',quantity:1,stock:8,level:16},{id:'zeus',code:'ZEUS-piece',quantity:1,stock:5},{id:'apis',code:'APIS-piece',quantity:1,stock:5},{id:'lf4-2',code:'LF-4',quantity:2,stock:2,level:1},{id:'lf4-3',code:'LF-4',quantity:3,stock:1,level:1},{id:'premium',code:'premium',quantity:604800,stock:1,entitlement:true}
]);
const CATALOG=[...UNLIMITED,...LIMITED],fail=(message,status=400)=>Object.assign(Error(message),{status}),uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function available(stock){return CATALOG.filter(p=>p.stock===undefined||Number(stock[p.id])>0);}
function choose(stock,index){const choices=available(stock);if(!Number.isInteger(index)||index<0||index>=choices.length)throw fail('Tirada inválida');return choices[index];}
function createLottery(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_hitac_bags(id uuid PRIMARY KEY,open boolean NOT NULL,stock jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
 CREATE UNIQUE INDEX IF NOT EXISTS gg_hitac_one_open ON gg_hitac_bags(open) WHERE open;
 CREATE TABLE IF NOT EXISTS gg_hitac_draws(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_id uuid NOT NULL,bag_id uuid NOT NULL REFERENCES gg_hitac_bags(id),result jsonb NOT NULL,PRIMARY KEY(account_id,request_id));
 CREATE TABLE IF NOT EXISTS gg_hitac_capsule_grants(unit_id text PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,bag_id uuid NOT NULL REFERENCES gg_hitac_bags(id),created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS gg_hitac_premium(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,seconds bigint NOT NULL CHECK(seconds>=0));`);}
 async function tx(fn){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(71413007)');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async function open(){return tx(async c=>{if((await c.query('SELECT 1 FROM gg_hitac_bags WHERE open')).rowCount)throw fail('Bolsa ya abierta',409);const id=crypto.randomUUID(),stock=Object.fromEntries(LIMITED.map(p=>[p.id,p.stock]));await c.query('INSERT INTO gg_hitac_bags(id,open,stock) VALUES($1,true,$2)',[id,JSON.stringify(stock)]);return {id,stock};});}
 async function close(){return tx(async c=>({closed:(await c.query('UPDATE gg_hitac_bags SET open=false WHERE open')).rowCount>0}));}
 async function status(id){const bag=(await pool.query('SELECT id,stock FROM gg_hitac_bags WHERE open')).rows[0]||null;const capsules=Number((await pool.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='hitac-capsule'",[id])).rows[0]?.quantity||0);return {bag,capsules,unlimited:UNLIMITED,limited:LIMITED,enabled:process.env.GG_HITAC_ENABLED==='1'&&process.env.GG_HITAC_LOTTERY_ENABLED==='1',provisionalOdds:true};}
 async function grant(id,unitId){if(!uuid(id)||typeof unitId!=='string'||!uuid(unitId.split(':')[0])||!/^([0-6])$/.test(unitId.split(':')[1]||'')||unitId.split(':').length!==2)throw fail('Unidad inválida');return tx(async c=>{
 const prior=(await c.query('SELECT account_id FROM gg_hitac_capsule_grants WHERE unit_id=$1',[unitId])).rows[0];if(prior){if(prior.account_id!==id)throw fail('Cápsula ya acreditada',409);return {granted:true,duplicate:true};}
 const bag=(await c.query('SELECT id FROM gg_hitac_bags WHERE open FOR UPDATE')).rows[0];if(!bag)return {granted:false};
 if(!(await c.query('SELECT 1 FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rowCount)throw fail('Piloto no disponible');
 await c.query('INSERT INTO gg_hitac_capsule_grants(unit_id,account_id,bag_id) VALUES($1,$2,$3)',[unitId,id,bag.id]);
 await c.query("INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,'hitac-capsule',1) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+1",[id]);return {granted:true,duplicate:false};
 });}
 // Server-only lottery engine. No purchased tokens, currency, or client-selected prize.
 async function draw(id,requestId){if(!uuid(id)||!uuid(requestId))throw fail('Solicitud inválida');return tx(async c=>{
 const prior=(await c.query('SELECT result FROM gg_hitac_draws WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];if(prior)return prior.result;
 const bag=(await c.query('SELECT id,stock FROM gg_hitac_bags WHERE open FOR UPDATE')).rows[0];if(!bag)throw fail('Bolsa cerrada');
 if(!(await c.query('SELECT 1 FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rowCount)throw fail('Piloto no disponible');
 if(!(await c.query("UPDATE gg_v13_ammo SET quantity=quantity-1 WHERE account_id=$1 AND code='hitac-capsule' AND quantity>=1",[id])).rowCount)throw fail('Sin cápsulas');
 const p=choose(bag.stock,crypto.randomInt(available(bag.stock).length));
 if(p.stock!==undefined){bag.stock[p.id]--;await c.query('UPDATE gg_hitac_bags SET stock=$2 WHERE id=$1',[bag.id,JSON.stringify(bag.stock)]);}
 if(p.level){for(let i=0;i<p.quantity;i++)await c.query("INSERT INTO gg_v13_inventory(account_id,instance_id,code,category,level) VALUES($1,$2,$3,'lasers',$4)",[id,crypto.randomUUID(),p.code,p.level]);}
 else if(p.entitlement){await c.query('INSERT INTO gg_hitac_premium(account_id,seconds) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET seconds=gg_hitac_premium.seconds+EXCLUDED.seconds',[id,p.quantity]);}
 else await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,p.code,p.quantity]);
 const result={bagId:bag.id,prize:{id:p.id,code:p.code,quantity:p.quantity,level:p.level||null,premiumPending:!!p.entitlement}};
 await c.query('INSERT INTO gg_hitac_draws(account_id,request_id,bag_id,result) VALUES($1,$2,$3,$4)',[id,requestId,bag.id,JSON.stringify(result)]);return result;
 });}
 return {ready,open,close,status,draw,grant};
}
module.exports={UNLIMITED,LIMITED,available,choose,createLottery};
