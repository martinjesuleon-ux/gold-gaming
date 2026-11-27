'use strict';
const MAPS={};
for(let c=1;c<=3;c++)for(let n=1;n<=8;n++)MAPS[c+'-'+n]={id:c+'-'+n,company:c,pvp:n>2,base:n===1||n===8};
for(let n=1;n<=5;n++)MAPS['4-'+n]={id:'4-'+n,company:n<=3?n:0,pvp:true,base:false};
for(let n=1;n<=3;n++)MAPS['5-'+n]={id:'5-'+n,company:0,pvp:true,base:n===2,pirate:true};
const routes=[];
function link(from,to,ally,enemy){routes.push({from,to,ally,enemy});}
for(let c=1;c<=3;c++){
 const x=n=>c+'-'+n;
 for(const [a,b,l,e] of [[1,2,1,13],[2,1,1,16],[2,3,2,5],[2,4,3,5],[3,4,3,5],[5,6,11,15],[5,7,11,15],[6,8,12,17],[7,8,12,17]])link(x(a),x(b),l,e);
 link(x(4),'4-'+c,8,8);link('4-'+c,'4-4',9,9);link('4-4',x(5),10,14);link(x(5),'4-5',11,15);
 for(let d=1;d<=3;d++)if(d!==c){link(x(3),d+'-3',5,5);link(x(4),d+'-4',5,5);link('4-'+c,'4-'+d,8,8);}
}
for(const [a,b,l] of [['4-5','5-1',14],['5-1','5-2',14],['5-2','5-3',16],['5-3','4-4',16]])link(a,b,l,l);
function portals(map,w=12000,h=8000){const list=routes.filter(r=>r.from===map);return list.map((r,i)=>{const a=2*Math.PI*i/list.length;return {...r,id:r.from+'>'+r.to,x:Math.round(w/2+Math.cos(a)*(w/2-650)),y:Math.round(h/2+Math.sin(a)*(h/2-650))};});}
function requiredLevel(route,company){const owner=MAPS[route.to]?.company||MAPS[route.from]?.company||0;return owner&&company!==owner?route.enemy:route.ally;}
function boxFactor(map,level){if(/^[123]-1$/.test(map))return level>=10?0:level===9?.13:level===8?.25:level===7?.5:1;if(/^4-[123]$/.test(map))return 1.5;return 1;}
function population(map){
 const n=Number(map.split('-')[1]);
 if(/^[123]-/.test(map)){
 if(n===1)return [['Streuner',60]];
 if(n===2)return [['Streuner',50],['Lordakia',50],['Boss Streuner',5],['Boss Lordakia',5]];
 const low=[['Lordakia',15],['Saimon',15],['Mordon',15],['Devolarium',8],['Boss Lordakia',3],['Boss Saimon',3],['Boss Mordon',3],['Boss Devolarium',2]];
 if(n===3)return low;if(n===4)return [...low,['Sibelon',8],['Boss Sibelon',3]];
 if(n===5)return [['Sibelonit',30],['Lordakium',15],['Boss Sibelonit',5],['Boss Lordakium',3]];
 if(n===6)return [['Kristallin',30],['Kristallon',15],['Cubikon',4],['Kristallin Infectado',5]];
 if(n===7)return [['Kristallin',30],['Kristallon',15],['Boss Kristallin',5],['Boss Kristallon',3]];
 return [['StreuneR',20],['Boss StreuneR',7]];
 }
 if(map==='4-5')return [['Uber-Streuner',10],['Uber-Lordakia',10],['Uber-Mordon',10],['Uber Saimon',10],['Uber-Sibelonit',10],['Uber-Devolarium',8],['Uber Kristallin',8],['Uber Sibelon',6],['Uber-Lordakium',6],['Uber-Kristallon',6],['Boss Kucurbium',10]];
 if(map==='5-1')return [['Interceptor',15],['Barracuda',15]];
 if(map==='5-2')return [['Interceptor',100],['Barracuda',15],['Saboteur',10],['Annihilator',5]];
 if(map==='5-3')return [['Deadly Battleray',4]];
 return [];
}
const GALAXY_ORDER=['alpha','beta','gamma','delta','epsilon','zeta','kappa','lambda','hades','kronos'];
const COMPANIES={1:{name:'MMO',color:'#f06452'},2:{name:'EIC',color:'#57aaff'},3:{name:'VRU',color:'#72df91'}};
function homeBase(map,w=12000,h=8000){
 if(!/^[123]-1$/.test(map))return null;
 const c=COMPANIES[Number(map[0])];return {x:w/2,y:h/2,radius:650,company:Number(map[0]),...c};
}
function galaxyPortals(map,company,built,w=12000,h=8000){
 const base=homeBase(map,w,h);if(!base||base.company!==company)return [];
 return GALAXY_ORDER.flatMap((gate,i)=>built.includes(gate)?[{id:'gg:'+gate,kind:'galaxy',gate,to:gate.toUpperCase(),x:base.x+(i%5-2)*220,y:base.y+(i<5?-270:270)}]:[]);
}
module.exports={MAPS,routes,portals,requiredLevel,population,boxFactor,GALAXY_ORDER,homeBase,galaxyPortals};
