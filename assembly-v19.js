'use strict';
const TECH={
 'backup-shields':{name:'Escudos de reserva',price:1000,currency:'uridium',duration:0,cooldown:120000},
 'battle-repair':{name:'Robot de reparación de combate',price:1500,currency:'uridium',duration:10000,cooldown:120000},
 'energy-leech':{name:'Sanguijuela de energía',price:2500,currency:'uridium',duration:1800000,cooldown:300000},
 'precision-targeter':{name:'Apuntador de precisión',price:20000,currency:'credits',duration:900000,cooldown:120000}
};
const fail=message=>Object.assign(Error(message),{status:400});
const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function craftQuote(code,quantity){if(!Object.hasOwn(TECH,code)||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000)throw fail('Receta o cantidad inválida');return {...TECH[code],code,quantity,total:TECH[code].price*quantity};}
function activateState(state,code,now){const t=TECH[code];if(!Object.hasOwn(TECH,code))throw fail('Tecnología inválida');if((state[code]?.readyAt||0)>now)throw fail('Tecnología en recarga');if((state[code]?.until||0)>now)throw fail('Tecnología ya activa');return {...state,[code]:{until:now+t.duration,readyAt:now+t.cooldown}};}
function isActive(state,code,now){return (state?.[code]?.until||0)>now;}
function leechAmount(before,after){return Math.max(0,(before.hp+before.shield-after.hp-after.shield)*.1);}
function createAssembly(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_v19_technology(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,data jsonb NOT NULL DEFAULT '{}');CREATE TABLE IF NOT EXISTS gg_v19_assembly_requests(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_id uuid NOT NULL,response jsonb NOT NULL,PRIMARY KEY(account_id,request_id));`);}
 async function tx(id,fn){const c=await pool.connect();try{await c.query('BEGIN');const p=(await c.query('SELECT credits,uridium FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];if(!p)throw fail('Piloto no disponible');const result=await fn(c,p);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async function read(c,id){return (await c.query('SELECT data FROM gg_v19_technology WHERE account_id=$1',[id])).rows[0]?.data||{};}
 async function status(id){return tx(id,async(c,p)=>{const rows=(await c.query('SELECT code,quantity FROM gg_v13_ammo WHERE account_id=$1',[id])).rows;return {recipes:TECH,stock:Object.fromEntries(rows.filter(r=>Object.hasOwn(TECH,r.code)).map(r=>[r.code,Number(r.quantity)])),active:await read(c,id),balance:p};});}
 async function craft(id,d){const q=craftQuote(d?.code,d?.quantity);if(!validId(d.requestId))throw fail('Solicitud inválida');return tx(id,async(c,p)=>{
 const old=(await c.query('SELECT response FROM gg_v19_assembly_requests WHERE account_id=$1 AND request_id=$2',[id,d.requestId])).rows[0];if(old)return old.response;
 const balance=(await c.query('UPDATE player_progress SET '+q.currency+'='+q.currency+'-$2 WHERE account_id=$1 AND '+q.currency+'>=$2 RETURNING credits,uridium',[id,q.total])).rows[0];if(!balance)throw fail('Saldo insuficiente');
 const row=(await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity RETURNING quantity',[id,q.code,q.quantity])).rows[0];const result={code:q.code,stock:Number(row.quantity),balance};await c.query('INSERT INTO gg_v19_assembly_requests(account_id,request_id,response) VALUES($1,$2,$3)',[id,d.requestId,JSON.stringify(result)]);return result;});}
 async function activate(id,code){return tx(id,async c=>{const next=activateState(await read(c,id),code,Date.now());const row=(await c.query('UPDATE gg_v13_ammo SET quantity=quantity-1 WHERE account_id=$1 AND code=$2 AND quantity>=1 RETURNING quantity',[id,code])).rows[0];if(!row)throw fail('Ensamblaje insuficiente');await c.query('INSERT INTO gg_v19_technology(account_id,data) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET data=EXCLUDED.data',[id,JSON.stringify(next)]);return {active:next,stock:Number(row.quantity)};});}
 return {ready,status,craft,activate};
}
module.exports={TECH,craftQuote,activateState,isActive,leechAmount,createAssembly};
