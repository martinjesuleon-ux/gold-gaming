'use strict';
// Bonus box categories and percentages from supplied wiki. Quantity weights are provisional.
const BONUS=[["LCB-10",34,[10,15,20,50,75]],["credits",20,[200,500,1000]],["uridium",17,[20,50,75,100]],["MCB-25",13,[5,25]],["MCB-50",8,[15]],["SAB-50",6,[5,10,25]],["gate-energy",2,[1]]];
function bonusLoot(roll,amountRoll){
 if(!Number.isInteger(roll)||roll<0||roll>=100||!Number.isFinite(amountRoll)||amountRoll<0||amountRoll>=1)throw Error('Invalid roll');
 for(const [code,weight,values] of BONUS){if(roll<weight){return {code,quantity:values[Math.min(values.length-1,Math.floor(amountRoll*amountRoll*values.length))]};}roll-=weight;}
 throw Error('Invalid loot table');
}
// Wiki: probabilities in tenths of a percent, ranges inclusive.
const PIRATE=[
 ['ammo',209,1000,3000,[['LCB-10',30],['MCB-25',25],['MCB-50',20],['UCB-100',10],['SAB-50',10],['RSB-75',5]]],
 ['xenomit',169,1000,5000],
 ['rockets',120,100,100,[['R-310',40],['PLT-2021',30],['PLT-2026',20],['PLT-3030',10]]],
 ['mines',80,3,5,[['DDM-01',1],['EMP',1]]],
 ['log-disk',80,3,20],['jump-voucher',60,3,10],['gate-energy',60,1,8],
 ['apis-piece',50,1,1],['zeus-piece',50,1,1],
 ['booster',35,1,1,['honor','damage','shield','repair','experience','hp'].map(x=>['booster-'+x+'-seconds',1]),'booster'],
 ['equipment',30,1,1,[['LF-3',30,'lasers'],['SG3N-B02',30,'shields'],['CLO4K-CPU',20,'cpus']]],
 ['design',15,1,1,['Bastion','Enforcer','Saturn','Veteran','Centaur','Exalted','Revenge','Avenger','Lightning'].map(x=>[x,1,'ship-designs'])],
 ['SG3N-B03',12,1,1,null,'shields'],['LF-4',12,1,1,null,'lasers'],
 ['premium-design',10,1,1,['Diminisher','Sentinel','Spectrum','Solace','Venom'].map(x=>[x,1,'ship-designs'])],
 ['apis',4,1,1,null,'drones'],['zeus',4,1,1,null,'drones']
];
function pirateLoot(roll,subRoll=0,amountRoll=0){
 if(!Number.isInteger(roll)||roll<0||roll>=1000||![subRoll,amountRoll].every(x=>Number.isFinite(x)&&x>=0&&x<1))throw Error('Invalid pirate roll');
 for(const [name,weight,min,max,group,category] of PIRATE){
  if(roll>=weight){roll-=weight;continue;}
  let code=name,type=category;
  if(group){let pick=subRoll*group.reduce((n,x)=>n+x[1],0);for(const [item,w,cat] of group){if(pick<w){code=item;type=cat||category;break;}pick-=w;}}
  const quantity=min+Math.floor(amountRoll*(max-min+1));return {code,quantity,...(type?{category:type}:{})};
 }
 throw Error('Invalid pirate loot table');
}
// Event target probabilities are exact; other rows share the remaining probability
// proportionally because the wiki does not specify how to redistribute it.
function pirateEventWeights({helix=false,apisZeus=false}={}){
 const boosts={'LF-4':helix?1.5:1,'apis-piece':apisZeus?1.8:1,'zeus-piece':apisZeus?1.2:1,apis:apisZeus?1.5:1,zeus:apisZeus?1.5:1};
 let fixed=0,original=0;
 for(const [code,weight] of PIRATE)if((boosts[code]||1)!==1){fixed+=weight*boosts[code];original+=weight;}
 return PIRATE.map(([code,w])=>(boosts[code]||1)!==1?w*boosts[code]:w*(1000-fixed)/(1000-original));
}
function pirateEventsForDay(now=new Date(),env=process.env){
 const day=now.toISOString().slice(0,10),matches=key=>String(env[key]||'').split(',').map(x=>x.trim()).includes(day);
 return {helix:matches('GG_HELIX_DATES'),apisZeus:matches('GG_APIS_ZEUS_DATES')};
}
function pirateEventLoot(roll,subRoll,amountRoll,events){
 if(!Number.isFinite(roll)||roll<0||roll>=1)throw Error('Invalid pirate event roll');
 const weights=pirateEventWeights(events);let remaining=roll*1000,offset=0;
 for(let i=0;i<PIRATE.length;i++){if(remaining<weights[i]||i===PIRATE.length-1)return pirateLoot(offset,subRoll,amountRoll);remaining-=weights[i];offset+=PIRATE[i][1];}
}
module.exports={BONUS,bonusLoot,PIRATE,pirateLoot,pirateEventWeights,pirateEventsForDay,pirateEventLoot};
