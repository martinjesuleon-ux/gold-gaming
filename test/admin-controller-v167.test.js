'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const source=read('server.js'),ctx={immune:n=>!!n.godMode};
vm.runInNewContext(source.slice(source.indexOf('function adminTestDamage('),source.indexOf('function laserDamage('))+';this.apply=adminTestDamage;',ctx);
test('one-shot requires privileged pilot and enabled mode, excludes PvP and protected targets',()=>{
 const p={godAllowed:true,oneShot:true};
 for(const [pilot,target,pvp] of [[{...p,godAllowed:false},{hp:100,shield:200},false],[{...p,oneShot:false},{hp:100,shield:200},false],[p,{hp:100,shield:200},true],[p,{hp:100,shield:200,gateShielded:true},false],[p,{hp:100,shield:200,godMode:true},false]]){
  assert.equal(ctx.apply(pilot,target,pvp),0);assert.equal(target.hp,100);assert.equal(target.shield,200);
 }
 const npc={hp:100,shield:200};assert.equal(ctx.apply(p,npc,false),300);assert.equal(npc.hp,0);assert.equal(npc.shield,0);assert.equal(ctx.apply(p,npc,false),0);
});
test('one-shot command validates authorization and type, starts disabled and excludes shield-only ammunition',()=>{
 const handler=source.slice(source.indexOf("socket.on('admin:oneShot'"),source.indexOf("socket.on('v17:god'"));
 assert.match(handler,/!p\?\.godAllowed/);assert.match(handler,/typeof enabled!=='boolean'/);assert.match(source,/godMode:false,oneShot:false/);assert.match(source,/ammo==='SAB-50'\?0:adminTestDamage/);
});
test('controller has separate entry and protected event panel link',()=>{
 const ui=read('public/gold-v13.js');assert.match(ui,/open\('Controlador'\)/);assert.match(ui,/if\(!p\?\.godAllowed\)/);assert.match(ui,/link.href='\/admin'/);
});
