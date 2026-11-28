'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {formation,recordPet}=require('../public/companions-v237'),motion=require('../public/motion-v236');
test('formation change eases offsets without mutating them',()=>{
 const start=[{x:0,y:0}],goal=[{x:60,y:30}];let a=formation(start,goal,1/60);
 assert.ok(a[0].x>0&&a[0].x<60);assert.deepEqual(start,[{x:0,y:0}]);
 for(let i=0;i<120;i++)a=formation(a,goal,1/60);assert.deepEqual(a,goal);
});
test('formation interpolation is independent of frame rate',()=>{
 const start=[{x:0,y:0}],goal=[{x:60,y:30}];let a=start,b=start;
 for(let i=0;i<6;i++)a=formation(a,goal,1/60);for(let i=0;i<12;i++)b=formation(b,goal,1/120);
 assert.ok(Math.abs(a[0].x-b[0].x)<1e-9);
});
test('only actual drone slots are shown and removed slots vanish',()=>{
 const goal=Array.from({length:12},(_,i)=>({x:i,y:0}));
 assert.equal(formation(null,goal,.016).length,10);assert.deepEqual(formation(goal,[],.016),[]);
});
test('PET snapshots interpolate and clear on deactivation',()=>{
 let h=recordPet(motion,null,{x:100,y:100,angle:0},1000,0);
 h=recordPet(motion,h,{x:200,y:100,angle:0},1100,100);
 assert.equal(motion.position(h,170).x,150);assert.equal(recordPet(motion,h,null,1200,200),null);
 h=recordPet(motion,null,{x:7000,y:100,angle:1},1300,300);assert.equal(motion.position(h,300).x,7000);
});
