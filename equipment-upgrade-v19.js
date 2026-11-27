'use strict';
const CREDIT=new Set(['LF-1','LF-2','SG3N-A01','SG3N-A02','SG3N-A03','flax']);
const fail=message=>Object.assign(Error(message),{status:400});
function eligible(item){return item&&((item.category==='lasers'&&/^LF-/.test(item.code))||(item.category==='shields'&&/^SG3N-/.test(item.code))||(item.category==='drones'&&['flax','iris','apis','zeus'].includes(item.code)));}
function quote(item,levels,now=Date.now()){if(!eligible(item)||!Number.isInteger(item.level)||item.level<1||!Number.isInteger(levels)||levels<1||item.level+levels>16)throw fail('Mejora inválida');const currency=CREDIT.has(item.code)?'credits':'uridium';let total=0,at=now;const steps=[];for(let n=item.level+1;n<=item.level+levels;n++){total+=(3905+435*(n-2))*(currency==='credits'?100:1);at+=(n-1)*120000;steps.push({level:n,at});}return {currency,total,steps,duration:at-now,target:item.level+levels};}
async function settle(c,id,now=Date.now()){
 const rows=(await c.query('SELECT instance_id,steps FROM gg_v19_equipment_jobs WHERE account_id=$1',[id])).rows;let nextDue=null,changed=0;
 for(const row of rows){const due=row.steps.filter(s=>s.at<=now),remaining=row.steps.filter(s=>s.at>now);if(due.length){await c.query('UPDATE gg_v13_inventory SET level=GREATEST(level,$3) WHERE account_id=$1 AND instance_id=$2',[id,row.instance_id,due.at(-1).level]);changed+=due.length;if(remaining.length)await c.query('UPDATE gg_v19_equipment_jobs SET steps=$3 WHERE account_id=$1 AND instance_id=$2',[id,row.instance_id,JSON.stringify(remaining)]);else await c.query('DELETE FROM gg_v19_equipment_jobs WHERE account_id=$1 AND instance_id=$2',[id,row.instance_id]);}if(remaining.length)nextDue=nextDue===null?remaining[0].at:Math.min(nextDue,remaining[0].at);}
 return {nextDue,changed};
}
module.exports={eligible,quote,settle};
