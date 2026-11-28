'use strict';
// Static map geometry is identical across viewers and ticks. Keep only catalog zones.
function createMapGeometry({maps,homeBase,portals,w,h}){
 const entries=new Map(),empty=Object.freeze({base:null,portals:Object.freeze([])});
 for(const zone of Object.keys(maps)){
  const base=homeBase(zone,w,h),routes=portals(zone,w,h);
  entries.set(zone,Object.freeze({base:base?Object.freeze({...base}):null,portals:Object.freeze(routes.map(p=>Object.freeze({...p})))}));
 }
 return zone=>entries.get(zone)||empty;
}
module.exports={createMapGeometry};
