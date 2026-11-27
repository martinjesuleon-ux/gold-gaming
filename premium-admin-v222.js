'use strict';
const {premiumEnabled,premiumAllowed}=require('./premium-pilot-v224');
const DAY=86400000;
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function grantInput(body,now=Date.now()){
 if(!uuid(body?.requestId)||typeof body.username!=='string'||body.username.trim().length<2||body.username.trim().length>18)throw fail('Solicitud inválida');
 const days=body.days??null,until=body.until??null;
 if((days===null)===(until===null))throw fail('Selecciona días o fecha');
 if(days!==null&&![1,3,7,30].includes(days))throw fail('Duración inválida');
 if(until!==null&&(typeof until!=='string'||!Number.isFinite(Date.parse(until))||new Date(until).toISOString()!==until))throw fail('Fecha inválida');
 return {username:body.username.trim(),requestId:body.requestId,days,until};
}
function grantExpiry(old,input,now){
 const base=Math.max(Number(old||0),now),next=input.days!==null?base+input.days*DAY:Date.parse(input.until);
 if(input.until!==null&&next>now+366*DAY)throw fail('Fecha fuera de rango');
 if(!Number.isSafeInteger(next)||next<=base)throw fail('La fecha debe ampliar el Premium existente',409);
 return next;
}
function createPremiumAdmin(pool,enabled=premiumEnabled,allowPilot=enabled===premiumEnabled?premiumAllowed:()=>true){
 async function ready(){await pool.query('CREATE TABLE IF NOT EXISTS gg_premium_admin_v222(request_id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request jsonb NOT NULL,response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now())');}
 async function status(username){const result={enabled:enabled(),entries:(await pool.query('SELECT response,created_at FROM gg_premium_admin_v222 ORDER BY created_at DESC LIMIT 50')).rows};if(typeof username==='string'&&username.trim().length>=2&&username.trim().length<=18)result.pilot=(await pool.query("SELECT a.id,a.username,COALESCE(b.until_ms,0) AS until_ms FROM accounts a JOIN player_progress p ON p.account_id=a.id LEFT JOIN gg_booster_active b ON b.account_id=a.id AND b.code='PREMIUM' WHERE lower(a.username)=lower($1)",[username.trim()])).rows[0]||null;if(result.pilot){const {id,...pilot}=result.pilot;result.pilot={...pilot,enabled:enabled()&&allowPilot(id)};}return result;}
 async function grant(body){
  const input=grantInput(body);if(!enabled())throw fail('Activación Premium pendiente de validación',409);
  const c=await pool.connect();try{await c.query('BEGIN');
   await c.query('SELECT pg_advisory_xact_lock(71413,222)');
   const old=(await c.query('SELECT request,response FROM gg_premium_admin_v222 WHERE request_id=$1',[input.requestId])).rows[0];
   if(old){if(old.request.username.toLowerCase()!==input.username.toLowerCase()||old.request.days!==input.days||old.request.until!==input.until)throw fail('Solicitud ya utilizada',409);await c.query('COMMIT');return old.response;}
   const account=(await c.query('SELECT a.id,a.username FROM accounts a JOIN player_progress p ON p.account_id=a.id WHERE lower(a.username)=lower($1) FOR UPDATE OF p',[input.username])).rows[0];if(!account)throw fail('Piloto no encontrado',404);if(!allowPilot(account.id))throw fail('Piloto fuera de la prueba Premium',409);
   const prev=(await c.query("SELECT until_ms FROM gg_booster_active WHERE account_id=$1 AND code='PREMIUM' FOR UPDATE",[account.id])).rows[0];
   const now=Date.now(),next=grantExpiry(prev?.until_ms,input,now);
   await c.query("INSERT INTO gg_booster_active(account_id,code,until_ms) VALUES($1,'PREMIUM',$2) ON CONFLICT(account_id,code) DO UPDATE SET until_ms=EXCLUDED.until_ms",[account.id,next]);
   const response={username:account.username,previousUntil:Number(prev?.until_ms||0),until:next,days:input.days};
   await c.query('INSERT INTO gg_premium_admin_v222(request_id,account_id,request,response) VALUES($1,$2,$3,$4)',[input.requestId,account.id,JSON.stringify(input),JSON.stringify(response)]);
   await c.query('COMMIT');return response;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 return {ready,status,grant};
}
module.exports={grantInput,grantExpiry,createPremiumAdmin};
