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
 const x=6000,y=4000;assert.equal((r.left+x*r.sx-r.left)/r.sx,x);assert.equal((r.top+y*r.sy-r.top)/r.sy,y);
 assert.match(game,/if\(portal\)\{sendMove\(portal.x,portal.y\)/);
 assert.match(game,/for\(const p of visiblePortals\(\)\)\{const x=left\+p.x\*sx/);
 assert.match(read('public/gold-hud.js'),/\['Minimapa',hud.querySelector\('\.radar'\)\]/);
});
test('reward display shows signed, individually labeled committed amounts and removes notices',()=>{
 assert.match(read('accounts.js'),/r.payout=\{credits,xp,uridium:paidUridium,honor\}/);
 assert.match(read('inventory-v13.js'),/payout:\{credits,xp,uridium:paidUridium,honor\}/);
 assert.match(game,/xp:'Experiencia',honor:'Honor',credits:'Créditos',uridium:'Uridium'/);
 assert.match(game,/setTimeout\(\(\)=>card.remove\(\),5700\)/);
 assert.match(html,/id="gg171-rewards"/);
});
