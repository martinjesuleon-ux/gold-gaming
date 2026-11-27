'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const game=read('public/game.js'),chart=read('public/star-map-v171.js'),html=read('public/index.html');
const {MAPS,routes,requiredLevel}=require('../maps-v14');
test('stellar map represents every real sector and respects directed travel and level rules',()=>{
 const coords=vm.runInNewContext(chart.slice(chart.indexOf('const coordinates='),chart.indexOf('const names='))+';coordinates');
 assert.equal(Object.keys(MAPS).length,32);assert.equal(Object.keys(coords).length,32);
 for(const id of Object.keys(MAPS))assert.ok(coords[id].every(Number.isFinite));
 const direct=vm.runInNewContext(chart.match(/function directRoute\(data,id\)\{[^\n]+\}/)[0]+';directRoute');
 const links=routes.map(r=>({...r,level:requiredLevel(r,1)}));
 assert.equal(links.length,61);assert.equal(direct({current:'1-1',links},'1-2').level,1);assert.equal(direct({current:'1-1',links},'3-8'),null);
 for(const r of links){assert.ok(MAPS[r.from]&&MAPS[r.to]);assert.ok(Number.isInteger(r.level));}
 for(const [,id] of chart.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(read('server.js'),/level:requiredLevel\(r,p.company\)/);
 assert.match(game,/if\(!portal\)throw Error\('No hay portal directo/);
});
test('minimap grid and pointer projection share coordinates with permanent portal markers',()=>{
 const a=game.indexOf('const radarColumns='),b=game.indexOf('function radar(){',a);
 const {radarProjection,radarSector}=vm.runInNewContext(game.slice(a,b)+';({radarProjection,radarSector})');
 const r=radarProjection(280,190,12000,8000);
 assert.equal(radarSector(0,0,12000,8000),'A1');assert.equal(radarSector(1500,1400,12000,8000),'B2');assert.equal(radarSector(12000,8000,12000,8000),'F8');
 const x=6000,y=4000;assert.ok(Math.abs((r.left+x*r.sx-r.left)/r.sx-x)<1e-8);assert.ok(Math.abs((r.top+y*r.sy-r.top)/r.sy-y)<1e-8);
 assert.match(game,/if\(portal\)\{sendMove\(portal.x,portal.y\)/);
 assert.match(game,/for\(const p of visiblePortals\(\)\)\{const x=left\+p.x\*sx/);
 assert.match(read('public/gold-hud.js'),/\['Minimapa',hud.querySelector\('\.radar'\)\]/);
});
test('reward display shows signed, individually labeled committed amounts and removes notices',()=>{
 assert.match(read('accounts.js'),/r.payout=\{credits,xp,uridium:paidUridium,honor\}/);
 assert.match(read('inventory-v13.js'),/payout:\{credits,xp,uridium:paidUridium,honor\}/);
 assert.match(game,/xp:'Experiencia',honor:'Honor',credits:'Créditos',uridium:'Uridium'/);
 assert.match(game,/host.replaceChildren\(card\)/);
 assert.match(html,/id="gg171-rewards"/);
});

test('floating reward replaces the previous notice and cancels its timer',()=>{
 const host={children:[],replaceChildren(node){this.children=[node];}};
 const timers=new Map(),history=[];let seq=0;
 function element(){return {children:[],className:'',classList:{add(){}},append(...nodes){this.children.push(...nodes);},remove(){host.children=host.children.filter(n=>n!==this);}};}
 const c={$:()=>host,document:{createElement:element},recordActivity:s=>history.push(s),setTimeout(fn,ms){const id=++seq;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
 const start=game.indexOf('const rewardLabels='),end=game.indexOf("socket.on('v171:reward'",start);
 vm.runInNewContext(game.slice(start,end)+';this.show=rewardNotice;',c);
 c.show('Streuner',{xp:100,honor:4,credits:200,uridium:2});
 const first=host.children[0];assert.equal(first.children.length,5);assert.equal(timers.size,1);
 c.show('Lordakia',{xp:500,uridium:8});
 assert.equal(host.children.length,1);assert.ok(host.children[0]!==first);assert.equal(host.children[0].children[0].textContent,'Lordakia');
 assert.equal(history.length,2);assert.equal(timers.size,1);
 const timer=[...timers.values()][0];assert.equal(timer.ms,4200);timer.fn();assert.equal(host.children.length,0);
 const css=read('public/star-map-v171.css');assert.match(css,/background:transparent;border:0;box-shadow:none/);
 assert.match(css,/100%\{opacity:0;transform:translateY\(-42px\)\}/);
});
