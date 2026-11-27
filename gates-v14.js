'use strict';
// Alpha: 34 pieces, 3 lives and 10 waves from the supplied screenshot.
// Spin price from the wiki. Spin odds and non-piece rewards are provisional.
const ALPHA=Object.freeze({id:'alpha',name:'Alpha',pieces:34,lives:3,waves:10,price:100});
const GATES=['alpha','beta','gamma','delta','epsilon','zeta','kappa','lambda','kronos','hades'];
function spinAlpha(state,roll,index,useMultiplier=false){
 if(!Number.isInteger(roll)||roll<0||roll>=100||!Number.isInteger(index)||index<1||index>34)throw Error('Invalid roll');
 const pieces=new Set(state.pieces),multiplier=state.multiplier;
 if(pieces.size>=34)throw Error('Puerta completa');
 if(roll>=20)return {pieces:[...pieces],multiplier:useMultiplier?1:multiplier,reward:{code:'LCB-10',quantity:100*(useMultiplier?multiplier:1)}};
 if(pieces.has(index)&&!useMultiplier)return {pieces:[...pieces],multiplier:Math.min(6,multiplier+1),reward:{code:'multiplier',quantity:Math.min(6,multiplier+1)}};
 let awarded=0,limit=useMultiplier?multiplier:1;
 for(let offset=0;offset<34&&awarded<limit;offset++){
  const piece=1+(index-1+offset)%34;
  if(pieces.has(piece))continue;
  pieces.add(piece);awarded++;
 }
 return {pieces:[...pieces].sort((a,b)=>a-b),multiplier:useMultiplier?1:multiplier,reward:{code:'piece',quantity:awarded}};
}
module.exports={ALPHA,GATES,spinAlpha};
