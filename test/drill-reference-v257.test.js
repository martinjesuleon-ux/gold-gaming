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

test('ring is circular, wheel has mirrored groups of five, and diamond has mirrored vertices',()=>{
 const window={};vm.runInNewContext(read('graphics-v161.js'),{window});const g=window.ggGraphics161;
 const ring=g.formationOffsets(10,'ring');for(const p of ring)assert.ok(Math.abs(Math.hypot(p.x,p.y)-114)<1e-8);
 const angles=Array.from(ring,p=>Math.atan2(p.y,p.x)).sort((a,b)=>a-b);for(let i=1;i<angles.length;i++)assert.ok(Math.abs(angles[i]-angles[i-1]-Math.PI/5)<1e-8);
 const wheel=g.formationOffsets(10,'wheel');assert.equal(wheel.filter(p=>p.y<0).length,5);assert.equal(wheel.filter(p=>p.y>0).length,5);
 for(const code of ['wheel','diamond']){const points=g.formationOffsets(10,code);for(const p of points)assert.ok(points.some(q=>q.x===p.x&&q.y===-p.y));}
 const diamond=g.formationOffsets(10,'diamond');assert.ok(diamond.some(p=>p.x===133&&p.y===0));assert.ok(diamond.some(p=>p.x===-133&&p.y===0));
});
test('all formation layouts contain ten distinct finite positions and unique silhouettes',()=>{
 const window={};vm.runInNewContext(read('graphics-v161.js'),{window});const g=window.ggGraphics161;
 const codes=['normal','turtle','arrow','lance','star','pincer','double-arrow','diamond','chevron','moth','crab','heart','barrage','bat','ring','drill','veteran','dome','wheel','wave'];
 const signatures=new Set();for(const code of codes){const pts=g.formationOffsets(10,code);assert.equal(pts.length,10);assert.equal(new Set(pts.map(p=>p.x+','+p.y)).size,10);assert.ok(pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));signatures.add(pts.map(p=>p.x+','+p.y).sort().join(';'));}assert.equal(signatures.size,codes.length);
});
