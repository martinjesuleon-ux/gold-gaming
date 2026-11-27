'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('solo gate life reconciliation rejects stale, invalid and shared gate snapshots',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8'),a=src.indexOf('function syncSoloGateLives('),b=src.indexOf('async function refreshGalaxy(',a);
 assert.ok(a>=0&&b>a);const sync=vm.runInNewContext(src.slice(a,b)+';syncSoloGateLives');
 const g={gate:'alpha',wave:1,lives:3},p={gate:g},snap={built:true,wave:1,lives:4};
 assert.equal(sync(p,g,snap),true);assert.equal(g.lives,4);
 for(const bad of [{...snap,lives:3},{...snap,lives:11},{...snap,wave:0,lives:5},{...snap,built:false,lives:5}])assert.equal(sync(p,g,bad),false);
 p.gatePending=true;assert.equal(sync(p,g,{...snap,lives:5}),false);p.gatePending=false;
 assert.equal(sync({...p,gate:{...g}},g,{...snap,lives:5}),false);
 g.gate='hades';assert.equal(sync(p,g,{...snap,lives:5}),false);g.gate='alpha';g.completed=true;assert.equal(sync(p,g,{...snap,lives:5}),false);
});
