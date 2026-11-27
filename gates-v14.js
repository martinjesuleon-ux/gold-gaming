'use strict';
const DEFS=Object.freeze(Object.fromEntries([
 ['alpha',34,10],['beta',48,10],['gamma',82,10],['delta',128,10],['epsilon',99,30],['zeta',111,10],['kappa',120,11],['lambda',45,7],['hades',45,3],['kronos',21,13]
].map(([id,pieces,waves])=>[id,{id,name:id[0].toUpperCase()+id.slice(1),pieces,waves,lives:3,price:100,countdown:['zeta','kappa'].includes(id)?20:id==='hades'?30:15}])));
const GATES=Object.keys(DEFS),ALPHA=DEFS.alpha,SHARED=['alpha','beta','gamma'];
const KRONOS={alpha:4,beta:3,gamma:1,delta:1,epsilon:4,zeta:1,kappa:2,lambda:5};
const AMMO=[['LCB-10',100],['MCB-25',100],['MCB-50',100],['UCB-100',100],['SAB-50',100],['PLT-2026',10],['PLT-2021',10],['ECO-10',10],['ACM-01',2]];
const alpha=[['Streuner',20],['Lordakia',20],['Mordon',24],['Saimon',40],['Devolarium',20],['Kristallin',40],['Sibelon',20],['Sibelonit',80],['Kristallon',16],['Protegit',20]];
const WAVES={alpha:alpha.map(g=>[g]),beta:alpha.map((g,i)=>[[g[0],i===2?40:i===3?20:g[1],2]]),gamma:alpha.map((g,i)=>[[g[0],i===7?40:g[1],3]]),
 delta:[[['Lordakia',5,2],['Saimon',15,2],['Mordon',10,2]],[['Streuner',11,2],['StreuneR',1,4]],[['Mordon',5,2],['Kristallin',15,2],['Saimon',10,2]],[['Lordakia',12,4],['Lordakium',1,2]],[['Boss Lordakia',10],['Boss Saimon',6],['Boss Mordon',8]],[['Sibelonit',15,2],['Sibelon',1,3]],[['Sibelonit',5,2],['Kristallin',10,3],['Boss StreuneR',5]],[['Kristallin',10,3],['Kristallon',1,2]],[['Protegit',15,2],['Boss Lordakium',3]],[['DemaNeR',3]]],
 zeta:[[['Infernal',10]],[['Infernal',9],['Scorher',3]],[['Infernal',5],['Scorher',7]],[['Scorher',9]],[['Scorher',8],['Melter',2]],[['Scorher',3],['Melter',6]],[['Melter',10]],[['Melter',13]],[['Devourer',1,1,true],['Infernal',6]],null],
 kappa:[[['Streuner',10],['Vagrant',10],['Infernal',10]],[['Marauder',6],['Scorher',7],['Boss Mordon',8]],[['Outcast',6],['Devolarium',3],['Icy',3]],[['Boss Sibelonit',5],['Corsair',5],['Scorher',7]],[['Hooligan',4],['Kristallin',5],['Melter',4]],[['Interceptor',8],['Barracuda',6],['Annihilator',3]],[['Boss Lordakium',6],['Protegit',8],['Boss Sibelon',2]],[['Kucurbium',6],['Uber Saimon',8]],[['Convict',5],['Boss Kristallin',5],['DemaNeR',1]],[['Boss Kucurbium',1]],[['Century-Falcon',1]]],
 hades:[['Sibelon','Boss Sibelon','Uber Sibelon','Emperor-Sibelon'],['Lordakium','Boss Lordakium','Uber-Lordakium','Emperor-Lordakium'],['Kristallon','Boss Kristallon','Uber-Kristallon','Emperor-Kristallon']].map(g=>g.map((n,i)=>[n,[30,10,4,1][i]]))};
// Zeta 10 is not specified by alien name in the source; do not invent it.
const PLAYABLE=['alpha','beta','gamma','delta','kappa'];
const REWARDS={alpha:[20000,4000000,100000,20000,2,200,2,0],beta:[40000,8000000,200000,40000,4,400,4,0],gamma:[60000,12000000,300000,60000,10,600,6,0],delta:[45000,9000000,225000,45000,8,450,5,0],epsilon:[25000,5000000,150000,20000,10,0,0,5],zeta:[35000,6000000,200000,25000,50,0,0,25],kappa:[15000,9000000,325000,30000,10,0,0,5],lambda:[15000,2750000,100000,10000,3,0,0,5],hades:[20000,4000000,200000,15000,8,0,0,4],kronos:[25000,12000000,450000,25000,15,0,0,10]};
function spinGate(rows,gate,roll,random,useMultiplier=false){
 if(!DEFS[gate]||gate==='kronos'||!Number.isInteger(roll)||roll<0||roll>=100)throw Error('Tirada inválida');
 const current=rows[gate],multiplier=current.multiplier;
 const candidates=(SHARED.includes(gate)?SHARED:[gate]).filter(k=>(!SHARED.includes(gate)||!rows[k].built)&&rows[k].pieces.length<DEFS[k].pieces);
 if(roll>=67&&roll<80&&candidates.length){
  const target=candidates[random(candidates.length)],pieces=new Set(rows[target].pieces),amount=useMultiplier?multiplier:1;
  let awarded=0;for(let i=1;i<=DEFS[target].pieces&&awarded<amount;i++)if(!pieces.has(i)){pieces.add(i);awarded++;}
  return {target,pieces:[...pieces].sort((a,b)=>a-b),multiplier:useMultiplier?1:multiplier,reward:{code:'piece',gate:target,quantity:awarded}};
 }
 let reward;
 if(roll<67||(roll<80&&!candidates.length)){const [code,quantity]=AMMO[random(AMMO.length)];reward={code,quantity};}
 else if(roll<92)reward={code:'xenomit',quantity:10};
 else if(roll<96)reward={code:'nanohull-percent',quantity:2.5};
 else if(roll<99)reward={code:'repair-voucher',quantity:1};
 else reward={code:'log-disk',quantity:1};
 return {multiplier:Math.min(6,multiplier+1),reward};
}
function itemDraw(gate,first,roll){
 if(gate==='epsilon')return first||roll<250?'LF-4':null;
 if(gate==='zeta')return first||roll<450?'Havoc':null;
 if(gate==='hades')return roll<250?'LF-4':null;
 if(gate==='kappa')return roll<375?'Hercules':roll<625?'LF-4':roll<875?'MUL-B03':roll<975?'SG3N-B03':null;
 if(gate==='kronos')return roll<200?'Saturn':roll<400?'Spartan':null;
 return null;
}
module.exports={DEFS,GATES,ALPHA,SHARED,KRONOS,AMMO,WAVES,PLAYABLE,REWARDS,spinGate,itemDraw};
