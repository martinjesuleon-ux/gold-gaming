'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createInventory}=require('../inventory-v13');
test('PostgreSQL: inventory level constraint survives repeated initialization and enforces exclusive level 20',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts');
 const accounts=createAccounts(process.env.DATABASE_URL);try{await accounts.ready();}finally{await accounts.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());
 const constraint=async()=>(await pool.query("SELECT oid::text,convalidated FROM pg_constraint WHERE conrelid='gg_v13_inventory'::regclass AND conname='gg_v13_inventory_level_v230_check'")).rows[0];
 const before=await constraint();assert.equal(before?.convalidated,true);
 await createInventory(pool).ready();assert.deepEqual(await constraint(),before);
 const name='C'+randomUUID().replaceAll('-','').slice(0,12);
 const id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;
 const insert=(category,code,level)=>pool.query('INSERT INTO gg_v13_inventory(account_id,instance_id,category,code,level) VALUES($1,$2,$3,$4,$5)',[id,randomUUID(),category,code,level]);
 try{
 await insert('lasers','LF-4',20);await insert('shields','SG3N-B03',20);await insert('lasers','LF-3',16);
 for(const args of [['lasers','LF-3',20],['shields','SG3N-B02',20],['lasers','LF-4',17],['shields','SG3N-B03',21]])await assert.rejects(insert(...args),{code:'23514'});
 }finally{await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
