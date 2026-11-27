'use strict';
const NAMES=Object.freeze({uridium:'Uridium x2',gateSpecial:'Galaxy Gates x2',hitac:'Hitac',ice:'Meteorito de Hielo',spaceball:'Spaceball',invasion:'Invasión','hitac-lottery':'Lotería Hitac'});
function upcomingEvents(rows,bonuses,now=Date.now()){
 const out=[];
 for(const row of rows||[]){const at=Date.parse(row.start_at);if(!Object.hasOwn(NAMES,row.kind)||row.status!=='pending'||!Number.isFinite(at)||at<=now)continue;out.push({kind:row.kind,startAt:new Date(at).toISOString(),...(row.kind==='ice'&&typeof row.payload?.map==='string'?{map:row.payload.map}:{}),...(row.kind==='invasion'&&['easy','medium','hard'].includes(row.payload?.difficulty)?{difficulty:row.payload.difficulty}:{})});}
 for(const [kind,state] of Object.entries(bonuses||{})){const at=Date.parse(state?.startAt);if(!Object.hasOwn(NAMES,kind)||state?.mode!=='scheduled'||!Number.isFinite(at)||at<=now)continue;out.push({kind,startAt:new Date(at).toISOString(),endAt:state.endAt});}
 return out.sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)||a.kind.localeCompare(b.kind)).slice(0,12);
}
function createSnapshotCache(load,{ttl=3000,clock=Date.now}={}){
 let cached=null,expires=0,inflight=null,generation=0;
 async function read(){if(cached&&clock()<expires)return cached;if(inflight)return inflight;const epoch=generation;const job=Promise.resolve().then(load).then(value=>{if(epoch===generation){cached=value;expires=clock()+ttl;}return value;}).finally(()=>{if(inflight===job)inflight=null;});inflight=job;return job;}
 read.invalidate=()=>{generation++;cached=null;expires=0;inflight=null;};return read;
}
module.exports={NAMES,upcomingEvents,createSnapshotCache};
