'use strict';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function pilotIds(env=process.env){return new Set(String(env.GG_PREMIUM_PILOTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(s=>uuid.test(s)));}
function premiumEnabled(env=process.env){return env.GG_PREMIUM_ENABLED==='1'||pilotIds(env).size>0;}
function premiumAllowed(id,env=process.env){return typeof id==='string'&&uuid.test(id)&&(env.GG_PREMIUM_ENABLED==='1'||pilotIds(env).has(id.toLowerCase()));}
module.exports={premiumEnabled,premiumAllowed,pilotIds};
