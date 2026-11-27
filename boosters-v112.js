'use strict';
const {premiumAllowed}=require('./premium-pilot-v224');
const stats=[['DMG','damage','Daño',.10,.05],['EP','xp','Experiencia',.10,.05],['HON','honor','Honor',.10,.05],['HP','hp','Vida',.10,.05],['REP','repair','Reparación',.10,.05],['RES','box','Recursos',.10,.05],['SHD','shield','Escudo',.25,.10]];
const legacy={damage:'damage',xp:'experience',honor:'honor',hp:'hp',repair:'repair',box:'resources',shield:'shield'};
const CATALOG=Object.fromEntries(stats.flatMap(([prefix,stat,name,own,shared])=>[1,2].map(n=>[prefix+'-B0'+n,{code:prefix+'-B0'+n,name:name+(n===2?' compartido':''),price:10000,seconds:36000,effects:{[stat]:own},shared:n===2?{[stat]:shared}:{},legacy:n===1?'booster-'+legacy[stat]+'-seconds':null}])));
CATALOG['MUL-B03']={code:'MUL-B03',name:'MultiBooster',seconds:18000,effects:{damage:.05,xp:.05,shield:.05},shared:{}};
// Special packs have no in-game purchase price. Their effects never enter combat factors.
CATALOG['NBX-B01']={code:'NBX-B01',name:'Booster de cajas de bonificación',seconds:604800,effects:{},shared:{},rewardKind:'bonus-box',multiplier:2};
CATALOG['QR-01']={code:'QR-01',name:'Booster de recompensas de misión',seconds:604800,effects:{},shared:{},rewardKind:'mission',multiplier:2};
CATALOG['PREMIUM']={code:'PREMIUM',name:'Cuenta Premium',seconds:86400,effects:{},shared:{},legacy:'premium-seconds',premium:true};
function rewardFactor(active,kind,now=Date.now()){
 const code=kind==='bonus-box'?'NBX-B01':kind==='mission'?'QR-01':null;
 return code&&Number(active?.[code])>now?2:1;
}
async function rewardFactorRead(c,id,kind,now=Date.now()){
 const code=kind==='bonus-box'?'NBX-B01':kind==='mission'?'QR-01':null;
 if(!code)return 1;
 const row=(await c.query('SELECT until_ms FROM gg_booster_active WHERE account_id=$1 AND code=$2 AND until_ms>$3',[id,code,now])).rows[0];
 return rewardFactor({[code]:row?.until_ms},kind,now);
}
function premiumCargo(base,hasCpu=false,skillFactor=1,active=false){
 if(!Number.isSafeInteger(base)||base<0||!Number.isFinite(skillFactor)||skillFactor<1)throw Error('Capacidad inválida');
 return Math.floor(base*(hasCpu?2:1)*skillFactor)+(active?1500:0);
}
function rocketCooldown(hasCpu=false,formationFactor=1,active=false){
 if(!Number.isFinite(formationFactor)||formationFactor<=0)throw Error('Recarga inválida');
 return Math.max(1,Math.round((hasCpu?1000:2000)*formationFactor*(active?.5:1)));
}
function premiumPrice(total,active=false){
 if(!Number.isSafeInteger(total)||total<0)throw Error('Precio inválido');
 return active?Number((BigInt(total)*95n+99n)/100n):total;
}
async function premiumRead(c,id,now=Date.now()){
 const row=(await c.query("SELECT until_ms FROM gg_booster_active WHERE account_id=$1 AND code='PREMIUM' AND until_ms>$2",[id,now])).rows[0];
 return Number(row?.until_ms)>now;
}
function scaleReward(reward,factor){
 if(factor!==1&&factor!==2)throw Error('Multiplicador inválido');
 return Object.fromEntries(Object.entries(reward).map(([k,n])=>{if(!Number.isSafeInteger(n)||n<0||!Number.isSafeInteger(n*factor))throw Error('Recompensa inválida');return [k,n*factor];}));
}
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function factors(active={},nearby=[],now=Date.now()){
 const bonus={},shared={};
 for(const [code,until] of Object.entries(active))if(Number(until)>now&&CATALOG[code])for(const [k,v] of Object.entries(CATALOG[code].effects))bonus[k]=(bonus[k]||0)+v;
 for(const ally of nearby)for(const [code,until] of Object.entries(ally||{}))if(Number(until)>now&&CATALOG[code])for(const [k,v] of Object.entries(CATALOG[code].shared))shared[k]=Math.max(shared[k]||0,v);
 return Object.fromEntries(stats.map(([,k])=>[k,1+(bonus[k]||0)+(shared[k]||0)]));
}
async function ready(pool){await pool.query(`CREATE TABLE IF NOT EXISTS gg_booster_active(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,code text NOT NULL,until_ms bigint NOT NULL,PRIMARY KEY(account_id,code));
 CREATE TABLE IF NOT EXISTS gg_booster_requests(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_id uuid NOT NULL,response jsonb NOT NULL,PRIMARY KEY(account_id,request_id));`);}
