'use strict';
// Preserve insertion order for ties; eligibility is checked against live objects.
function groupByZone(items,zoneOf){const index=new Map();for(const item of items){const zone=zoneOf(item);let list=index.get(zone);if(!list){list=[];index.set(zone,list);}list.push(item);}return index;}
function nearestEligible(origin,candidates,maxDistance,eligible){let nearest=null,best=maxDistance;for(const p of candidates){const d=Math.hypot(origin.x-p.x,origin.y-p.y);if(d<best&&eligible(p)){nearest=p;best=d;}}return nearest;}
module.exports={groupByZone,nearestEligible};
