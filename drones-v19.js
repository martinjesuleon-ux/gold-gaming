'use strict';
const {rank}=require('./formations-v19');
const SHIPS=['phoenix','yamato','leonov','defcom','liberator','piranha','nostromo','vengeance','bigboy','goliath'];
const ALIENS={Kristallon:[75,70,65,60,55,50,40,30,24,18],Lordakium:[60,55,50,45,40,35,30,25,20,15],Sibelon:[50,45,40,35,30,25,22,19,17,12],Devolarium:[40,35,30,25,20,15,10,9,8,7],Kristallin:[30,25,20,18,16,14,12,10,7,4],Sibelonit:[20,18,16,14,12,10,8,6,4,3],Mordon:[16,14,12,10,8,6,4,2,1,1],StreuneR:[15,13,11,9,7,5,4,3,2,1],Saimon:[10,9,8,7,6,5,4,3,2,1],Lordakia:[6,5,4,3,2,1,0,0,0,0],Streuner:[4,3,2,1,0,0,0,0,0,0]};
const PVP=[[10,8,6,4,2,1,0,0,0,0],[10,10,8,6,4,2,1,0,0,0],[10,10,10,8,6,4,2,1,0,0],[10,10,10,10,8,6,4,2,1,0],[10,10,10,10,10,8,6,4,2,1],[10,10,10,10,10,10,8,6,4,2],[10,10,10,10,10,10,10,8,6,4],[20,20,20,20,20,20,20,20,8,6],[20,20,20,20,20,20,20,20,20,8],[25,25,25,25,25,25,25,25,25,25]];
const index=ship=>SHIPS.includes(ship)?SHIPS.indexOf(ship):['aegis','citadel','spearhead'].includes(ship)?9:-1;
function points(ship,target,pvp=false){const i=index(ship);if(i<0)return 0;if(pvp)return PVP[index(target)]?.[i]||0;const name=String(target).replace(/^(?:(?:Boss|Uber|Emperor|Saturn)[ -]+)+/i,'');return ALIENS[name]?.[i]||0;}
function rankBonus(drones){const mean=drones.length?drones.reduce((n,d)=>n+rank(Number(d.points)||0),0)/drones.length:1;return {mean,damage:1+(mean-1)*.02,shield:1+(mean-1)*.04};}
function designBonus(design){return {damage:design==='Havoc'||design==='Spartan'?1.1:1,shield:design==='Hercules'||design==='Spartan'?1.1:1};}
const fail=message=>Object.assign(Error(message),{status:400});
async function ready(pool){await pool.query(`ALTER TABLE gg_v13_inventory ADD COLUMN IF NOT EXISTS drone_points integer NOT NULL DEFAULT 0; ALTER TABLE gg_v13_inventory ADD COLUMN IF NOT EXISTS drone_design uuid; CREATE UNIQUE INDEX IF NOT EXISTS gg_v19_unique_drone_design ON gg_v13_inventory(account_id,drone_design) WHERE drone_design IS NOT NULL;
DO $migration$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='gg_v13_inventory' AND column_name='drone_design_config2') THEN
  ALTER TABLE gg_v13_inventory ADD COLUMN drone_design_config2 uuid;
  UPDATE gg_v13_inventory SET drone_design_config2=drone_design WHERE category='drones';
 END IF;
END $migration$;
CREATE UNIQUE INDEX IF NOT EXISTS gg_v19_unique_drone_design_config2 ON gg_v13_inventory(account_id,drone_design_config2) WHERE drone_design_config2 IS NOT NULL;`);}
async function award(c,id,amount){if(!Number.isSafeInteger(amount)||amount<=0)return false;const h=(await c.query('SELECT configs,active FROM gg_v13_hangar WHERE account_id=$1',[id])).rows[0];const ids=(h?.configs?.[h.active]?.drones||[]).map(d=>d.id);if(!ids.length)return false;
 const rows=(await c.query("SELECT instance_id,drone_points FROM gg_v13_inventory WHERE account_id=$1 AND category='drones' AND instance_id=ANY($2::uuid[])",[id,ids])).rows;
 if(!rows.length)return false;await c.query("UPDATE gg_v13_inventory SET drone_points=LEAST(3100,drone_points+$3) WHERE account_id=$1 AND category='drones' AND instance_id=ANY($2::uuid[])",[id,ids,amount]);return rows.some(r=>rank(r.drone_points)!==rank(Math.min(3100,r.drone_points+amount)));}
const designColumns=['drone_design','drone_design_config2'];
const configValid=n=>n===0||n===1;
async function read(c,id,config){
 if(config!==undefined&&!configValid(config))throw fail('Configuración inválida');
 if(config===undefined){const h=(await c.query('SELECT active FROM gg_v13_hangar WHERE account_id=$1',[id])).rows[0];config=h?.active===1?1:0;}
 const rows=(await c.query("SELECT i.instance_id AS \"instanceId\",i.code,i.category,i.level,i.drone_points AS points,i.drone_design AS \"designId\",d.code AS design,i.drone_design_config2 AS \"designId2\",d2.code AS \"design2\" FROM gg_v13_inventory i LEFT JOIN gg_v13_inventory d ON d.account_id=i.account_id AND d.instance_id=i.drone_design AND d.category='drone-designs' LEFT JOIN gg_v13_inventory d2 ON d2.account_id=i.account_id AND d2.instance_id=i.drone_design_config2 AND d2.category='drone-designs' WHERE i.account_id=$1 AND i.category IN ('drones','drone-designs') ORDER BY i.code,i.instance_id",[id])).rows;
 const configurations=[0,1].map(n=>rows.filter(r=>r.category==='drones').map(({designId2,design2,...r})=>({...r,designId:n===1?designId2:r.designId,design:n===1?design2:r.design,rank:rank(r.points)})));
 return {config,drones:configurations[config],configurations,designs:rows.filter(r=>r.category==='drone-designs')};
}
async function equipDesign(c,id,droneId,designId,config){const d=await read(c,id,config);if(!d.drones.some(x=>x.instanceId===droneId))throw fail('VANT no adquirido');if(designId!==null&&(!d.designs.some(x=>x.instanceId===designId&&['Havoc','Hercules','Spartan'].includes(x.code))||d.drones.some(x=>x.instanceId!==droneId&&x.designId===designId)))throw fail('Diseño no disponible');await c.query("UPDATE gg_v13_inventory SET "+designColumns[d.config]+"=$3 WHERE account_id=$1 AND instance_id=$2 AND category='drones'",[id,droneId,designId]);return read(c,id,d.config);}
module.exports={points,rankBonus,designBonus,ready,award,read,equipDesign};
