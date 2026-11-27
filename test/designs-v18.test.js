'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {definitions,activate,speedFactor}=require('../abilities-v18');
const {quote}=require('../equipment-v13');
test('design abilities require matching hull and equipped design',()=>{
 assert.equal(definitions({ship:'goliath',design:'Spectrum'})[0].id,'prism');
 assert.equal(definitions({ship:'goliath'}).length,0);
 assert.equal(definitions({ship:'phoenix',design:'Spectrum'}).length,0);
 assert.throws(()=>activate({ship:'goliath',design:'Venom'},'prism',0));
});
test('design prices and skill timers match wiki',()=>{
 assert.equal(quote('designs','Diminisher',1).total,80000);
 assert.equal(quote('designs','Lightning',1).total,250000);
 assert.throws(()=>quote('designs','Saturn',1));
 assert.deepEqual(activate({ship:'goliath',design:'Spectrum'},'prism',0),{until:10000,readyAt:180000});
});
test('elite Aegis preserves hull skills and shortens two repair cooldowns',()=>{
 const p={ship:'aegis',design:'aegis-elite'};
 assert.equal(definitions(p).length,3);
 assert.equal(activate(p,'repair-hp',0).readyAt,81000);
 assert.equal(activate(p,'repair-shield',0).readyAt,24000);
});
test('Lightning boost expires after five seconds',()=>{
 const p={ship:'vengeance',design:'Lightning'};activate(p,'afterburner',0);
 assert.equal(speedFactor(p,1000),1.5);assert.equal(speedFactor(p,5000),1);
});
