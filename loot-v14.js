'use strict';
// Bonus box categories and percentages from supplied wiki. Quantity weights are provisional.
const BONUS=[["LCB-10",34,[10,15,20,50,75]],["credits",20,[200,500,1000]],["uridium",17,[20,50,75,100]],["MCB-25",13,[5,25]],["MCB-50",8,[15]],["SAB-50",6,[5,10,25]],["gate-energy",2,[1]]];
function bonusLoot(roll,amountRoll){
 if(!Number.isInteger(roll)||roll<0||roll>=100||!Number.isFinite(amountRoll)||amountRoll<0||amountRoll>=1)throw Error('Invalid roll');
 for(const [code,weight,values] of BONUS){if(roll<weight){return {code,quantity:values[Math.min(values.length-1,Math.floor(amountRoll*amountRoll*values.length))]};}roll-=weight;}
 throw Error('Invalid loot table');
}
module.exports={BONUS,bonusLoot};
