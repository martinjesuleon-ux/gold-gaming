'use strict';
// Bank redemption foundation. All rewards and eligibility are server-owned.
const crypto=require('node:crypto');
const catalog=require('./data/catalog-v13.json');
const fail=(msg,status=400)=>Object.assign(Error(msg),{status});
const rule=(ok,msg)=>{if(!ok)throw fail(msg);};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v,max=1000000000)=>Number.isSafeInteger(v)&&v>0&&v<=max;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const stackCodes=new Set([...['ammo','rockets','specialRockets','launcherAmmo','mines','consumables'].flatMap(k=>catalog[k].map(x=>x.id)),'gate-energy','jump-voucher','repair-voucher']);
const itemCategories=['lasers','shields','engines','launchers','cpus','robots'];
function normalizeCode(v){rule(typeof v==='string'&&/^[A-Z0-9][A-Z0-9_-]{3,63}$/.test(v.trim().toUpperCase()),'Código inválido');return v.trim().toUpperCase();}
function normalizeReward(v){
 rule(record(v)&&Object.keys(v).every(k=>['credits','uridium','xp','honor','premiumDays','stacks','items'].includes(k)),'Premio inválido');
 const out={};
 for(const k of ['credits','uridium','xp','honor','premiumDays'])if(Object.hasOwn(v,k)){rule(integer(v[k],k==='premiumDays'?365:1000000000),'Cantidad inválida');out[k]=v[k];}
 if(Object.hasOwn(v,'stacks')){rule(record(v.stacks)&&Object.keys(v.stacks).length<=50,'Munición inválida');out.stacks={};for(const [code,n] of Object.entries(v.stacks)){rule(stackCodes.has(code)&&integer(n),'Munición inválida');out.stacks[code]=n;}}
 if(Object.hasOwn(v,'items')){rule(Array.isArray(v.items)&&v.items.length<=20,'Objetos inválidos');out.items=v.items.map(i=>{rule(record(i)&&itemCategories.includes(i.category)&&catalog[i.category].some(x=>x.id===i.code)&&integer(i.quantity,100),'Objeto inválido');return {category:i.category,code:i.code,quantity:i.quantity};});rule(out.items.reduce((n,i)=>n+i.quantity,0)<=1000,'Demasiados objetos');}
 rule(Object.keys(out).some(k=>k==='stacks'?Object.keys(out.stacks).length:k==='items'?out.items.length:out[k]),'Premio vacío');
 return out;
}
function eligibility(row,previous){
 if(!row||!row.enabled)throw fail('Código no disponible',404);
 if(row.expired)throw fail('Código caducado',409);
 if(row.max_uses!==null&&BigInt(row.used)>=BigInt(row.max_uses))throw fail('Código agotado',409);
 if(row.once_per_account&&previous)throw fail('Código ya canjeado',409);
}
function normalizeCreate(body,now=Date.now()){
 rule(record(body),'Configuración inválida');
 const code=normalizeCode(body.code),reward=normalizeReward(body.reward);
 const maxUses=body.maxUses??null;rule(maxUses===null||integer(maxUses,1000000),'Límite inválido');
 const once=body.oncePerAccount??true;rule(typeof once==='boolean','Restricción inválida');
 let expiresAt=body.expiresAt??null;
 if(expiresAt!==null){rule(typeof expiresAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expiresAt),'Fecha inválida');const t=Date.parse(expiresAt);rule(Number.isFinite(t)&&t>now&&new Date(t).toISOString()===expiresAt,'Fecha inválida');}
 return {code,reward,maxUses,oncePerAccount:once,expiresAt};
}
function createBank(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_bank_codes_v222(code text PRIMARY KEY,reward jsonb NOT NULL,enabled boolean NOT NULL DEFAULT true,expires_at timestamptz,max_uses bigint CHECK(max_uses>0),used bigint NOT NULL DEFAULT 0 CHECK(used>=0),once_per_account boolean NOT NULL DEFAULT true);
 CREATE TABLE IF NOT EXISTS gg_bank_redemptions_v222(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_id uuid NOT NULL,code text NOT NULL REFERENCES gg_bank_codes_v222(code),reward jsonb NOT NULL,redeemed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(account_id,request_id));
 CREATE INDEX IF NOT EXISTS gg_bank_redemptions_v222_account_code ON gg_bank_redemptions_v222(account_id,code);`);}
 async function history(id){return {entries:(await pool.query('SELECT code,reward,redeemed_at FROM gg_bank_redemptions_v222 WHERE account_id=$1 ORDER BY redeemed_at DESC,request_id DESC LIMIT 100',[id])).rows};}
 async function redeem(id,body){
  const code=normalizeCode(body?.code),requestId=body?.requestId;rule(uuid(requestId),'Solicitud inválida');
  const c=await pool.connect();try{await c.query('BEGIN');
   const progress=(await c.query('SELECT account_id FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];if(!progress)throw fail('Piloto no disponible',404);
   const prior=(await c.query('SELECT code,reward FROM gg_bank_redemptions_v222 WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];
   if(prior){if(prior.code!==code)throw fail('Solicitud ya utilizada',409);await c.query('COMMIT');return {code,reward:prior.reward,replayed:true};}
   const row=(await c.query('SELECT *,expires_at IS NOT NULL AND expires_at<=clock_timestamp() AS expired FROM gg_bank_codes_v222 WHERE code=$1 FOR UPDATE',[code])).rows[0];
   const prev=row?.once_per_account&&(await c.query('SELECT 1 FROM gg_bank_redemptions_v222 WHERE account_id=$1 AND code=$2 LIMIT 1',[id,code])).rows.length>0;
   eligibility(row,prev);const reward=normalizeReward(row.reward);
   await c.query('UPDATE player_progress SET credits=credits+$2,uridium=uridium+$3,experience=experience+$4,honor=honor+$5,level=CASE WHEN experience+$4<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$4)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1',[id,reward.credits||0,reward.uridium||0,reward.xp||0,reward.honor||0]);
   for(const [key,n] of Object.entries(reward.stacks||{}))await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,key,n]);
   for(const i of reward.items||[])for(let n=0;n<i.quantity;n++)await c.query('INSERT INTO gg_v13_inventory(account_id,instance_id,code,category) VALUES($1,$2,$3,$4)',[id,crypto.randomUUID(),i.code,i.category]);
   if(reward.premiumDays)await c.query("INSERT INTO gg_v16_entitlements(account_id,code,seconds) VALUES($1,'premium-seconds',$2) ON CONFLICT(account_id,code) DO UPDATE SET seconds=gg_v16_entitlements.seconds+EXCLUDED.seconds",[id,reward.premiumDays*86400]);
   await c.query('UPDATE gg_bank_codes_v222 SET used=used+1 WHERE code=$1',[code]);
   await c.query('INSERT INTO gg_bank_redemptions_v222(account_id,request_id,code,reward) VALUES($1,$2,$3,$4)',[id,requestId,code,JSON.stringify(reward)]);
   await c.query('COMMIT');return {code,reward,replayed:false};
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async function listCodes(){return {entries:(await pool.query('SELECT code,reward,enabled,expires_at,max_uses,used,once_per_account FROM gg_bank_codes_v222 ORDER BY code LIMIT 200')).rows};}
 async function createCode(body){const d=normalizeCreate(body);const r=await pool.query('INSERT INTO gg_bank_codes_v222(code,reward,expires_at,max_uses,once_per_account) VALUES($1,$2,$3,$4,$5) ON CONFLICT(code) DO NOTHING RETURNING code,reward,enabled,expires_at,max_uses,used,once_per_account',[d.code,JSON.stringify(d.reward),d.expiresAt,d.maxUses,d.oncePerAccount]);if(!r.rows.length)throw fail('Código existente',409);return r.rows[0];}
 async function setEnabled(body){const code=normalizeCode(body?.code);rule(typeof body.enabled==='boolean','Estado inválido');const r=await pool.query('UPDATE gg_bank_codes_v222 SET enabled=$2 WHERE code=$1 RETURNING code,reward,enabled,expires_at,max_uses,used,once_per_account',[code,body.enabled]);if(!r.rows.length)throw fail('Código no disponible',404);return r.rows[0];}
 return {ready,history,redeem,listCodes,createCode,setEnabled};
}
module.exports={normalizeCode,normalizeReward,eligibility,normalizeCreate,createBank};
