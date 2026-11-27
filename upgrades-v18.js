'use strict';
// Wiki multipliers. One mineral = ten rounds; generator rounds use a
// provisional ten-second interval of active use, not real-time expiry.
const catalog=require('./data/catalog-v13.json');
const BONUS={prometid:{laser:1.1,rocket:1.1},duranium:{speed:1.1,shield:1.1},promerium:{laser:1.3,rocket:1.3,speed:1.2,shield:1.2},seprom:{laser:1.6,rocket:1.6,shield:1.4}};
const SLOTS=['laser','rocket','speed','shield'];
function factor(upgrades,slot){const u=upgrades?.[slot];return u&&u.rounds>0?BONUS[u.code]?.[slot]||1:1;}
function load(upgrades,slot,code,quantity){if(!SLOTS.includes(slot)||!BONUS[code]?.[slot]||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)throw Error('Carga de mineral inválida');const old=upgrades[slot];if(old?.rounds>0&&old.code!==code)throw Error('Agota primero el mineral activo de esta ranura');return {...upgrades,[slot]:{code,rounds:(old?.rounds||0)+quantity*10}};}
function consume(upgrades,slots){const next={...upgrades},factors={};for(const slot of new Set(slots)){factors[slot]=factor(upgrades,slot);if(next[slot]?.rounds>0)next[slot]={...next[slot],rounds:next[slot].rounds-1};}return {next,factors};}
function createUpgrades(pool){
 const fail=message=>Object.assign(Error(message),{status:400});
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_v18_mineral_upgrades(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,data jsonb NOT NULL DEFAULT '{}');
 CREATE TABLE IF NOT EXISTS gg_v18_upgrade_requests(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_id uuid NOT NULL,response jsonb NOT NULL,PRIMARY KEY(account_id,request_id));`);}
 async function read(c,id){return (await c.query('SELECT data FROM gg_v18_mineral_upgrades WHERE account_id=$1',[id])).rows[0]?.data||{};}
 async function save(c,id,data){await c.query('INSERT INTO gg_v18_mineral_upgrades(account_id,data) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET data=EXCLUDED.data',[id,JSON.stringify(data)]);}
 async function tx(id,fn){const c=await pool.connect();try{await c.query('BEGIN');const p=(await c.query('SELECT account_id FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];if(!p)throw fail('Piloto no disponible');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async function status(id){return tx(id,async c=>({upgrades:await read(c,id),bonus:BONUS,slots:SLOTS}));}
 async function charge(id,d){if(!d||typeof d.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.requestId))throw fail('Solicitud inválida');
 return tx(id,async c=>{const prev=(await c.query('SELECT response FROM gg_v18_upgrade_requests WHERE account_id=$1 AND request_id=$2',[id,d.requestId])).rows[0];if(prev)return prev.response;
 let next;try{next=load(await read(c,id),d.slot,d.code,d.quantity);}catch(e){throw fail(e.message);}
 const taken=await c.query('UPDATE gg_v13_ammo SET quantity=quantity-$3 WHERE account_id=$1 AND code=$2 AND quantity>=$3 RETURNING quantity',[id,d.code,d.quantity]);if(!taken.rowCount)throw fail('Mineral insuficiente');await save(c,id,next);const result={upgrades:next,bonus:BONUS,slots:SLOTS};await c.query('INSERT INTO gg_v18_upgrade_requests(account_id,request_id,response) VALUES($1,$2,$3)',[id,d.requestId,JSON.stringify(result)]);return result;});}
 // Atomically reserve ammunition and one mineral-enhanced salvo.
 async function shot(id,code,count,slot='laser'){if(!['laser','rocket'].includes(slot)||!Number.isSafeInteger(count)||count<1||count>100||!(slot==='rocket'?count===1&&catalog.rockets.some(r=>r.id===code):catalog.ammo.some(a=>a.id===code)))throw fail('Munición inválida');return tx(id,async c=>{const r=(await c.query('UPDATE gg_v13_ammo SET quantity=quantity-$3 WHERE account_id=$1 AND code=$2 AND quantity>=$3 RETURNING quantity',[id,code,count])).rows[0];if(!r)return null;
 const upgrades=await read(c,id),{next,factors}=consume(upgrades,[slot]);if(upgrades[slot]?.rounds>0)await save(c,id,next);
 return {stock:Number(r.quantity),factor:factors[slot],upgrades:next};});}
 async function ordnance(id,code,count){const item=[...catalog.specialRockets,...catalog.launcherAmmo,...catalog.mines].find(x=>x.id===code);if(!item||!Number.isSafeInteger(count)||count<1||count>5||(catalog.specialRockets.includes(item)||catalog.mines.includes(item))&&count!==1)throw fail('Munición inválida');return tx(id,async c=>{const r=(await c.query('UPDATE gg_v13_ammo SET quantity=quantity-$3 WHERE account_id=$1 AND code=$2 AND quantity>=$3 RETURNING quantity',[id,code,count])).rows[0];return r?Number(r.quantity):null;});}
 async function generatorRound(id,slots){return tx(id,async c=>{const upgrades=await read(c,id),{next,factors}=consume(upgrades,slots.filter(k=>k==='speed'||k==='shield'));if(slots.some(k=>upgrades[k]?.rounds>0))await save(c,id,next);return {upgrades:next,factors};});}
 return {ready,status,charge,shot,ordnance,generatorRound};
}
module.exports={BONUS,SLOTS,factor,load,consume,createUpgrades};