'use strict';
const catalog=require('./data/catalog-v13.json');const {penalty}=require('./pvp-v15');
const MINERALS=['prometium','endurium','terbium','prometid','duranium','promerium','seprom','xenomit','paladio'];
const PRICES={prometium:10,endurium:15,terbium:25,prometid:50,duranium:75,promerium:150,seprom:300};
const RECIPES={prometid:{inputs:{prometium:20,endurium:10},fee:250},duranium:{inputs:{endurium:10,terbium:20},fee:250},promerium:{inputs:{prometid:10,duranium:10,xenomit:1},fee:2500},seprom:{inputs:{promerium:10},fee:10000,premium:true},xenomit:{inputs:{prometium:10,endurium:10,terbium:10},fee:0}};
const RAW=['prometium','endurium','terbium'];
const RATES=[0,2200,7400,15045,24890,36781,50604,66274,83720,102884,123715,146171,170212,195805,222919,251526,281600,313118,346059,380401,416126];
const MODULES=['solar','basic','storage','transport',...RAW,'xenomit','prometid','duranium','promerium','seprom'];
const PRODUCTION=MODULES.slice(4);
function supply(l){return 150+10*l+10*l*l;}
function demand(l){return l?15+l*l:0;}
function capacity(l,code){const raw=({1:105600,10:5938324,20:19974063})[l]??Math.floor(RATES[l]*48);if(RAW.includes(code))return raw;if(['prometid','duranium'].includes(code))return Math.floor(raw/20);if(code==='seprom')return Math.floor(raw/2200);return Math.floor(raw/200);}
function saleValue(code,n,honor){if(!PRICES[code])throw Error('Mineral no vendible');return Math.floor(n*Math.max(1,PRICES[code]*Math.min(2,1+honor/500000)));}
function cargoUsed(cargo){return MINERALS.filter(k=>k!=='xenomit').reduce((a,k)=>a+(Number(cargo[k])||0),0);}
// Only Cubikon quantities are explicit in the wiki; other alien drops are provisional.
function npcCargo(name,credits=0){if(name==='Cubikon')return {prometium:1200,endurium:1200,terbium:1200};const n=Math.max(1,Math.min(300,Math.floor(credits/800)));return {prometium:n*2,endurium:n,terbium:n};}
function fitCargo(contents,space){const taken={};for(const k of ['xenomit','seprom','promerium','duranium','prometid','terbium','endurium','prometium','paladio']){const n=Math.max(0,Math.floor(Number(contents[k])||0)),q=k==='xenomit'?n:Math.min(n,Math.max(0,space));if(q){taken[k]=q;if(k!=='xenomit')space-=q;}}return taken;}
function initial(now){return {levels:Object.fromEntries(MODULES.map(k=>[k,1])),enabled:Object.fromEntries(PRODUCTION.map(k=>[k,RAW.includes(k)])),stock:{},fraction:{},at:now};}
// Intermediate storage capacities use collector-rate ×48. Production uses a continuous,
// capped simulation, in at most one-hour increments, to preserve dependencies.
// Exact starting levels and upgrade costs are not supplied by the wiki; upgrades deferred.
function tick(lab,now){
 const elapsed=Math.max(0,Math.min(7*86400000,now-lab.at));
 let remaining=elapsed/3600000;
 const stock=lab.stock,fraction=lab.fraction,levels=lab.levels;
 const active=PRODUCTION.filter(k=>lab.enabled[k]&&levels[k]>0);
 const used=active.reduce((a,k)=>a+demand(levels[k]),0),power=supply(levels.solar),eff=used?Math.min(1,power/used):1;
 while(remaining>0){const hours=Math.min(1,remaining);remaining-=hours;
 for(const k of active){
 const recipe=RECIPES[k],rate=RATES[levels[k]]/(recipe?20:1),available=Math.max(0,capacity(levels.storage,k)-(stock[k]||0));
 let generated=rate*hours*eff+(fraction[k]||0),n=Math.min(Math.floor(generated),available);
 if(recipe)for(const [input,amount] of Object.entries(recipe.inputs))n=Math.min(n,Math.floor((stock[input]||0)/amount));
 fraction[k]=generated-Math.floor(generated);
 if(n<1)continue;
 if(recipe)for(const [input,amount] of Object.entries(recipe.inputs))stock[input]-=n*amount;
 stock[k]=(stock[k]||0)+n;
 }}
 lab.at=now;return {power,used,efficiency:eff};
}
function createMinerals(pool){
 const fail=message=>Object.assign(Error(message),{status:400});
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_v17_skylab(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,data jsonb NOT NULL);
 ALTER TABLE gg_v15_honor_penalty ADD COLUMN IF NOT EXISTS theft_step integer NOT NULL DEFAULT 0;
 ALTER TABLE gg_v15_honor_penalty ADD COLUMN IF NOT EXISTS theft_last bigint NOT NULL DEFAULT 0;
 CREATE TABLE IF NOT EXISTS gg_v17_mineral_requests(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_id uuid NOT NULL,response jsonb NOT NULL,PRIMARY KEY(account_id,request_id));`);}
 async function tx(id,fn){const c=await pool.connect();try{await c.query('BEGIN');const p=(await c.query('SELECT credits,uridium,honor FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];if(!p)throw fail('Piloto no disponible');const result=await fn(c,p);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async function labRow(c,id){const row=(await c.query('SELECT data FROM gg_v17_skylab WHERE account_id=$1',[id])).rows[0];return row?.data||initial(Date.now());}
 async function save(c,id,lab){await c.query('INSERT INTO gg_v17_skylab(account_id,data) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET data=EXCLUDED.data',[id,JSON.stringify(lab)]);}
 async function cargo(c,id){const rows=(await c.query('SELECT code,quantity FROM gg_v13_ammo WHERE account_id=$1 AND code=ANY($2::text[])',[id,MINERALS])).rows;return Object.fromEntries(rows.map(x=>[x.code,Number(x.quantity)]));}
 async function maxCargo(c,id){const row=(await c.query('SELECT ship FROM gg_v13_hangar WHERE account_id=$1',[id])).rows[0];const owned=(await c.query("SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND category='cpus' AND code='GEMINEX-XI' LIMIT 1",[id])).rowCount;return (catalog.ships.find(s=>s.id===(row?.ship||'phoenix'))?.cargo||100)*(owned?2:1);}
 async function add(c,id,k,n){if(!n)return;await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,k,n]);}
 async function take(c,id,k,n){const r=await c.query('UPDATE gg_v13_ammo SET quantity=quantity-$3 WHERE account_id=$1 AND code=$2 AND quantity>=$3 RETURNING quantity',[id,k,n]);if(!r.rowCount)throw fail('Mineral insuficiente: '+k);}
 async function view(c,id,p,lab){const metrics=tick(lab,Date.now());await save(c,id,lab);const b=await cargo(c,id),limit=await maxCargo(c,id);return {lab,metrics,cargo:b,cargoUsed:cargoUsed(b),capacity:limit,limits:Object.fromEntries(MINERALS.filter(k=>k!=='paladio').map(k=>[k,capacity(lab.levels.storage,k)])),rates:Object.fromEntries(PRODUCTION.map(k=>[k,RATES[lab.levels[k]]/(RECIPES[k]?20:1)])),prices:PRICES,recipes:RECIPES,balance:{credits:p.credits,uridium:p.uridium},honor:Number(p.honor),provisional:true};}
 async function collect(id,contents,owner){
 return tx(id,async(c,p)=>{
  const b=await cargo(c,id),limit=await maxCargo(c,id),taken=fitCargo(contents,limit-cargoUsed(b));
  if(!Object.keys(taken).length)return {taken,balance:p,penalty:0};
  let fine=0;
  if(owner&&owner!==id){const level=(await c.query('SELECT level FROM player_progress WHERE account_id=$1',[id])).rows[0].level;const prev=(await c.query('SELECT theft_step,theft_last FROM gg_v15_honor_penalty WHERE account_id=$1',[id])).rows[0];const step=penalty(level,prev?.theft_step||0,Number(prev?.theft_last||0),Date.now(),10);fine=step.amount;await c.query('INSERT INTO gg_v15_honor_penalty(account_id,theft_step,theft_last) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET theft_step=EXCLUDED.theft_step,theft_last=EXCLUDED.theft_last',[id,step.next,step.last]);await c.query('UPDATE player_progress SET honor=honor-$2 WHERE account_id=$1',[id,fine]);p.honor=String(Number(p.honor)-fine);}
  for(const [k,n] of Object.entries(taken))await add(c,id,k,n);
  return {taken,balance:p,penalty:fine};
 });}
 async function status(id){return tx(id,async(c,p)=>view(c,id,p,await labRow(c,id)));}
 async function action(id,d){if(!d||typeof d.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.requestId))throw fail('Solicitud inválida');
 return tx(id,async(c,p)=>{
 const prior=(await c.query('SELECT response FROM gg_v17_mineral_requests WHERE account_id=$1 AND request_id=$2',[id,d.requestId])).rows[0];if(prior)return prior.response;
 const lab=await labRow(c,id);tick(lab,Date.now());const b=await cargo(c,id),limit=await maxCargo(c,id),k=d.code,n=d.quantity;
 if(d.action==='toggle'){if(!PRODUCTION.includes(k)||typeof d.enabled!=='boolean')throw fail('Módulo inválido');lab.enabled[k]=d.enabled;}
 else{
 if(!MINERALS.includes(k)||!Number.isSafeInteger(n)||n<1||n>1000000)throw fail('Cantidad inválida');
 if(d.action==='transfer'){
 if(k==='paladio'||(lab.stock[k]||0)<n)throw fail('Existencia insuficiente en Skylab');
 if(k!=='xenomit'&&cargoUsed(b)+n>limit)throw fail('Bodega insuficiente');
 lab.stock[k]-=n;await add(c,id,k,n);
 }else if(d.action==='refine'){
 const r=RECIPES[k];if(!r||k==='xenomit'||r.premium)throw fail('Refinado no disponible');
 if(Number(p.credits)<r.fee*n)throw fail('Créditos insuficientes');
 for(const [input,amount] of Object.entries(r.inputs))await take(c,id,input,n*amount);
 await add(c,id,k,n);await c.query('UPDATE player_progress SET credits=credits-$2 WHERE account_id=$1',[id,r.fee*n]);p.credits=String(Number(p.credits)-r.fee*n);
 }else if(d.action==='sell'){
 const location=(await c.query('SELECT map FROM gg_v14_location WHERE account_id=$1',[id])).rows[0]?.map||'1-1';
 if(!/^[123]-[18]$/.test(location)&&location!=='5-2')throw fail('El comercio está disponible en un mapa con base');
 if(!PRICES[k])throw fail('Mineral no vendible');
 const payment=saleValue(k,n,Number(p.honor));await take(c,id,k,n);await c.query('UPDATE player_progress SET credits=credits+$2 WHERE account_id=$1',[id,payment]);p.credits=String(Number(p.credits)+payment);
 }else if(d.action==='exchange'){
 const location=(await c.query('SELECT map FROM gg_v14_location WHERE account_id=$1',[id])).rows[0]?.map;
 if(k!=='paladio'||location!=='5-2'||n%10!==0)throw fail('Cambia múltiplos de 10 Paladio en 5-2');
 await take(c,id,k,n);await add(c,id,'gate-energy',n/10);
 }else throw fail('Acción inválida');
 }
 const result=await view(c,id,p,lab);await c.query('INSERT INTO gg_v17_mineral_requests(account_id,request_id,response) VALUES($1,$2,$3)',[id,d.requestId,JSON.stringify(result)]);return result;
 });}
 return {ready,status,action,collect};
}
module.exports={MINERALS,PRICES,RECIPES,RATES,MODULES,initial,tick,supply,demand,capacity,cargoUsed,saleValue,npcCargo,fitCargo,createMinerals};
