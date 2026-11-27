'use strict';
const crypto=require('node:crypto');
const {MODULES}=require('./stations-v113');
const WEEK=7*86400000,MONDAY=Date.UTC(1970,0,5),MIN=500000,OWN_INCREMENT=1500000;
const LOTS=Object.keys(MODULES);
const fail=message=>Object.assign(Error(message),{status:400});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function roundAt(now=Date.now()){return MONDAY+Math.floor((now-MONDAY)/WEEK)*WEEK;}
function minimum(current,own=false){return current?current+(own?OWN_INCREMENT:MIN):MIN;}
function createAuctions(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_cbs_auction_lots(round_start bigint NOT NULL,code text NOT NULL,bidder uuid REFERENCES accounts(id),amount bigint NOT NULL DEFAULT 0 CHECK(amount>=0),settled boolean NOT NULL DEFAULT false,PRIMARY KEY(round_start,code));
 CREATE TABLE IF NOT EXISTS gg_cbs_auction_requests(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_id uuid NOT NULL,response jsonb NOT NULL,PRIMARY KEY(account_id,request_id));`);}
 async function transaction(fn){const c=await pool.connect();try{await c.query('BEGIN');
  // Serialize auctions before touching balances; no client-controlled clock.
  await c.query('SELECT pg_advisory_xact_lock(71413001)');
  const result=await fn(c);await c.query('COMMIT');return result;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async function settle(c,now){
  const rows=(await c.query('SELECT * FROM gg_cbs_auction_lots WHERE NOT settled AND round_start+$1::bigint<=$2::bigint ORDER BY round_start,code FOR UPDATE',[WEEK,now])).rows;
  for(const r of rows){
   if(r.bidder)await c.query("INSERT INTO gg_v13_inventory(account_id,instance_id,code,category) VALUES($1,$2,$3,'cbs-modules')",[r.bidder,crypto.randomUUID(),r.code]);
   await c.query('UPDATE gg_cbs_auction_lots SET settled=true WHERE round_start=$1 AND code=$2',[r.round_start,r.code]);
  }
  return rows.length;
 }
 async function view(c,id,now){
  const start=roundAt(now),rows=(await c.query('SELECT code,bidder,amount FROM gg_cbs_auction_lots WHERE round_start=$1',[start])).rows;
  return {board:'weekly-cbs',roundStart:start,roundEnd:start+WEEK,now,credits:Number((await c.query('SELECT credits FROM player_progress WHERE account_id=$1',[id])).rows[0]?.credits||0),lots:LOTS.map(code=>{const r=rows.find(x=>x.code===code),amount=Number(r?.amount||0),own=r?.bidder===id;return {code,amount,own,minBid:minimum(amount,own),directPrice:null};})};
 }
 async function status(id){return transaction(async c=>{const now=Date.now();await settle(c,now);return view(c,id,now);});}
 async function bid(id,{code,amount,requestId,roundStart}={}){
  if(!LOTS.includes(code)||!Number.isSafeInteger(amount)||amount<MIN||!uuid(requestId)||!Number.isSafeInteger(roundStart))throw fail('Puja inválida');
  return transaction(async c=>{
   const now=Date.now(),start=roundAt(now);await settle(c,now);
   const prior=(await c.query('SELECT response FROM gg_cbs_auction_requests WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];if(prior)return prior.response;
   if(roundStart!==start)throw fail('La ronda ya terminó');
   const old=(await c.query('SELECT bidder,amount FROM gg_cbs_auction_lots WHERE round_start=$1 AND code=$2 FOR UPDATE',[start,code])).rows[0];
   const own=old?.bidder===id,previous=Number(old?.amount||0);
   if(amount<minimum(previous,own))throw fail('Puja insuficiente');
   const debit=own?amount-previous:amount;
   // Credits are escrowed; outbid players receive a refund (provisional wiki interpretation).
   const paid=await c.query('UPDATE player_progress SET credits=credits-$2 WHERE account_id=$1 AND credits>=$2',[id,debit]);if(!paid.rowCount)throw fail('Créditos insuficientes');
   if(old?.bidder&&!own)await c.query('UPDATE player_progress SET credits=credits+$2 WHERE account_id=$1',[old.bidder,previous]);
   await c.query('INSERT INTO gg_cbs_auction_lots(round_start,code,bidder,amount) VALUES($1,$2,$3,$4) ON CONFLICT(round_start,code) DO UPDATE SET bidder=EXCLUDED.bidder,amount=EXCLUDED.amount',[start,code,id,amount]);
   const result=await view(c,id,now);await c.query('INSERT INTO gg_cbs_auction_requests(account_id,request_id,response) VALUES($1,$2,$3)',[id,requestId,JSON.stringify(result)]);return result;
  });
 }
 return {ready,status,bid,settle:()=>transaction(c=>settle(c,Date.now()))};
}
module.exports={createAuctions,roundAt,minimum,WEEK,LOTS};
