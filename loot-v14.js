'use strict';
// Bonus box categories and percentages from supplied wiki. Quantity weights are provisional.
const BONUS=[["LCB-10",34,[10,15,20,50,75]],["credits",20,[200,500,1000]],["uridium",17,[20,50,75,100]],["MCB-25",13,[5,25]],["MCB-50",8,[15]],["SAB-50",6,[5,10,25]],["gate-energy",2,[1]]];
function bonusLoot(roll,amountRoll){
 if(!Number.isInteger(roll)||roll<0||roll>=100||!Number.isFinite(amountRoll)||amountRoll<0||amountRoll>=1)throw Error('Invalid roll');
 for(const [code,weight,values] of BONUS){if(roll<weight){return {code,quantity:values[Math.min(values.length-1,Math.floor(amountRoll*amountRoll*values.length))]};}roll-=weight;}
 throw Error('Invalid loot table');
}
// Provisional balance for green-key pirate chests; all rolls are server-side.
const PIRATE=Object.freeze([
 Object.freeze({code:'UCB-100',quantity:500,weight:45}),
 Object.freeze({code:'uridium',quantity:500,weight:25}),
 Object.freeze({code:'credits',quantity:25000,weight:15}),
 Object.freeze({code:'log-disk',quantity:5,weight:10}),
 Object.freeze({code:'LF-3',quantity:1,category:'lasers',weight:4}),
 Object.freeze({code:'LF-4',quantity:1,category:'lasers',weight:1})
]);
function pirateLoot(roll){
 if(!Number.isInteger(roll)||roll<0||roll>=100)throw Error('Invalid pirate roll');
 for(const {weight,...reward} of PIRATE){if(roll<weight)return reward;roll-=weight;}
 throw Error('Invalid pirate loot table');
}
module.exports={BONUS,bonusLoot,PIRATE,pirateLoot};
