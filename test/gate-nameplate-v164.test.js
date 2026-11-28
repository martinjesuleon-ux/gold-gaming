'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/rank-visual-v164.js'),'utf8'),{window});const {gateMarks,drawGateMarks}=window.ggRankVisual;
test('gate markings cap at six unique completed gates, three per row, with independent Kronos crown',()=>{const g=gateMarks(['alpha','alpha','beta','gamma','delta','epsilon','zeta','kappa','lambda','hades','kronos','unknown']);assert.equal(g.gates.length,6);assert.equal(g.rows,2);assert.equal(g.crown,true);assert.equal(gateMarks(['kronos']).gates.length,0);assert.equal(gateMarks(['kronos']).crown,true);assert.equal(gateMarks(['alpha']).crown,false);assert.equal(gateMarks(null).rows,0);});
test('six visible rings draw in two aligned rows above name baseline',()=>{const arcs=[],c={save(){},restore(){},beginPath(){},arc(x,y,r){arcs.push([x,y,r]);},stroke(){}};drawGateMarks(c,gateMarks(['alpha','beta','gamma','delta','epsilon','zeta']),100,200);assert.deepEqual(arcs,[[92,177,2.5],[100,177,2.5],[108,177,2.5],[92,185,2.5],[100,185,2.5],[108,185,2.5]]);});

test('completion marks are anchored to the rank insignia, not the pilot name',()=>{const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');assert.match(game,/const badgeX=p.x-graphics.nameWidth\(ctx,v.nameMetrics\|\|\(v.nameMetrics=\{\}\),name\)\/2-20/);assert.match(game,/drawGateMarks\(ctx,marks,badgeX\+8.5,nameY\)/);});

test('gate nameplate geometry is reused across snapshots and invalidates on changed completions',()=>{
 const {cachedGateMarks}=window.ggRankVisual,cache={},keys=['alpha','beta'];
 const first=cachedGateMarks(cache,keys);assert.equal(cachedGateMarks(cache,['alpha','beta']),first);
 keys.push('kronos');const next=cachedGateMarks(cache,keys);assert.notEqual(next,first);assert.equal(next.crown,true);assert.equal(next.offset,18);
 assert.equal(cachedGateMarks(cache,keys),next);assert.equal(cachedGateMarks(cache,[]).offset,0);
});
test('empty gate nameplate decorations require no drawing operations',()=>{drawGateMarks({},gateMarks([]),0,0);});
