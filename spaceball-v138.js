'use strict';
const crypto=require('node:crypto');
const {portals}=require('./maps-v14');
const RULES=Object.freeze({map:'4-4',goalRadius:150,resetMs:10000,boxCount:15,boxTtl:300000,range:600,pushPx:30});
const PUSH=Object.freeze({'LCB-10':1,'MCB-25':2,'MCB-50':3,'UCB-100':4,'RSB-75':6});
const REWARDS=Object.freeze({'RSB-75':[100,500],gateEnergy:[10,20],jumpVouchers:[1,5],repairVouchers:[1,5],credits:[5000,50000],uridium:[500,1000]});
const fail=message=>Object.assign(Error(message),{status:400});
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function createGame(now=Date.now(),w=12000,h=8000){
 const goals=portals('4-4',w,h).filter(p=>/^[123]-5$/.test(p.to)).map(p=>({company:Number(p.to[0]),x:p.x,y:p.y}));
 if(goals.length!==3)throw Error('Porterías no disponibles');
 return {id:crypto.randomUUID(),w,h,goals,ball:{x:w/2,y:h/2},scores:{1:0,2:0,3:0},boxes:new Map(),resetAt:0,active:true,startedAt:now};
}
function rewards(random=Math.random){return Object.fromEntries(Object.entries(REWARDS).map(([k,[a,b]])=>[k,a+Math.floor(clamp(random(),0,.999999999)*(b-a+1))]));}
function advance(g,now=Date.now()){for(const [id,b] of g.boxes)if(now>=b.expires)g.boxes.delete(id);if(g.resetAt&&now>=g.resetAt){g.ball={x:g.w/2,y:g.h/2};g.resetAt=0;}}
function intersection(a,b,c,r){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp(((c.x-a.x)*dx+(c.y-a.y)*dy)/l,0,1):0;return Math.hypot(a.x+dx*t-c.x,a.y+dy*t-c.y)<=r;}
function validateShot(g,p,code,now=Date.now()){
 advance(g,now);if(!g.active||g.resetAt||p?.zone!==RULES.map||![1,2,3].includes(p.company)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Object.hasOwn(PUSH,code))throw fail('Disparo inválido');
 const d=dist(p,g.ball);if(d>RULES.range||d<1)throw fail('Fuera de alcance');
 return d;
}
function shot(g,p,code,now=Date.now(),random=Math.random){
 const d=validateShot(g,p,code,now);
 const prev={...g.ball},step=PUSH[code]*RULES.pushPx;g.ball={x:clamp(prev.x+(prev.x-p.x)/d*step,0,g.w),y:clamp(prev.y+(prev.y-p.y)/d*step,0,g.h)};
 const goal=g.goals.find(x=>intersection(prev,g.ball,x,RULES.goalRadius));if(!goal)return {goal:null,ball:g.ball};
 // An own goal is not credited; reset without spawning rewards.
 if(goal.company!==p.company){g.scores[p.company]++;for(let i=0;i<RULES.boxCount;i++){const a=i*Math.PI*2/RULES.boxCount,id=crypto.randomUUID();g.boxes.set(id,{id,x:clamp(goal.x+200*Math.cos(a),0,g.w),y:clamp(goal.y+200*Math.sin(a),0,g.h),expires:now+RULES.boxTtl,rewards:rewards(random)});}}
 g.resetAt=now+RULES.resetMs;return {goal:goal.company,scorer:goal.company===p.company?null:p.company,ball:g.ball};
}
function view(g,now=Date.now()){advance(g,now);return {id:g.id,map:RULES.map,active:g.active,ball:g.resetAt?null:g.ball,goals:g.goals,scores:{...g.scores},resetAt:g.resetAt,boxes:[...g.boxes.values()].map(({id,x,y,expires})=>({id,x,y,expires}))};}
function preview(){return {rules:RULES,push:PUSH,rewards:REWARDS,enabled:process.env.GG_SPACEBALL_ENABLED==='1',claimsEnabled:false};}
module.exports={RULES,PUSH,REWARDS,createGame,advance,shot,validateShot,rewards,view,preview};
