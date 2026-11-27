'use strict';
const catalog=require('./data/catalog-v13.json');
function quoteResource(code,packs){
 const item=catalog.resources.find(x=>x.id===code);
 if(!item||!Number.isSafeInteger(packs)||packs<1||packs>100)throw Object.assign(Error('Recurso o cantidad de paquetes inválida'),{status:400});
 return {id:code,category:'resources',quantity:packs*item.packSize,packs,currency:'uridium',total:packs*item.price};
}
module.exports={quoteResource};
