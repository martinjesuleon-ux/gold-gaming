'use strict';
// Determine next wave step from live enemies and queued groups, without changing rewards.
function waveStep(enemies,queue,spawn){
 const alive=enemies.filter(n=>n.hp>0);
 if(alive.some(n=>!n.gateShielded))return 'combat';
 while(queue.length){const [group,index]=queue.shift();if(spawn(group,index)>0)return 'spawned';}
 if(alive.length){for(const n of alive)n.gateShielded=false;return 'unshielded';}
 return 'clear';
}
function missingKillKeys(groupIndex,count,kills,existing){
 const result=[],seen=new Set([...kills,...existing]);
 for(let i=0;i<count;i++){const key=groupIndex+':'+i;if(!seen.has(key))result.push({i,key});}
 return result;
}
module.exports={waveStep,missingKillKeys};
