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

test('economy panels show authoritative auction and mineral data without changing transactions',()=>{
 const ui=read('gold-v13.js'),auction=ui.slice(ui.indexOf('async function auctionMenu()'),ui.indexOf('async function stationMenu()')),minerals=ui.slice(ui.indexOf('async function mineralMenu('),ui.indexOf('function gateRewardText'));
 assert.match(auction,/lot.minBid/);assert.match(auction,/window.gg114Bid/);assert.match(auction,/roundStart:d.roundStart/);assert.match(auction,/gg-auction-card/);assert.match(minerals,/cargoMeter.value=data.cargoUsed/);assert.match(minerals,/meter.value=data.metrics.used/);assert.match(minerals,/meter.value=stock/);assert.match(minerals,/data.cargo\[k\]/);assert.match(minerals,/api\('minerals',\{action,/);assert.match(minerals,/window.gg120Sell/);
});

test('event and station cards preserve actual status and transaction paths',()=>{
 const ui=read('gold-v13.js'),station=ui.slice(ui.indexOf('async function stationMenu()'),ui.indexOf('async function boosterMenu()')),boost=ui.slice(ui.indexOf('async function boosterMenu()'),ui.indexOf('function mineMenu()'));
 assert.match(station,/a.station\?\.state/);assert.match(station,/window.gg115CBS/);assert.match(station,/gg-station-card/);assert.match(boost,/d.active\[item.code\]/);assert.match(boost,/d.stock\[item.code\]/);assert.match(boost,/window.gg112Booster/);assert.match(ui,/section.dataset.current=String\(key===d.difficulty\)/);assert.match(ui,/rewardCards\(Object.fromEntries/);
});

test('HUD layout preferences validate sizes and clamp draggable windows inside viewport',()=>{
 const hud=read('gold-hud.js'),css=read('gold-hud.css');
 const src=hud.slice(hud.indexOf('function clampPosition('),hud.indexOf('function applyPositions('));
 const vm=require('node:vm'),context={window:{innerWidth:800,innerHeight:600}};vm.runInNewContext(src+';this.clamp=clampPosition',context);
 assert.equal(JSON.stringify(context.clamp(-40,900,200,100)),JSON.stringify({x:0,y:500}));
 assert.equal(JSON.stringify(context.clamp(90,40,900,700)),JSON.stringify({x:0,y:0}));
 assert.match(hud,/localStorage.setItem\(preferenceKey/);assert.match(hud,/pointerdown/);assert.match(hud,/preferences=\{size:'normal',labels:true,opacity:95,focus:false,performance:false,quality:'high',positions:\{\}\}/);assert.match(css,/gg-custom-position/);assert.match(css,/data-control-size=large/);
});

test('HUD transparency and combat focus remain local and preserve essential controls',()=>{
 const hud=read('gold-hud.js'),css=read('gold-hud.css');assert.match(hud,/Math.max\(45,Math.min\(100,raw.opacity\)\)/);assert.match(hud,/--gg-panel-opacity/);assert.match(hud,/--gg-right-top/);assert.match(hud,/--gg-target-top/);assert.match(css,/data-focus-mode=true/);assert.match(css,/rgb\(23 38 49 \/ var\(--gg-panel-opacity/);assert.doesNotMatch(css,/data-focus-mode=true[^{}]*\.arsenal\s*\{/);
});

test('performance monitor samples frames and rate limits real server round trips',()=>{
 const game=read('game.js'),hud=read('gold-hud.js'),server=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');
 assert.match(game,/perfFrames\*1000\/elapsed/);assert.match(game,/t-perfProbeAt>=5000/);assert.match(game,/socket.timeout\(3000\).emit\('gg:latency'/);assert.match(game,/generation!==perfGeneration/);assert.match(game,/document.hidden\|\|!panel\|\|panel.hidden/);assert.match(hud,/monitor.hidden=!preferences.performance/);assert.match(server,/now-lastLatencyProbe<2500/);assert.match(server,/!players.has\(socket.id\)/);
});

test('graphics quality profiles change rendering only and retain full game entities',()=>{
 const game=read('game.js'),hud=read('gold-hud.js');assert.match(game,/low:\{dpr:1,stars:1,glow:0\}/);assert.match(game,/medium:\{dpr:1.5,stars:2,glow:.5\}/);assert.match(game,/high:\{dpr:2,stars:3,glow:1\}/);assert.match(game,/qualityProfiles\[quality\].dpr/);assert.match(game,/qualityProfiles\[quality\].stars/);assert.match(game,/qualityProfiles\[quality\].glow/);assert.match(game,/for\(const n of state.npcs\)/);assert.match(hud,/window.ggSetQuality\?\.\(preferences.quality\)/);
});
