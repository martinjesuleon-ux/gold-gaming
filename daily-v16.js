'use strict';
// Daily calendar transcribed from supplied wiki. UTC reset is a provisional server choice.
const DAYS=[
 {credits:25000},{uridium:100},{'LCB-10':1000},{'gate-energy':250},{uridium:200},{'R-310':50},{credits:100000,'green-key':1},
 {credits:40000},{uridium:300},{'MCB-25':1000},{'booster-damage-seconds':36000},{'gate-energy':500},{'ACM-01':25},{credits:200000,uridium:500},
 {credits:60000},{uridium:400},{'MCB-50':1500},{'booster-experience-seconds':36000},{'PLT-2021':100},{'gate-energy':750},{'green-key':1,uridium:750},
 {credits:80000},{uridium:500},{'UCB-100':2000},{'booster-honor-seconds':36000},{'DDM-01':50},{'gate-energy':1000},{credits:500000,uridium:3000,'premium-seconds':259200}
];
const utcDay=now=>new Date(now).toISOString().slice(0,10);
function nextDay(last,day,now){return last===utcDay(now)?null:day%28+1;}
function createDaily(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_v16_daily(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,day integer NOT NULL CHECK(day BETWEEN 1 AND 28),last_day date NOT NULL);
 CREATE TABLE IF NOT EXISTS gg_v16_entitlements(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,code text NOT NULL,seconds bigint NOT NULL CHECK(seconds>=0),PRIMARY KEY(account_id,code));`);}
 async function status(id){const r=(await pool.query("SELECT day,to_char(last_day,'YYYY-MM-DD') AS last_day FROM gg_v16_daily WHERE account_id=$1",[id])).rows[0];return {day:r?.day||0,claimedToday:r?.last_day===utcDay(Date.now()),calendar:DAYS,reset:'UTC'};}
 async function claim(id){const c=await pool.connect();try{await c.query('BEGIN');const p=(await c.query('SELECT credits,uridium FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];if(!p)throw Error('Piloto no disponible');
 const r=(await c.query("SELECT day,to_char(last_day,'YYYY-MM-DD') AS last_day FROM gg_v16_daily WHERE account_id=$1",[id])).rows[0];const now=Date.now(),day=nextDay(r?.last_day,r?.day||0,now);
 if(day===null){await c.query('COMMIT');return {day:r.day,claimedToday:true,already:true,calendar:DAYS,balance:p,reset:'UTC'};}
 const reward=DAYS[day-1];
 const balance=(await c.query('UPDATE player_progress SET credits=credits+$2,uridium=uridium+$3,updated_at=now() WHERE account_id=$1 RETURNING credits,uridium',[id,reward.credits||0,reward.uridium||0])).rows[0];
 for(const [code,quantity] of Object.entries(reward)){if(code==='credits'||code==='uridium')continue;
 if(code.endsWith('-seconds'))await c.query('INSERT INTO gg_v16_entitlements(account_id,code,seconds) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET seconds=gg_v16_entitlements.seconds+EXCLUDED.seconds',[id,code,quantity]);
 else await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,code,quantity]);}
 await c.query('INSERT INTO gg_v16_daily(account_id,day,last_day) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET day=EXCLUDED.day,last_day=EXCLUDED.last_day',[id,day,utcDay(now)]);
 await c.query('COMMIT');return {day,claimedToday:true,already:false,reward,balance,calendar:DAYS,reset:'UTC'};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 return {ready,status,claim};
}
module.exports={DAYS,utcDay,nextDay,createDaily};
