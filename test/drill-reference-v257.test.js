'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(require.resolve('../public/'+p),'utf8');
test('Drill matches the reference five-row layout and remains symmetric',()=>{
 const window={};vm.runInNewContext(read('graphics-v161.js'),{window});
 const g=window.ggGraphics161,points=g.formationOffsets(10,'drill'),rows=new Map();
 for(const {x,y} of points){const row=rows.get(x)||[];row.push(y);rows.set(x,row);}
 assert.deepEqual([...rows].sort((a,b)=>b[0]-a[0]).map(([x,row])=>[x,row.sort((a,b)=>a-b)]),[[171,[0]],[114,[-57,0,57]],[57,[-114,114]],[0,[-76,76]],[-66.5,[-142.5,142.5]]]);
 assert.equal(new Set(points.map(p=>p.x+','+p.y)).size,10);
 for(let n=0;n<=10;n++)assert.equal(g.formationOffsets(n,'drill').length,n);
 assert.equal(g.formationOffsets(10,'drill'),points);
});
test('Drill quick icon and formation preview use the reference orientation',()=>{
 assert.match(read('quick-arsenal-v234.js'),/if\(code==='drill'\)/);
 assert.match(read('gold-v13.js'),/if\(f.id==='drill'\)/);
});
