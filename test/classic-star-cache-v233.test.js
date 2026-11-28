'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require.resolve('../public/game.js'),'utf8'),hash=src.slice(src.indexOf('function hash('),src.indexOf('// GOLD: repeat cached'));
const block=src.slice(src.indexOf('const classicStarTiles='),src.indexOf('function stars()'));
function fixture(w=1280,h=720){
 let created=0,direct=0,draws=0;const ctx={beginPath(){},arc(){direct++;},fill(){},drawImage(){draws++;}};
 const env={W:w,H:h,camera:{x:0,y:0},ctx,quality:'high',qualityProfiles:{high:{stars:3}},goldStarLayers:[[1,.12,.7,110],[2,.38,1,155],[3,.75,1.5,240]],document:{createElement(){created++;const points=[];const a={beginPath(){},arc(x,y,r){points.push([x,y,r,this.globalAlpha]);},fill(){}};return {points,getContext:()=>a};}}};
 const f=vm.runInNewContext(hash+block+'\n({tile:classicStarTile,draw:drawClassicStars,bytes:()=>classicStarBytes,budget:CLASSIC_STAR_BUDGET,viewport:classicStarViewportBytes,hash})',env);return {...f,counts:()=>({created,direct,draws})};
}
test('classic star tiles reuse identical coordinates across frames',()=>{const f=fixture(),a=f.tile(1,.7,110,-2,3);assert.equal(f.tile(1,.7,110,-2,3),a);assert.equal(f.counts().created,1);const expectedX=f.hash(-8,12,1)*110,expectedY=f.hash(-8,12,5)*110;assert.ok(a.points.some(([x,y])=>x===expectedX&&y===expectedY));});
test('classic cache remains bounded while moving through world',()=>{const f=fixture();for(let i=0;i<80;i++){f.tile(3,1.5,240,i,-i);assert.ok(f.bytes()<=f.budget);}assert.ok(f.counts().created===80);});
test('normal viewport uses cached tiles without per-star drawing on main canvas',()=>{const f=fixture();f.draw();const a=f.counts();assert.ok(a.created>0&&a.draws>0);f.draw();assert.equal(f.counts().created,a.created);assert.equal(f.counts().direct,0);});
test('oversized viewport falls back to direct draw without cache thrashing',()=>{const f=fixture(7680,4320);f.draw();assert.equal(f.counts().created,0);assert.ok(f.counts().direct>0);assert.equal(f.counts().draws,0);});
