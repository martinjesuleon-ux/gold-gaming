'use strict';
const crypto=require('node:crypto'),net=require('node:net');
const {MILESTONES,availableMilestones}=require('./referral-milestones-v222');
const LEVEL=15,TTL=30*86400000;
const RECRUIT=Object.freeze({'green-key':5,'log-disk':5,'UCB-100':5000,'RSB-75':2500});
const REFERRER=Object.freeze({'green-key':10,'log-disk':20,'gate-energy':50,'UCB-100':8000,'RSB-75':3500});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function qualifies(level){return Number.isSafeInteger(Number(level))&&Number(level)>=LEVEL;}
function ipFingerprint(ip,secret){if(typeof secret!=='string'||secret.length<32||typeof ip!=='string')return null;ip=ip.toLowerCase().replace(/^::ffff:(?=\d+\.)/,'');if(!net.isIP(ip))return null;return crypto.createHmac('sha256',secret).update(ip).digest('hex');}
function validInvite(invite,now=Date.now()){return uuid(invite?.referrer)&&Number.isSafeInteger(invite?.issuedAt)&&invite.issuedAt<=now&&now-invite.issuedAt<TTL;}
function createReferrals(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_referral_ip_v222(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,ip_hash text NOT NULL,PRIMARY KEY(account_id,ip_hash));
 CREATE TABLE IF NOT EXISTS gg_referral_network_v222(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,blocked boolean NOT NULL DEFAULT false);
 CREATE TABLE IF NOT EXISTS gg_referral_used_ip_v222(ip_hash text PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS gg_referrals_v222(recruit_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,referrer_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,ip_hash text NOT NULL,qualified_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),CHECK(recruit_id<>referrer_id));
 CREATE INDEX IF NOT EXISTS gg_referrals_v222_referrer ON gg_referrals_v222(referrer_id,qualified_at);
 CREATE TABLE IF NOT EXISTS gg_referral_milestones_v222(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, milestone integer NOT NULL CHECK(milestone IN (5,15,25,50,100)),reward jsonb NOT NULL,claimed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(account_id,milestone));`);}
 async function lock(c){await c.query('SELECT pg_advisory_xact_lock(71413,223)');}
 async function recordIP(c,id,hash){
  if(!hash)return;await c.query('INSERT INTO gg_referral_ip_v222(account_id,ip_hash) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,hash]);
  await c.query('INSERT INTO gg_referral_network_v222(account_id,blocked) SELECT $1,true WHERE EXISTS(SELECT 1 FROM gg_referrals_v222 WHERE referrer_id=$1 AND ip_hash=$2) ON CONFLICT(account_id) DO UPDATE SET blocked=true',[id,hash]);
 }
 async function register(c,id,invite,hash,now=Date.now()){
  if(!hash)return false;await lock(c);await recordIP(c,id,hash);
  if(!validInvite(invite,now)||invite.referrer===id)return false;
  const ref=(await c.query('SELECT id FROM accounts WHERE id=$1',[invite.referrer])).rows[0];if(!ref)return false;
  const own=(await c.query('SELECT 1 FROM gg_referral_ip_v222 WHERE account_id=$1 AND ip_hash=$2',[ref.id,hash])).rows.length;
  if(own){await c.query('INSERT INTO gg_referral_network_v222(account_id,blocked) VALUES($1,true) ON CONFLICT(account_id) DO UPDATE SET blocked=true',[ref.id]);return false;}
  if((await c.query('SELECT blocked FROM gg_referral_network_v222 WHERE account_id=$1',[ref.id])).rows[0]?.blocked)return false;
  const used=await c.query('INSERT INTO gg_referral_used_ip_v222(ip_hash) VALUES($1) ON CONFLICT DO NOTHING RETURNING ip_hash',[hash]);if(!used.rows.length)return false;
  await c.query('INSERT INTO gg_referrals_v222(recruit_id,referrer_id,ip_hash) VALUES($1,$2,$3)',[id,ref.id,hash]);return true;
 }
 async function loginIP(id,hash){if(!hash)return;const c=await pool.connect();try{await c.query('BEGIN');await lock(c);await recordIP(c,id,hash);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async function add(c,id,reward){for(const [code,n] of Object.entries(reward))await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,code,n]);}
 async function qualify(id){
  const c=await pool.connect();try{await c.query('BEGIN');await lock(c);
   const r=(await c.query('SELECT r.*,n.blocked FROM gg_referrals_v222 r LEFT JOIN gg_referral_network_v222 n ON n.account_id=r.referrer_id WHERE recruit_id=$1 FOR UPDATE OF r',[id])).rows[0];
   if(!r||r.qualified_at||r.blocked){await c.query('COMMIT');return false;}
   const rows=(await c.query('SELECT account_id,level FROM player_progress WHERE account_id=ANY($1::uuid[]) ORDER BY account_id FOR UPDATE',[[id,r.referrer_id]])).rows;
   if(rows.length!==2||!qualifies(rows.find(x=>x.account_id===id)?.level)){await c.query('COMMIT');return false;}
   await c.query('UPDATE player_progress SET uridium=uridium+10000 WHERE account_id=$1',[id]);await add(c,id,RECRUIT);await add(c,r.referrer_id,REFERRER);
   await c.query('UPDATE gg_referrals_v222 SET qualified_at=now() WHERE recruit_id=$1',[id]);await c.query('COMMIT');return true;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async function claim(id){
  const c=await pool.connect();try{await c.query('BEGIN');await lock(c);
   const player=(await c.query('SELECT account_id FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];if(!player)throw Object.assign(Error('Piloto no disponible'),{status:404});
   const blocked=!!(await c.query('SELECT blocked FROM gg_referral_network_v222 WHERE account_id=$1',[id])).rows[0]?.blocked;
   if(blocked)throw Object.assign(Error('Red de referidos bloqueada'),{status:409});
   const count=Number((await c.query('SELECT count(*)::int AS qualified FROM gg_referrals_v222 WHERE referrer_id=$1 AND qualified_at IS NOT NULL',[id])).rows[0].qualified);
   const claimed=(await c.query('SELECT milestone FROM gg_referral_milestones_v222 WHERE account_id=$1',[id])).rows.map(r=>Number(r.milestone));
   const awarded=[];
   for(const milestone of availableMilestones(count,claimed)){
    const reward=MILESTONES[milestone];await add(c,id,reward.stacks);
    for(const [category,code,quantity,level] of reward.items)for(let i=0;i<quantity;i++)await c.query('INSERT INTO gg_v13_inventory(account_id,instance_id,category,code,level) VALUES($1,$2,$3,$4,$5)',[id,crypto.randomUUID(),category,code,level]);
    const times={...(reward.packs||{}),...(reward.days?{'premium-seconds':reward.days}:{})};
    for(const [code,days] of Object.entries(times))await c.query('INSERT INTO gg_v16_entitlements(account_id,code,seconds) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET seconds=gg_v16_entitlements.seconds+EXCLUDED.seconds',[id,code,days*86400]);
    await c.query('INSERT INTO gg_referral_milestones_v222(account_id,milestone,reward) VALUES($1,$2,$3)',[id,milestone,JSON.stringify(reward)]);
    awarded.push({milestone,reward});
   }
   await c.query('COMMIT');return {awarded};
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async function status(id){
  const pending=(await pool.query('SELECT r.recruit_id FROM gg_referrals_v222 r JOIN player_progress p ON p.account_id=r.recruit_id WHERE (r.referrer_id=$1 OR r.recruit_id=$1) AND qualified_at IS NULL AND p.level>=$2 ORDER BY r.created_at LIMIT 100',[id,LEVEL])).rows;
  for(const r of pending)await qualify(r.recruit_id);
  const blocked=!!(await pool.query('SELECT blocked FROM gg_referral_network_v222 WHERE account_id=$1',[id])).rows[0]?.blocked;
  const counts=(await pool.query('SELECT count(*)::int AS total,count(qualified_at)::int AS qualified FROM gg_referrals_v222 WHERE referrer_id=$1',[id])).rows[0];
  const history=(await pool.query('SELECT milestone,reward,claimed_at FROM gg_referral_milestones_v222 WHERE account_id=$1 ORDER BY milestone',[id])).rows;return {referrer:id,blocked,total:blocked?0:counts.total,qualified:blocked?0:counts.qualified,requiredLevel:LEVEL,history,milestones:MILESTONES,available:availableMilestones(counts.qualified,history.map(r=>Number(r.milestone)),blocked)};
 }
 return {ready,register,loginIP,qualify,status,claim};
}
module.exports={LEVEL,TTL,RECRUIT,REFERRER,qualifies,ipFingerprint,validInvite,createReferrals};
