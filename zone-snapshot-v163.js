'use strict';
// One projection per entity and one common snapshot per occupied zone per broadcast.
function buildZoneSnapshots({players,npcs,mines,boxes,zoneOf,publicPlayer,isHidden,common}){
 const zones=new Map();
 for(const p of players){const zone=zoneOf(p);let z=zones.get(zone);if(!z){z={viewers:[],visible:[],hidden:new Map(),npcs:[],mines:[],boxes:[]};zones.set(zone,z);}const view=publicPlayer(p);z.viewers.push(p);if(isHidden(p))z.hidden.set(p.id,view);else z.visible.push(view);}
 for(const n of npcs){const z=zones.get(zoneOf(n));if(z){const {dest,lastShot,damage,reward,speed,lastHit,target,zone,...view}=n;z.npcs.push(view);}}
 for(const m of mines){const z=zones.get(m.zone);if(z){const {id,x,y,code,armedAt}=m;z.mines.push({id,x,y,code,armedAt});}}
 for(const b of boxes){const z=zones.get(b.zone);if(z){const {id,x,y,kind}=b;z.boxes.push({id,x,y,kind});}}
 for(const [zone,z] of zones){z.common={...common(zone),npcs:z.npcs,mines:z.mines,boxes:z.boxes};}
 return zones;
}
function snapshotFor(z,viewer){if(!z.hidden.size)return {...z.common,players:z.visible};const own=z.hidden.get(viewer.id);return {...z.common,players:own?[...z.visible,own]:z.visible};}
module.exports={buildZoneSnapshots,snapshotFor};
