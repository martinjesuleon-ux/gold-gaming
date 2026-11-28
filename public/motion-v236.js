'use strict';
(function(root){
 const LIMIT=8,REMOTE_DELAY=120,LOCAL_LEAD=65,MAX_DRIFT=48;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const angle=(a,b,f)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*f;
 function record(history,p,serverTime,received){
  if(![p.x,p.y,p.angle,serverTime,received].every(Number.isFinite))return history;
  const last=history?.samples.at(-1);
  if(last&&serverTime<=last.t)return history;
  const sample={x:p.x,y:p.y,a:p.angle,t:serverTime};
  if(!last||serverTime-last.t>750||Math.hypot(p.x-last.x,p.y-last.y)>1100)
   return {samples:[sample],offset:received-serverTime,cursor:null};
  // Follow changes in arrival jitter gradually, rather than restarting the visual clock.
  history.offset+=clamp((received-serverTime-history.offset)*.12,-5,5);
  history.samples.push(sample);if(history.samples.length>LIMIT)history.samples.shift();
  return history;
 }
 function position(history,now,local=false){
  if(!history?.samples.length||!Number.isFinite(now))return null;
  const s=history.samples,last=s.at(-1),first=s[0],prev=s.at(-2);
  let t=now-history.offset-(local?0:REMOTE_DELAY);
  t=clamp(t,first.t,last.t+(local?LOCAL_LEAD:50));
  t=Math.max(history.cursor??first.t,t);history.cursor=t;
  for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i];if(t<=b.t){const f=clamp((t-a.t)/(b.t-a.t),0,1);return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,a:angle(a.a,b.a,f)};}}
  if(!prev||t<=last.t||last.t-prev.t>250)return {x:last.x,y:last.y,a:last.a};
  const factor=(t-last.t)/(last.t-prev.t),dx=(last.x-prev.x)*factor,dy=(last.y-prev.y)*factor,scale=Math.min(1,MAX_DRIFT/(Math.hypot(dx,dy)||1));
  return {x:last.x+dx*scale,y:last.y+dy*scale,a:last.a};
 }
 // Input anticipation is strictly visual, anchored to the latest server position.
 function anticipate(authoritative,intent,now,speed){
  if(!intent||![authoritative?.x,authoritative?.y,authoritative?.angle,intent.x,intent.y,intent.at,now,speed].every(Number.isFinite)||speed<0)return null;
  const age=now-intent.at;if(age<0||age>100)return null;
  const dx=intent.x-authoritative.x,dy=intent.y-authoritative.y,len=Math.hypot(dx,dy);if(len<1)return null;
  const step=Math.min(len,24,speed*age/1000);
  return {x:authoritative.x+dx/len*step,y:authoritative.y+dy/len*step,a:Math.atan2(dy,dx)};
 }
 // Update only the visual direction during the existing network throttle window.
 function preview(intent,x,y,now){if(!intent||![intent.at,x,y,now].every(Number.isFinite)||now<intent.at||now-intent.at>100)return intent;return {...intent,x,y};}
 // Pointer direction is independent of snapshot position. Never restart visual
 // translation when a new drag command refreshes its timestamp.
 function steer(position,intent,previousHeading){
  if(!position||!intent||![position.x,position.y,intent.x,intent.y].every(Number.isFinite))return position;
  const dx=intent.x-position.x,dy=intent.y-position.y;
  const a=Math.hypot(dx,dy)<8?(Number.isFinite(previousHeading)?previousHeading:position.a):Math.atan2(dy,dx);
  return {...position,a};
 }
 const api={record,position,angle,anticipate,preview,steer};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggMotion236=api;
})(typeof globalThis!=='undefined'?globalThis:this);
