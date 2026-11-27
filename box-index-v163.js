'use strict';
// Maintain the canonical map and ordered per-zone indexes together.
class BoxIndex extends Map{
 constructor(){super();this.zones=new Map();}
 set(id,box){const old=this.get(id);if(old&&old.zone!==box.zone)this.delete(id);let zone=this.zones.get(box.zone);if(!zone){zone=new Map();this.zones.set(box.zone,zone);}zone.set(id,box);super.set(id,box);return this;}
 delete(id){const box=this.get(id);if(!box)return false;const zone=this.zones.get(box.zone);zone?.delete(id);if(zone&&!zone.size)this.zones.delete(box.zone);return super.delete(id);}
 clear(){super.clear();this.zones.clear();}
 inZone(zone){return this.zones.get(zone)?.values()||[];}
}
function petEligible(p,b){return !b.pending&&b.kind!=='pirate'&&(b.kind!=='cargo'||b.owner===p.accountId);}
function petResourceEligible(p,b,now=Date.now()){return !!b&&['cargo','paladio'].includes(b.kind)&&petEligible(p,b)&&!p.cargoBusy&&!(p.cargoRetry>now)&&(!b.expires||b.expires>now)&&Object.values(b.contents||{}).some(n=>Number(n)>0);}
module.exports={BoxIndex,petEligible,petResourceEligible};
