'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const catalog=require('../data/catalog-v13.json');
const {quote,stats}=require('../equipment-v13');
test('active fleet retains exactly eight hulls; retired ships remain in catalog',()=>{
 assert.deepEqual(catalog.ships.filter(s=>!s.retired).map(s=>s.id),['phoenix','nostromo','leonov','vengeance','goliath','spearhead','aegis','citadel']);
 assert.equal(catalog.ships.length,13);
 for(const id of ['yamato','defcom','liberator','piranha','bigboy']){
  assert.throws(()=>quote('ships',id,1),/Objeto no disponible/);
  assert.equal(stats(id,[]).hp,catalog.ships.find(s=>s.id===id).hp);
 }
 for(const id of ['nostromo','leonov','vengeance','goliath','spearhead','aegis','citadel'])assert.equal(quote('ships',id,1).total,catalog.ships.find(s=>s.id===id).price);
});
