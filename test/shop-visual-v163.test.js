'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=n=>fs.readFileSync(path.join(__dirname,'../public',n),'utf8');
const cat=require('../data/catalog-v13.json');
test('all shop catalog items have descriptions, real statistics and original artwork',()=>{
 const gradient={addColorStop(){}},ctx=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get:(t,k)=>k in t?t[k]:()=>{}});
 const document={createElement:()=>({setAttribute(){},getContext:()=>ctx})},window={};vm.runInNewContext(read('shop-visual-v163.js'),{window,document});const v=window.ggShopVisual;
 for(const [category,items] of Object.entries(cat)){if(!Array.isArray(items))continue;for(const item of items){assert.ok(v.describe(category,item).length>25,item.id);assert.ok(v.palette[category],category);assert.ok(Array.isArray(v.stats(item)));assert.equal(v.art(category,item).width,144);}}
 for(const [category,id] of [['drones','flax'],['drones','iris'],['pet','pet-10'],['fuel','pet-fuel'],['petGear','G-AL1'],['petGear','G-KK1']]){assert.ok(v.describe(category,{id}).length>20);assert.equal(v.art(category,{id}).height,96);}
 assert.deepEqual(JSON.parse(JSON.stringify(v.stats({damage:200,absorption:.8,duration:5000,bonus:{shield:1.1}}))),[['Daño','200'],['Absorción','80 %'],['Duración','5 s'],['Escudo','+10 %']]);
});
test('catalog visuals load before shop and menu buttons contain visible labels',()=>{
 const html=read('index.html'),hud=read('gold-hud.js'),shop=read('gold-v13.js');assert.ok(html.indexOf('shop-visual-v163.js')>=0);assert.ok(html.indexOf('shop-visual-v163.js')<html.indexOf('gold-v13.js'));
 assert.match(hud,/b.append\(menuIcon\(symbols\[i\]\)\)/);assert.match(hud,/label.textContent=name/);assert.match(shop,/visual.art\(category,p\)/);assert.match(shop,/visual.describe\(category,p\)/);
});

test('laser and drone design colors distinguish individual items',()=>{const window={};vm.runInNewContext(read('shop-visual-v163.js'),{window});const v=window.ggShopVisual;assert.equal(new Set(cat.lasers.map(p=>v.itemColor('lasers',p))).size,cat.lasers.length);assert.equal(v.itemColor('droneDesigns',{id:'Havoc'}),'#ff3838');assert.equal(v.itemColor('droneDesigns',{id:'Hercules'}),'#398dff');assert.equal(v.itemColor('droneDesigns',{id:'Spartan'}),'#ff8a24');assert.match(v.describe('lasers',{id:'LF-4',damage:200}),/200/);assert.match(read('gold-v13.js'),/gg-inventory-filters/);});

test('visual hangar retains equip API and exposes configuration, slots, preview and inventory search',()=>{
 const ui=read('gold-v13.js'),h=ui.slice(ui.indexOf('function hangar()'),ui.indexOf('const rewardText'));
 assert.match(h,/api\('equip'/);assert.match(h,/draft.configs\[tab\]/);assert.match(h,/gg-hangar-preview/);assert.match(h,/gg-hangar-targets/);assert.match(h,/gg-hangar-usage/);assert.match(h,/visual.art\(i.category,p\)/);assert.match(h,/search.oninput/);assert.match(h,/dataTransfer.getData/);assert.match(h,/cat.drones\[d.code\].slots/);
});

test('visual ammunition controls retain all twenty slots and expose live stock',()=>{
 const g=read('game.js'),css=read('gold-hud.css');assert.match(g,/decorateAmmoSlot\(b,'ammo',code/);assert.match(g,/ammoStock\[code\]/);assert.match(g,/b.dataset.ammoCode!==code/);assert.match(g,/buttons\[i\+7\]/);assert.match(g,/buttons\[i\+11\]/);assert.match(g,/fireRocket\(code\)/);assert.match(g,/fireOrdnance\(code\)/);assert.match(css,/gg-ammo-count/);
 const ui=read('gold-v13.js');assert.match(ui,/gg-ability-card/);assert.match(ui,/info.dataset.phase!==phase/);
});
