'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {UNLIMITED,LIMITED,available,choose,createLottery}=require('../hitac-lottery-v143');
test('Hitac prize catalogue preserves limited stocks and excludes exhausted entries',()=>{
 const stock=Object.fromEntries(LIMITED.map(p=>[p.id,p.stock]));
 assert.equal(stock['lf4-16'],8);assert.equal(stock.logs,20);assert.equal(stock.premium,1);
 assert.equal(UNLIMITED.length,6);assert.equal(available(stock).length,UNLIMITED.length+LIMITED.length);
 stock.logs=0;assert.equal(available(stock).some(p=>p.id==='logs'),false);
 assert.deepEqual(available({}),UNLIMITED);assert.throws(()=>choose({},6));assert.equal(choose({},0).code,'MCB-50');
});
test('Hitac capsule is consumed once per request; bag reopens with original stock',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts'),a=createAccounts(process.env.DATABASE_URL);try{await a.ready();}finally{await a.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());let id;const bags=[];
 try{const svc=createLottery(pool),name='H'+randomUUID().replaceAll('-','').slice(0,12);id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;await pool.query("INSERT INTO player_progress(account_id,ship,credits,uridium,honor) VALUES($1,'scout',1000,100,200)",[id]);
 const b=await svc.open();bags.push(b.id);await assert.rejects(svc.open(),/ya abierta/);
 await pool.query("INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,'hitac-capsule',1)",[id]);
 const key=randomUUID(),[r,s]=await Promise.all([svc.draw(id,key),svc.draw(id,key)]);assert.deepEqual(r,s);assert.equal((await svc.status(id)).capsules,0);await assert.rejects(svc.draw(id,randomUUID()),/Sin cápsulas/);
 const selected=LIMITED.find(p=>p.id===r.prize.id);if(selected)assert.equal((await svc.status(id)).bag.stock[selected.id],selected.stock-1);
 assert.equal((await svc.close()).closed,true);assert.deepEqual(await svc.draw(id,key),r);const next=await svc.open();bags.push(next.id);assert.deepEqual(next.stock,b.stock);
 const p=(await pool.query('SELECT credits,uridium,honor FROM player_progress WHERE account_id=$1',[id])).rows[0];assert.equal(Number(p.credits),1000);assert.equal(Number(p.uridium),100);assert.equal(Number(p.honor),200);
 }finally{if(id)await pool.query('DELETE FROM accounts WHERE id=$1',[id]);for(const b of bags)await pool.query('DELETE FROM gg_hitac_bags WHERE id=$1',[b]);}
});
