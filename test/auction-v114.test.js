'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {deflector,lowerDeflector,RULES}=require('../stations-v113');
const {createAuctions,roundAt,minimum,WEEK,LOTS}=require('../auction-v114');
test('CBS deflector charge, peak and automatic minimum fall',()=>{
 const at=Date.UTC(2026,10,27,19,50),s={ready_at:at,down_until:at+1800000};
 assert.equal(deflector(s,at-1).mode,'building');
 assert.equal(deflector(s,at+10000).charge,20000);
 assert.equal(deflector(s,at+600000).charge,1200000);
 assert.equal(deflector(s,at+610000).charge,1300000);
 const up=deflector(s,at+1800000);assert.equal(up.mode,'protected');assert.equal(up.charge,2880000);
 const down=lowerDeflector(s,30,at+1800000);assert.equal(down.mode,'vulnerable');assert.equal(down.downUntil,at+3600000);
 assert.throws(()=>lowerDeflector(s,29,at+1800000));assert.throws(()=>lowerDeflector(s,30,at+1000));
 const depleted=deflector(s,at+1800000+2880000);assert.equal(depleted.mode,'vulnerable');assert.equal(depleted.downUntil,depleted.at+1800000);
});
test('weekly rounds and bid increments follow wiki',()=>{
 const monday=Date.UTC(2026,10,23);assert.equal(roundAt(monday+WEEK-1),monday);assert.equal(roundAt(monday+WEEK),monday+WEEK);
 assert.equal(minimum(0),500000);assert.equal(minimum(500000),1000000);assert.equal(minimum(500000,true),2000000);assert.equal(LOTS.length,11);
});
test('weekly auction escrow, refund, exactly-once module delivery',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts');const a=createAccounts(process.env.DATABASE_URL);try{await a.ready();}finally{await a.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());const ids=[],start=roundAt(),code='HULM-1';
 try{
  for(let i=0;i<2;i++){const name='A'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;ids.push(id);await pool.query("INSERT INTO player_progress(account_id,ship,credits) VALUES($1,'scout',5000000)",[id]);}
  const svc=createAuctions(pool),bid={code,amount:500000,requestId:randomUUID(),roundStart:start};
  const first=await svc.bid(ids[0],bid);assert.equal(first.credits,4500000);assert.deepEqual(await svc.bid(ids[0],bid),first);
  await assert.rejects(svc.bid(ids[0],{...bid,amount:1000000,requestId:randomUUID()}),/insuficiente/);
  const b=await svc.bid(ids[1],{...bid,amount:1000000,requestId:randomUUID()});assert.equal(b.credits,4000000);assert.equal((await svc.status(ids[0])).credits,5000000);
  await pool.query('UPDATE gg_cbs_auction_lots SET round_start=$1 WHERE round_start=$2 AND code=$3',[start-WEEK,start,code]);
  await svc.settle();await svc.settle();
  const rows=(await pool.query("SELECT code FROM gg_v13_inventory WHERE account_id=$1 AND category='cbs-modules'",[ids[1]])).rows;assert.deepEqual(rows,[{code}]);
  const hourly=await svc.status(ids[0],'hourly'),daily=await svc.status(ids[0],'daily');
  assert.equal(hourly.roundEnd-hourly.roundStart,3600000);assert.equal(daily.roundEnd-daily.roundStart,86400000);
  const buy={board:'hourly',action:'buy',code:'MCB-25',requestId:randomUUID()};
  const bought=await svc.bid(ids[0],buy);assert.equal(bought.credits,4975000);assert.deepEqual(await svc.bid(ids[0],buy),bought);
  assert.equal(Number((await pool.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='MCB-25'",[ids[0]])).rows[0].quantity),1000);
  await assert.rejects(svc.bid(ids[0],{action:'buy',code:'HULM-1',requestId:randomUUID()}),/Solo disponible/);
  await pool.query('UPDATE player_progress SET uridium=250000 WHERE account_id=$1',[ids[0]]);
  const design=await svc.bid(ids[0],{board:'daily',action:'buy',code:'Lightning',requestId:randomUUID()});
  assert.equal(design.uridium,0);
  await assert.rejects(svc.bid(ids[0],{board:'daily',action:'buy',code:'Lightning',requestId:randomUUID()}),/ya adquirido/);
  const hourBid={board:'hourly',code:'MCB-50',amount:500000,roundStart:hourly.roundStart,requestId:randomUUID()};await svc.bid(ids[1],hourBid);
  await pool.query("UPDATE gg_cbs_auction_lots SET round_start=$1 WHERE round_start=$2 AND code='MCB-50'",[hourly.roundStart-3600000,hourly.roundStart]);
  await svc.settle();await svc.settle();assert.equal(Number((await pool.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='MCB-50'",[ids[1]])).rows[0].quantity),1000);
 }finally{await pool.query('DELETE FROM gg_cbs_auction_lots WHERE bidder=ANY($1::uuid[])',[ids]);for(const id of ids)await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
