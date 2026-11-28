'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../public',name),'utf8');
const game=read('game.js');
function extract(start,end){const a=game.indexOf(start),b=game.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return game.slice(a,b);}
test('GOLD adaptive quality changes gradually and ignores short or invalid samples',()=>{
 const next=vm.runInNewContext(extract('function nextAdaptiveQuality(','function adaptQuality(')+';nextAdaptiveQuality');
 const m={slow:0,fast:0};assert.equal(next('high',40,400,m),'high');assert.equal(m.slow,0);
 for(let i=0;i<2;i++)assert.equal(next('high',40,1000,m),'high');
 assert.equal(next('high',40,1000,m),'medium');m.slow=m.fast=0;
 for(let i=0;i<11;i++)assert.equal(next('low',60,1000,m),'low');
 assert.equal(next('low',60,1000,m),'medium');assert.equal(next('medium',NaN,1000,m),'medium');
});
test('PET interpolates valid positions in both themes and resets on despawn or large jumps',()=>{
 const smooth=vm.runInNewContext(extract('function smoothPetPosition(','function drawPet(')+';smoothPetPosition');
 assert.equal(smooth(null,{x:5,y:10},.3).x,5);
 const p=smooth({x:0,y:0},{x:10,y:20},.25);assert.equal(p.x,2.5);assert.equal(p.y,5);
 assert.equal(smooth(p,null,.25),null);assert.equal(smooth(p,{x:NaN,y:0},.25),null);
 assert.equal(smooth(p,{x:2000,y:0},.25).x,2000);
});
test('GOLD star field creates at most three reusable tiles even across camera movement',()=>{
 let allocations=0,arcs=0,draws=0;
 const document={createElement(){allocations++;return {getContext(){return {beginPath(){},arc(...a){assert.ok(a.every(Number.isFinite));arcs++;},fill(){}};}};}};
 const ctx={drawImage(tile,x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));draws++;}};
 const camera={x:6000,y:4000};
 const hash=game.match(/function hash\(x,y,k\)\{[^\n]+\}/)[0];
 const run=vm.runInNewContext(hash+'\nconst W=1920,H=1080,quality="high",qualityProfiles={high:{stars:3}};\n'+extract('const goldStarLayers=','function stars(){')+';drawGoldStars',{document,ctx,camera});
 run();const initial=arcs;assert.equal(allocations,3);assert.ok(initial>0);
 for(let i=0;i<120;i++){camera.x-=170;camera.y+=57;run();}
 assert.equal(allocations,3);assert.equal(arcs,initial);assert.ok(draws>120);
});
test('GOLD auto quality is optional, persisted and separate from classic artwork',()=>{
 assert.match(read('gold-hud.js'),/\['auto','low','medium','high'\]/);
 assert.match(game,/qualityPreference!=='auto'/);assert.match(game,/current\(\)\|\|'gold'\)!=='gold'/);
 assert.match(game,/v\.petVisual=smoothPetPosition\(v\.petVisual,q\?\{x:q\.x,y:q\.y,angle:q\.a\}:p\.pet,alpha\)/);
 assert.match(game,/ggMotion236\?\.position\(v\.petMotion,t,false\)/);
 assert.match(read('graphics-v161.js'),/if\(theme==='gold'\)goldShipFinish/);
});

test('PET escort keeps independent spacing and heading in both themes',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const match=server.match(/function petFollowGoal\(p\)\{[\s\S]*?\n \}/);assert.ok(match);
 const goal=vm.runInNewContext('const WORLD={w:12000,h:8000};'+match[0]+';petFollowGoal',{petNavigation:require('../pet-navigation-v187')});
 const p={x:500,y:500,angle:0},g=goal(p);
 assert.ok(Math.hypot(g.x-p.x,g.y-p.y)>190);assert.equal(g.x,330);assert.equal(g.y,605);
 assert.equal(goal({x:25,y:25,angle:0}).x,25);
 const smooth=vm.runInNewContext(extract('function smoothPetPosition(','function drawPet(')+';smoothPetPosition');
 const turn=smooth({x:0,y:0,angle:Math.PI-.1},{x:10,y:20,angle:-Math.PI+.1},.5);
 assert.ok(Math.abs(turn.angle-Math.PI)<.001);
 assert.match(server,/nearestEligible\(p,boxes.inZone\(zoneOf\(p\)\),p\.petLootRange\|\|700/);
});
