'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {formation}=require('../public/companions-v237');
const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../public/graphics-v161.js'),'utf8'),{window});
const offsets=window.ggGraphics161.formationOffsets;
test('formation geometry is shared, immutable and bounded to ten drones',()=>{
 const a=offsets(10,'turtle');assert.equal(a.length,10);assert.equal(a,offsets(10,'turtle'));
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(a[0]));assert.equal(offsets(99,'turtle'),a);
 assert.notEqual(offsets(9,'turtle'),a);assert.notEqual(offsets(10,'arrow'),a);
});
test('unknown formations share a single normal fallback without changing geometry',()=>{
 const a=offsets(10,'normal');for(let i=0;i<1000;i++)assert.equal(offsets(10,'unknown'+i),a);
 assert.equal(a[0].x,68);assert.equal(a[0].y,0);
});
test('settled formations reuse prior array across frames; changes still animate',()=>{
 const target=offsets(10,'turtle'),a=formation(null,target,.016);
 for(let i=0;i<1000;i++)assert.equal(formation(a,target,.016),a);
 const b=formation(a,offsets(10,'arrow'),.016);assert.notEqual(b,a);
 assert.equal(b.length,10);assert.notEqual(b[0].x,a[0].x);
});
