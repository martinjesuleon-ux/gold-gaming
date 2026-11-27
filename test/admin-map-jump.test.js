'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{mapList,validateAdminJump}=require('../admin-map-jump'),{MAPS}=require('../maps-v14');
test('administrative jump exposes all 32 persistent sectors and ignores player level',()=>{
 const p={godAllowed:true,zone:'1-1',level:1,godMode:false};assert.deepEqual(mapList(),Object.keys(MAPS));assert.equal(mapList().length,32);
 for(const m of mapList().filter(m=>m!==p.zone))assert.equal(validateAdminJump(p,m),null);
});
test('admin jump rejects unauthorized accounts, invalid destinations and active instances',()=>{
 assert.ok(validateAdminJump({godAllowed:false,zone:'1-1'},'5-3'));
 const p={godAllowed:true,zone:'1-1'};
 for(const m of ['1-1','gg:alpha','__proto__','9-9',{},null])assert.ok(validateAdminJump(p,m));
 for(const key of ['gate','gatePending','hadesPending','ubaReturn','invasionReturn','deadUntil','shotPending','reloadPending','upgradePending','petPending'])assert.ok(validateAdminJump({...p,[key]:true},'5-3'));
});
test('ability dialog repeated clicks leave active panel open and refresh only changed controls',()=>{
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../public/gold-v13.js'),'utf8');
 assert.ok(src.includes('if(mode===which&&!gate)return;modal.close();'));
 assert.ok(src.includes('if(b.disabled!==disabled)b.disabled=disabled'));
 assert.ok(src.includes('window.ggAdminMapJump(pick.value)'));
});
