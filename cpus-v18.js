'use strict';
const CPUS=[
 {id:'SL-01',slots:2,price:600000,currency:'credits'},
 {id:'SL-02',slots:4,price:75000,currency:'uridium'},
 {id:'SL-03',slots:6,price:150000,currency:'uridium'},
 {id:'SL-04',slots:10,price:250000,currency:'uridium'},
 ...[['R0K-T01',10000],['AROL-X',25000],['RL-LB1',25000],['MIN-T02',25000],['ISH-01',50000],['SMB-01',50000],['AIM-02',200000],['NC-AWB',10000],['NC-RRB',10000],['AJP-01',15000],['GEMINEX-XI',10000]].map(([id,price])=>({id,price,currency:'uridium'})),
 {id:'CLO4K-CPU',uses:10,price:5000,currency:'uridium'},
 {id:'CLO4K-XL-CPU',uses:50,price:22500,currency:'uridium'}
];
const ROBOTS=[{id:'REP-S',perMinute:1000,price:30000,currency:'credits'},{id:'REP-1',seconds:165,price:10000,currency:'credits'},{id:'REP-2',seconds:120,price:64000,currency:'credits'},{id:'REP-3',seconds:105,price:5000,currency:'uridium'},{id:'REP-4',seconds:90,price:20000,currency:'uridium'}];
function repairRate(code,maxHp){const r=ROBOTS.find(x=>x.id===code);return !r?0:r.perMinute?r.perMinute/60:maxHp/r.seconds;}
function extraStats(ship,items){const cpus=[],seen=new Set();let robot=null,slots=0,used=0,launcher=null;
 for(const i of items){const c=CPUS.find(x=>x.id===i.code),r=ROBOTS.find(x=>x.id===i.code);if(c){if(seen.has(c.id)||c.slots&&slots)throw Error('CPU duplicado o abridor de slots repetido');seen.add(c.id);cpus.push(c.id);slots+=c.slots||0;used++;}else if(r){if(robot)throw Error('Solo un robot por configuración');robot=r.id;used++;}else if(['HST-1','HST-2'].includes(i.code)){if(launcher)throw Error('Solo un lanzador por configuración');launcher=i.code;}}
 if(used>ship.extras+slots)throw Error('Espacios de extras excedidos');
 return {cpus,robot,slots,used,launcher};
}
module.exports={CPUS,ROBOTS,repairRate,extraStats};
