'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('laser effects require finite start and target coordinates',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8'),a=s.indexOf('function validLaserEffect('),b=s.indexOf('function appendEffect(',a);
 assert.ok(a>=0&&b>a);const valid=vm.runInNewContext(s.slice(a,b)+';validLaserEffect');
 assert.equal(valid({x:0,y:0,tx:1,ty:2}),true);
 for(const e of [{x:0,y:0,tx:1},{x:0,y:0,tx:NaN,ty:2},{x:0,y:0,tx:1,ty:Infinity},null,{x:'0',y:0,tx:1,ty:2}])assert.equal(valid(e),false);
});
