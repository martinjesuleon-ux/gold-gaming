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

test('PET controls retain server actions and use persistent status and actual inventory',()=>{
 const g=read('game.js'),p=g.slice(g.indexOf('function renderPetPanel()'),g.indexOf('const ammoCodes='));
 assert.match(p,/if\(!controls\)/);assert.doesNotMatch(p,/controls.replaceChildren/);
 assert.match(p,/socket.emit\('v14:pet',mode\)/);assert.match(p,/socket.emit\('v16:kamikaze'\)/);
 assert.match(p,/meter.max=50000/);assert.match(p,/petFuel===null/);assert.match(p,/petGear.has\('G-AL1'\)/);assert.match(p,/petGear.has\('G-KK1'\)/);assert.match(p,/petOwned=e.detail.items.some/);
});

test('VANT menu previews real drone colors and formation geometry without changing equipment API',()=>{
 const ui=read('gold-v13.js'),menu=ui.slice(ui.indexOf('async function formationMenu()'),ui.indexOf('async function assemblyMenu()'));
 assert.match(menu,/graphics.droneColor\(selectedDesign\?\.code\)/);assert.match(menu,/graphics.formationOffsets\(10,f.id\)/);assert.match(menu,/pick.onchange=drawDrone/);assert.match(menu,/api\('drones\/design'/);assert.match(menu,/api\('formations\/buy'/);assert.match(menu,/window.gg19Formation\(f.id\)/);
});

test('Galaxy Gates progress UI reads server state and retains purchase and entry actions',()=>{
 const ui=read('gold-v13.js'),menu=ui.slice(ui.indexOf('async function gates()'),ui.indexOf('window.gg13Open=open'));
 assert.match(menu,/gg-gate-card/);assert.match(menu,/g.pieces.length\/g.required/);assert.match(menu,/new Set\(a.pieces\)/);assert.match(menu,/gg-gate-summary/);assert.match(menu,/allowUridium:paid/);assert.match(menu,/api\('gates\/'\+kind/);assert.match(menu,/window.gg16TravelGate\(selected\)/);
});

test('mission cards classify actual progress and retain server reward claims',()=>{
 const ui=read('gold-v13.js'),menu=ui.slice(ui.indexOf('function missionPhase('),ui.indexOf('async function socialGroup()'));
 assert.match(menu,/m.conditions.every/);assert.match(menu,/m.claimed/);assert.match(menu,/gg-mission-tabs/);assert.match(menu,/rewardCards\(m.reward\)/);assert.match(menu,/api\('missions',\{action:m.accepted\?'claim':'accept'/);assert.match(ui,/api\('daily',\{\}\)/);
});

test('social menus retain group and clan permissions and ranking positions when searching',()=>{
 const ui=read('gold-v13.js'),social=ui.slice(ui.indexOf('async function socialGroup()'),ui.indexOf('function faction()')),rank=ui.slice(ui.indexOf('async function rankingMenu()'),ui.indexOf('let auctionBoard'));
 assert.match(social,/capacity.max=8/);assert.match(social,/run\('invite',\{target:p.id\}\)/);assert.match(social,/can\('expulsar'\)/);assert.match(social,/run\('permissions'/);assert.match(social,/run\('diplomacy'/);assert.match(rank,/d.rows.forEach\(\(r,i\)/);assert.match(rank,/\[i\+1,r.name/);assert.match(rank,/search.oninput=list/);
});
