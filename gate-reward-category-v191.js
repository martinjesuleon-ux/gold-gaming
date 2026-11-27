'use strict';
// Classify supported rewards without changing drop probabilities or event multipliers.
function rewardCategory(item){
 if(['LF-4','LF-P01'].includes(item))return 'lasers';
 if(item==='SG3N-B03')return 'shields';
 if(['Havoc','Hercules','Spartan'].includes(item))return 'drone-designs';
 if(item==='Saturn')return 'ship-designs';
 throw Error('Recompensa de puerta sin categoría: '+item);
}
module.exports={rewardCategory};
