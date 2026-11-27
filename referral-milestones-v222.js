'use strict';
// Undefined special designs and unspecified shared booster composition are retained as pending grants.
const MILESTONES=Object.freeze({
 5:{days:7,stacks:{'gate-energy':250,'UCB-100':10000,'RSB-75':5000,'green-key':50,'jump-voucher':20},items:[['lasers','LF-3',5,1]]},
 15:{packs:{'QR-01':7},stacks:{'UCB-100':25000,'RSB-75':10000,'green-key':100},items:[['lasers','LF-4',1,1],['drone-designs','Spartan',1,1]],pending:{sharedCombatHours:5}},
 25:{days:30,packs:{'NBX-B01':7},stacks:{'gate-energy':5000,'RSB-75':50000,'UCB-100':150000},items:[['lasers','LF-4',3,1]],pending:{sharedCombatHours:10}},
 50:{days:90,packs:{'NBX-B01':7,'QR-01':7},stacks:{'gate-energy':10000,'RSB-75':150000,'UCB-100':350000},items:[['lasers','LF-4',5,1],['lasers','LF-4',1,20],...['Havoc','Hercules','Spartan'].map(x=>['drone-designs',x,1,1])],pending:{specialPetDesign:1}},
 100:{days:180,packs:{'NBX-B01':30,'QR-01':30},stacks:{'gate-energy':30000,'RSB-75':350000,'UCB-100':550000},items:[['lasers','LF-4',10,1],['lasers','LF-4',1,20],['shields','SG3N-B03',1,20],...['Havoc','Hercules','Spartan'].map(x=>['drone-designs',x,1,1])],pending:{specialShipDesign:1}}
});
function availableMilestones(count,claimed=[],blocked=false){return blocked?[]:Object.keys(MILESTONES).map(Number).filter(n=>count>=n&&!claimed.includes(n));}
module.exports={MILESTONES,availableMilestones};
