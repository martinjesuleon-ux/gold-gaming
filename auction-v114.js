'use strict';
const crypto=require('node:crypto');
const {MODULES}=require('./stations-v113');const catalog=require('./data/catalog-v13.json');
const HOUR=3600000,DAY=24*HOUR,WEEK=7*DAY,MONDAY=Date.UTC(1970,0,5),MIN=500000,OWN_INCREMENT=1500000;
const LOTS=Object.keys(MODULES);
const lot=(code,category,quantity,price,currency='uridium',unique=false)=>({code,category,quantity,directPrice:price,currency,unique});
const BOARDS={
 'hourly':{duration:HOUR,lots:[
 lot('MCB-25','stack',1000,25000,'credits'),lot('MCB-50','stack',1000,1000),lot('SAB-50','stack',1000,1000),
 lot('PLT-3030','stack',1000,700),lot('PLT-2021','stack',1000,500),lot('ACM-01','stack',10,1000),lot('xenomit','stack',100,100),lot('log-disk','stack',3,900),
 lot('G3N-7900','engines',1,2000),lot('SG3N-B02','shields',1,10000),lot('LF-3','lasers',1,10000),lot('HST-2','launchers',1,15000),
 lot('iris','drones',1,15000),lot('REP-3','robots',1,5000),lot('REP-4','robots',1,20000),
 ...[['CLO4K-CPU',5000],['CLO4K-XL-CPU',22500],['GEMINEX-XI',10000],['SL-02',75000],['SL-03',150000],['SL-04',250000],['AROL-X',25000],['RL-LB1',25000],['R0K-T01',10000],['MIN-T02',25000],['SMB-01',50000],['ISH-01',50000],['AIM-02',200000],['AJP-01',75000],['NC-RRB',10000],['NC-AWB',10000]].map(([code,p])=>lot(code,'cpus',1,p,'uridium',true)),
 ...[['leonov',15000],['vengeance',30000],['goliath',50000]].map(([code,p])=>lot(code,'ships',1,p,'uridium',true)),
 ...['Exalted','Veteran','Enforcer','Avenger','Revenge'].map(code=>lot(code,'ship-designs',1,100000,'uridium',true)),
 ...['EP','SHD','DMG','REP','HON'].map(prefix=>lot(prefix+'-B01','booster',1,10000))
 ]},
 'daily':{duration:DAY,lots:['Lightning','Diminisher','Sentinel','Solace','Spectrum','Venom'].map(code=>lot(code,'ship-designs',1,250000,'uridium',true))},
 'weekly-cbs':{duration:WEEK,lots:[...LOTS.map(code=>lot(code,'cbs-modules',1,null)),...[
 ['aegis',250000],['citadel',80000],['spearhead',45000]
 ].map(([code,p])=>lot(code,'ships',1,p,'uridium',true)),...['aegis','citadel','spearhead'].flatMap(code=>[lot(code+'-elite','ship-designs',1,200000,'uridium',true),lot(code+'-veteran','ship-designs',1,100000,'uridium',true)])]}
};
const fail=message=>Object.assign(Error(message),{status:400});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function roundAt(now=Date.now(),board='weekly-cbs'){const d=Object.hasOwn(BOARDS,board)?BOARDS[board].duration:0;if(!d)throw fail('Tablero inválido');const origin=board==='weekly-cbs'?MONDAY:0;return origin+Math.floor((now-origin)/d)*d;}
function minimum(current,own=false){return current?current+(own?OWN_INCREMENT:MIN):MIN;}
function createAuctions(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_cbs_auction_lots(round_start bigint NOT NULL,code text NOT NULL,bidder uuid REFERENCES accounts(id),amount bigint NOT NULL DEFAULT 0 CHECK(amount>=0),settled boolean NOT NULL DEFAULT false,PRIMARY KEY(round_start,code));
 ALTER TABLE gg_cbs_auction_lots ADD COLUMN IF NOT EXISTS board text NOT NULL DEFAULT 'weekly-cbs';
 CREATE TABLE IF NOT EXISTS gg_cbs_auction_requests(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_id uuid NOT NULL,response jsonb NOT NULL,PRIMARY KEY(account_id,request_id));`);}
 async function transaction(fn){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(71413001)');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async function owned(c,id,l){if(l.category==='drones'){const n=Number((await c.query("SELECT count(*) AS n FROM gg_v13_inventory WHERE account_id=$1 AND category='drones' AND code IN ('flax','iris')",[id])).rows[0].n);return n+l.quantity>8;}return l.unique&&(await c.query('SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND category=$2 AND code=$3',[id,l.category,l.code])).rowCount>0;}
 async function grant(c,id,l){
  if(l.category==='booster'){await c.query('INSERT INTO gg_v16_entitlements(account_id,code,seconds) VALUES($1,$2,36000) ON CONFLICT(account_id,code) DO UPDATE SET seconds=gg_v16_entitlements.seconds+EXCLUDED.seconds',[id,l.code]);return;}
  if(l.category==='stack')await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,l.code,l.quantity]);
  else for(let i=0;i<l.quantity;i++)await c.query('INSERT INTO gg_v13_inventory(account_id,instance_id,code,category) VALUES($1,$2,$3,$4)',[id,crypto.randomUUID(),l.code,l.category]);
  if(l.category==='cpus'){const uses=catalog.cpus.find(x=>x.id===l.code)?.uses;if(uses)await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,l.code+'-uses',uses]);}
 }
 async function settle(c,now){
  const rows=(await c.query("SELECT * FROM gg_cbs_auction_lots WHERE NOT settled AND round_start+CASE board WHEN 'hourly' THEN 3600000 WHEN 'daily' THEN 86400000 ELSE 604800000 END <=$1::bigint ORDER BY round_start,code FOR UPDATE",[now])).rows;
  for(const r of rows){const l=BOARDS[r.board]?.lots.find(x=>x.code===r.code);if(!l)throw fail('Lote desconocido');
   if(r.bidder){await c.query('SELECT account_id FROM player_progress WHERE account_id=$1 FOR UPDATE',[r.bidder]);if(await owned(c,r.bidder,l))await c.query('UPDATE player_progress SET credits=credits+$2 WHERE account_id=$1',[r.bidder,r.amount]);else await grant(c,r.bidder,l);}
   await c.query('UPDATE gg_cbs_auction_lots SET settled=true WHERE round_start=$1 AND code=$2',[r.round_start,r.code]);}
  return rows.length;
 }
 async function view(c,id,now,board='weekly-cbs'){
  const start=roundAt(now,board),rows=(await c.query('SELECT code,bidder,amount FROM gg_cbs_auction_lots WHERE round_start=$1 AND board=$2',[start,board])).rows;
  const balance=(await c.query('SELECT credits,uridium FROM player_progress WHERE account_id=$1',[id])).rows[0];
  return {board,roundStart:start,roundEnd:start+BOARDS[board].duration,now,credits:Number(balance?.credits||0),uridium:Number(balance?.uridium||0),lots:BOARDS[board].lots.map(l=>{const r=rows.find(x=>x.code===l.code),amount=Number(r?.amount||0),own=r?.bidder===id;return {...l,amount,own,minBid:minimum(amount,own)};})};
 }
 async function status(id,board='weekly-cbs'){return transaction(async c=>{const now=Date.now();await settle(c,now);return view(c,id,now,board);});}
 async function bid(id,{code,amount,requestId,roundStart,board='weekly-cbs',action='bid'}={}){
  const l=Object.hasOwn(BOARDS,board)?BOARDS[board].lots.find(x=>x.code===code):null;
  if(!l||!uuid(requestId)||!['bid','buy'].includes(action)||action==='bid'&&(!Number.isSafeInteger(amount)||amount<MIN||!Number.isSafeInteger(roundStart)))throw fail('Solicitud inválida');
  return transaction(async c=>{
   const now=Date.now(),start=roundAt(now,board);await settle(c,now);
   const prior=(await c.query('SELECT response FROM gg_cbs_auction_requests WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];if(prior)return prior.response;
   await c.query('SELECT account_id FROM player_progress WHERE account_id=$1 FOR UPDATE',[id]);
   if(await owned(c,id,l))throw fail(l.category==='drones'?'Límite de ocho VANT normales':'Objeto ya adquirido');
   if(action==='buy'){
    if(l.directPrice===null)throw fail('Solo disponible mediante puja');
    const currency=l.currency==='credits'?'credits':'uridium';
    const paid=await c.query('UPDATE player_progress SET '+currency+'='+currency+'-$2 WHERE account_id=$1 AND '+currency+'>=$2',[id,l.directPrice]);if(!paid.rowCount)throw fail('Saldo insuficiente');await grant(c,id,l);
   }else{
    if(roundStart!==start)throw fail('La ronda ya terminó');
    const old=(await c.query('SELECT bidder,amount FROM gg_cbs_auction_lots WHERE round_start=$1 AND code=$2 AND board=$3 FOR UPDATE',[start,code,board])).rows[0];
    const own=old?.bidder===id,previous=Number(old?.amount||0);if(amount<minimum(previous,own))throw fail('Puja insuficiente');
    const debit=own?amount-previous:amount;
    const paid=await c.query('UPDATE player_progress SET credits=credits-$2 WHERE account_id=$1 AND credits>=$2',[id,debit]);if(!paid.rowCount)throw fail('Créditos insuficientes');
    if(old?.bidder&&!own)await c.query('UPDATE player_progress SET credits=credits+$2 WHERE account_id=$1',[old.bidder,previous]);
    await c.query('INSERT INTO gg_cbs_auction_lots(round_start,code,bidder,amount,board) VALUES($1,$2,$3,$4,$5) ON CONFLICT(round_start,code) DO UPDATE SET bidder=EXCLUDED.bidder,amount=EXCLUDED.amount',[start,code,id,amount,board]);
   }
   const result=await view(c,id,now,board);await c.query('INSERT INTO gg_cbs_auction_requests(account_id,request_id,response) VALUES($1,$2,$3)',[id,requestId,JSON.stringify(result)]);return result;
  });
 }
 return {ready,status,bid,settle:()=>transaction(c=>settle(c,Date.now()))};
}
module.exports={createAuctions,roundAt,minimum,WEEK,LOTS,BOARDS};
