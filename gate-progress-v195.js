'use strict';
function waveProgress(groups,kills=[],observed=[]){
 if(!Array.isArray(groups)||!groups.length)return null;
 const valid=new Set();
 for(let g=0;g<groups.length;g++)for(let i=0;i<groups[g][1];i++)valid.add(g+':'+i);
 const eliminated=new Set([...kills,...observed].filter(key=>valid.has(key))).size;
 return {total:valid.size,eliminated,remaining:valid.size-eliminated};
}
module.exports={waveProgress};
