'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {rankPoints,warPoints,ranks,createRankings}=require('../rankings-v123');
test('military rank points and war aging follow wiki',()=>{
 assert.equal(rankPoints({experience:100000,honor:100,level:2,days:5,kills:3,allyKills:1,deaths:2,radiation:1}),238);
 assert.equal(rankPoints({honor:-1,level:50}),0);assert.equal(rankPoints({admin:true,level:50}),0);
 const d=86400000;assert.deepEqual([0,7*d,30*d,60*d].map(warPoints),[75,50,25,12]);
 const rows=Array.from({length:10},(_,i)=>({id:String(i),company:1,honor:100-i,experience:1000000*(10-i),level:10}));
 rows.push({id:'other',company:2,honor:1,level:1},{id:'wanted',company:1,honor:-1,level:99},{id:'admin',company:1,admin:true,honor:100000,level:99});
 const out=ranks(rows);assert.deepEqual(out.slice(0,8).map(r=>r.rank),[21,20,19,18,18,17,17,17]);assert.equal(out.find(r=>r.id==='other').rank,21);assert.equal(out.find(r=>r.id==='wanted').rank,22);assert.equal(out.find(r=>r.id==='admin').rank,23);
});
test('rank snapshot and leaderboard exclude wanted and admin accounts',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts');const a=createAccounts(process.env.DATABASE_URL);try{await a.ready();}finally{await a.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());const ids=[],names=[];
 try{
 for(let i=0;i<3;i++){const name='R'+randomUUID().replaceAll('-','').slice(0,12);names.push(name);const id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;ids.push(id);await pool.query("INSERT INTO player_progress(account_id,ship,experience,honor,level) VALUES($1,'scout',1000000,$2,10)",[id,i===1?-1:100]);}
 await pool.query('INSERT INTO gg_rank_profiles(account_id,admin) VALUES($1,true)',[ids[2]]);
 const r=createRankings(pool);await r.refresh();const xp=await r.status(ids[0],'xp');assert.ok(xp.rows.some(x=>x.name===names[0]));assert.ok(!xp.rows.some(x=>names.slice(1).includes(x.name)));
 assert.equal((await r.status(ids[1])).own.rank,22);assert.equal((await r.status(ids[2])).own.rank,23);
 await pool.query('INSERT INTO gg_rank_kills(attacker,victim,ally) VALUES($1,$2,false)',[ids[0],ids[1]]);
 assert.equal(Number((await r.status(ids[0],'war')).rows.find(x=>x.name===names[0]).value),75);
 await r.status(ids[0],'clan');
 }finally{for(const id of ids)await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
