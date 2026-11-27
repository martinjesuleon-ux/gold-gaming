'use strict';
// Maintenance tasks are independent: failure of one cannot skip subsequent work.
async function runMaintenance(tasks,onError=()=>{}){
 const failures=[];
 for(const [name,task] of tasks){try{await task();}catch(e){failures.push(name);try{onError(name,e);}catch{}}}
 return failures;
}
function onceAsync(fn){let pending;return (...args)=>pending||(pending=Promise.resolve().then(()=>fn(...args)));}
function trackPending(pending,fn){const job=Promise.resolve().then(fn);pending.add(job);job.then(()=>pending.delete(job),()=>pending.delete(job));return job;}
async function drainPending(pending){while(pending.size)await Promise.allSettled([...pending]);}
module.exports={runMaintenance,onceAsync,trackPending,drainPending};