async function read(c,id){const rows=(await c.query('SELECT code,until_ms FROM gg_booster_active WHERE account_id=$1 AND until_ms>$2',[id,Date.now()])).rows;return Object.fromEntries(rows.filter(x=>CATALOG[x.code]).map(x=>[x.code,Number(x.until_ms)]));}
async function extend(c,id,code,seconds){if(!CATALOG[code]||!Number.isSafeInteger(seconds)||seconds<1)throw fail('Booster inválido');const now=Date.now();await c.query('INSERT INTO gg_booster_active(account_id,code,until_ms) VALUES($1,$2,$3::bigint+$4::bigint) ON CONFLICT(account_id,code) DO UPDATE SET until_ms=GREATEST(gg_booster_active.until_ms,$3::bigint)+$4::bigint',[id,code,now,seconds*1000]);}
function createBoosters(pool,{allowPremium=premiumAllowed}={}){
 async function view(c,id){const rows=(await c.query('SELECT code,seconds FROM gg_v16_entitlements WHERE account_id=$1',[id])).rows;const stock=Object.fromEntries(rows.map(x=>[x.code,Number(x.seconds)]));return {premiumActivationEnabled:allowPremium(id),catalog:Object.values(CATALOG),active:await read(c,id),stock,balance:(await c.query('SELECT credits,uridium FROM player_progress WHERE account_id=$1',[id])).rows[0],clock:'wall',now:Date.now()};}
 async function action(id,{action,code,requestId}={}){
  if(!uuid(requestId)||!Object.hasOwn(CATALOG,code)||!['buy','activate'].includes(action))throw fail('Solicitud inválida');
  const def=CATALOG[code];if(def.premium&&(action!=='activate'||!allowPremium(id)))throw fail('Activación Premium no habilitada para esta cuenta',409);const c=await pool.connect();
  try{await c.query('BEGIN');await c.query('SELECT account_id FROM player_progress WHERE account_id=$1 FOR UPDATE',[id]);
   const old=(await c.query('SELECT response FROM gg_booster_requests WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];if(old){await c.query('COMMIT');return old.response;}
   if(action==='buy'){
    if(!def.price)throw fail('Booster no disponible en tienda');
    const paid=await c.query('UPDATE player_progress SET uridium=uridium-$2 WHERE account_id=$1 AND uridium>=$2',[id,def.price]);if(!paid.rowCount)throw fail('Uridium insuficiente');
    await c.query('INSERT INTO gg_v16_entitlements(account_id,code,seconds) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET seconds=gg_v16_entitlements.seconds+EXCLUDED.seconds',[id,code,def.seconds]);
   }else{
    const keys=[code,...(def.legacy?[def.legacy]:[])];let total=0;
    for(const key of keys){const r=(await c.query('SELECT seconds FROM gg_v16_entitlements WHERE account_id=$1 AND code=$2 FOR UPDATE',[id,key])).rows[0];const n=Number(r?.seconds||0);if(n>0){total+=n;await c.query('UPDATE gg_v16_entitlements SET seconds=0 WHERE account_id=$1 AND code=$2',[id,key]);}}
    // Old Kappa rewards used a stack rather than seconds.
    if(code==='MUL-B03'){const r=(await c.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='MUL-B03' FOR UPDATE",[id])).rows[0];const n=Number(r?.quantity||0);if(n>0){total+=n*def.seconds;await c.query("UPDATE gg_v13_ammo SET quantity=0 WHERE account_id=$1 AND code='MUL-B03'",[id]);}}
    if(!Number.isSafeInteger(total)||total>Math.floor(Number.MAX_SAFE_INTEGER/1000)-Math.ceil(Date.now()/1000))throw fail('Tiempo fuera de rango');if(!total)throw fail('Sin tiempo disponible');
    await extend(c,id,code,total);
   }
   const result=await view(c,id);await c.query('INSERT INTO gg_booster_requests(account_id,request_id,response) VALUES($1,$2,$3)',[id,requestId,JSON.stringify(result)]);await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 return {ready:()=>ready(pool),read:id=>read(pool,id),status:id=>view(pool,id),action};
}
module.exports={CATALOG,createBoosters,ready,read,extend,factors,rewardFactor,rewardFactorRead,scaleReward,premiumPrice,premiumRead,premiumCargo,rocketCooldown};
