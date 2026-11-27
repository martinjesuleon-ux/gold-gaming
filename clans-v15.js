'use strict';
const crypto=require('node:crypto');
const PERMISSIONS=['expulsar','reclutar','diplomacia','cbs'];
function createClans(pool){
 const fail=message=>Object.assign(Error(message),{status:400});
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_v15_clans(id uuid PRIMARY KEY,name text NOT NULL,tag text NOT NULL,leader uuid NOT NULL REFERENCES accounts(id),credits bigint NOT NULL DEFAULT 0,uridium bigint NOT NULL DEFAULT 0,credit_tax integer NOT NULL DEFAULT 0 CHECK(credit_tax BETWEEN 0 AND 5),uridium_tax integer NOT NULL DEFAULT 0 CHECK(uridium_tax BETWEEN 0 AND 3));
 CREATE UNIQUE INDEX IF NOT EXISTS gg_v15_clans_name ON gg_v15_clans(lower(name));CREATE UNIQUE INDEX IF NOT EXISTS gg_v15_clans_tag ON gg_v15_clans(lower(tag));
 CREATE TABLE IF NOT EXISTS gg_v15_clan_members(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,clan_id uuid NOT NULL REFERENCES gg_v15_clans(id) ON DELETE CASCADE,permissions text[] NOT NULL DEFAULT '{}');
 ALTER TABLE gg_v15_clan_members ADD COLUMN IF NOT EXISTS credit_tax_at timestamptz NOT NULL DEFAULT now();
 ALTER TABLE gg_v15_clan_members ADD COLUMN IF NOT EXISTS uridium_tax_at timestamptz NOT NULL DEFAULT now();
 CREATE TABLE IF NOT EXISTS gg_v15_clan_requests(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,clan_id uuid NOT NULL REFERENCES gg_v15_clans(id) ON DELETE CASCADE,PRIMARY KEY(account_id,clan_id));
 CREATE TABLE IF NOT EXISTS gg_v15_clan_diplomacy(source uuid NOT NULL REFERENCES gg_v15_clans(id) ON DELETE CASCADE,target uuid NOT NULL REFERENCES gg_v15_clans(id) ON DELETE CASCADE,state text NOT NULL CHECK(state IN ('war','alliance')),PRIMARY KEY(source,target));`);}
 async function membership(c,id){return (await c.query('SELECT c.*,m.permissions FROM gg_v15_clan_members m JOIN gg_v15_clans c ON c.id=m.clan_id WHERE m.account_id=$1',[id])).rows[0]||null;}
 async function view(id){const c=await membership(pool,id);const list=(await pool.query('SELECT id,name,tag FROM gg_v15_clans ORDER BY name LIMIT 100')).rows;if(!c)return {clan:null,list};const members=(await pool.query('SELECT m.account_id,a.username,m.permissions FROM gg_v15_clan_members m JOIN accounts a ON a.id=m.account_id WHERE m.clan_id=$1 ORDER BY a.username',[c.id])).rows;const requests=(await pool.query('SELECT r.account_id,a.username FROM gg_v15_clan_requests r JOIN accounts a ON a.id=r.account_id WHERE r.clan_id=$1 ORDER BY a.username',[c.id])).rows;const diplomacy=(await pool.query('SELECT d.target,c.tag,d.state FROM gg_v15_clan_diplomacy d JOIN gg_v15_clans c ON c.id=d.target WHERE d.source=$1',[c.id])).rows;return {clan:c,members,requests,diplomacy,list,self:id};}
 async function action(id,d){
 const c=await pool.connect();try{await c.query('BEGIN');const p=(await c.query('SELECT credits FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];if(!p)throw fail('Piloto no disponible');
 let own=await membership(c,id);const can=k=>own&&(own.leader===id||own.permissions.includes(k));const target=String(d.target||'');const validUUID=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
 if(d.action==='create'){
 if(own)throw fail('Ya perteneces a un clan');const name=String(d.name||'').trim(),tag=String(d.tag||'').trim();if(name.length<3||name.length>32||!/^[\p{L}\p{N} _-]+$/u.test(name)||!/^[A-Za-z0-9]{2,6}$/.test(tag))throw fail('Nombre o etiqueta inválidos');if(Number(p.credits)<500000)throw fail('Necesitas 500.000 créditos');
 const clan=crypto.randomUUID();await c.query('INSERT INTO gg_v15_clans(id,name,tag,leader) VALUES($1,$2,$3,$4)',[clan,name,tag,id]);await c.query('INSERT INTO gg_v15_clan_members(account_id,clan_id) VALUES($1,$2)',[id,clan]);await c.query('UPDATE player_progress SET credits=credits-500000 WHERE account_id=$1',[id]);await c.query('DELETE FROM gg_v15_clan_requests WHERE account_id=$1',[id]);
 }else if(d.action==='apply'){
 if(own||!validUUID(target))throw fail('Solicitud inválida');await c.query('INSERT INTO gg_v15_clan_requests(account_id,clan_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,target]);
 }else if(d.action==='accept'){
 if(!can('reclutar')||!validUUID(target))throw fail('Sin permiso');const req=await c.query('DELETE FROM gg_v15_clan_requests WHERE account_id=$1 AND clan_id=$2 RETURNING account_id',[target,own.id]);if(!req.rowCount)throw fail('Solicitud inexistente');await c.query('INSERT INTO gg_v15_clan_members(account_id,clan_id) VALUES($1,$2)',[target,own.id]);await c.query('DELETE FROM gg_v15_clan_requests WHERE account_id=$1',[target]);
 }else if(d.action==='leave'){
 if(!own||own.leader===id)throw fail('El líder no puede abandonar el clan');await c.query('DELETE FROM gg_v15_clan_members WHERE account_id=$1',[id]);
 }else if(d.action==='kick'){
 if(!can('expulsar')||!validUUID(target)||target===own.leader||target===id)throw fail('No puedes expulsar a este miembro');await c.query('DELETE FROM gg_v15_clan_members WHERE account_id=$1 AND clan_id=$2',[target,own.id]);
 }else if(d.action==='permissions'){
 if(!own||own.leader!==id||!validUUID(target)||target===id||!Array.isArray(d.permissions)||d.permissions.some(k=>!PERMISSIONS.includes(k)))throw fail('Permisos inválidos');await c.query('UPDATE gg_v15_clan_members SET permissions=$3 WHERE account_id=$1 AND clan_id=$2',[target,own.id,[...new Set(d.permissions)]]);
 }else if(d.action==='diplomacy'){
 if(!can('diplomacia')||!validUUID(target)||target===own.id||!['war','alliance','neutral'].includes(d.state))throw fail('Diplomacia inválida');
 if(d.state==='neutral')await c.query('DELETE FROM gg_v15_clan_diplomacy WHERE source=$1 AND target=$2',[own.id,target]);else await c.query('INSERT INTO gg_v15_clan_diplomacy(source,target,state) VALUES($1,$2,$3) ON CONFLICT(source,target) DO UPDATE SET state=EXCLUDED.state',[own.id,target,d.state]);
 }else if(d.action==='tax'){
 if(!own||own.leader!==id||!Number.isInteger(d.credit)||d.credit<0||d.credit>5||!Number.isInteger(d.uridium)||d.uridium<0||d.uridium>3)throw fail('Impuesto inválido');await c.query('UPDATE gg_v15_clans SET credit_tax=$2,uridium_tax=$3 WHERE id=$1',[own.id,d.credit,d.uridium]);
 }else throw fail('Acción inválida');
 await c.query('COMMIT');return view(id);
 }catch(e){await c.query('ROLLBACK').catch(()=>{});if(e.code==='23505')throw fail('Nombre, etiqueta o membresía ya existe');if(e.code==='23503')throw fail('Clan o piloto no disponible');throw e;}finally{c.release();}}
 // Charge once per elapsed period, on the current balance. No retroactive catch-up.
 async function collectTaxes(){
  const due=(await pool.query("SELECT account_id FROM gg_v15_clan_members WHERE credit_tax_at<=now()-interval '24 hours' OR uridium_tax_at<=now()-interval '7 days' ORDER BY LEAST(credit_tax_at,uridium_tax_at) LIMIT 20")).rows;
  const changed=[];
  for(const {account_id:id} of due){const c=await pool.connect();try{await c.query('BEGIN');
   const p=(await c.query('SELECT credits,uridium FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];
   const m=(await c.query("SELECT m.clan_id,c.credit_tax,c.uridium_tax,m.credit_tax_at<=now()-interval '24 hours' AS cd,m.uridium_tax_at<=now()-interval '7 days' AS ud FROM gg_v15_clan_members m JOIN gg_v15_clans c ON c.id=m.clan_id WHERE m.account_id=$1 FOR UPDATE OF m,c",[id])).rows[0];
   if(p&&m&&(m.cd||m.ud)){
    const credits=m.cd?BigInt(p.credits)*BigInt(m.credit_tax)/100n:0n,uridium=m.ud?BigInt(p.uridium)*BigInt(m.uridium_tax)/1000n:0n;
    const balance=(await c.query('UPDATE player_progress SET credits=credits-$2,uridium=uridium-$3,updated_at=now() WHERE account_id=$1 RETURNING credits,uridium',[id,String(credits),String(uridium)])).rows[0];
    await c.query('UPDATE gg_v15_clans SET credits=credits+$2,uridium=uridium+$3 WHERE id=$1',[m.clan_id,String(credits),String(uridium)]);
    await c.query('UPDATE gg_v15_clan_members SET credit_tax_at=CASE WHEN $2 THEN now() ELSE credit_tax_at END,uridium_tax_at=CASE WHEN $3 THEN now() ELSE uridium_tax_at END WHERE account_id=$1',[id,m.cd,m.ud]);
    await c.query('COMMIT');if(credits||uridium)changed.push({id,credits:String(credits),uridium:String(uridium),balance});
   }else await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK').catch(()=>{});console.error('Clan tax:',e.code||e.message);}finally{c.release();}}
  return changed;
 }
 async function tags(ids){if(!ids.length)return [];return (await pool.query('SELECT m.account_id,c.tag FROM gg_v15_clan_members m JOIN gg_v15_clans c ON c.id=m.clan_id WHERE m.account_id=ANY($1::uuid[])',[ids])).rows;}
 return {ready,view,action,collectTaxes,tags,membership:id=>membership(pool,id)};
}
module.exports={createClans,PERMISSIONS};
