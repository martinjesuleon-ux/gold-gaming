'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'../public',n),'utf8');
test('hangar shows all owned drones in rows with equipment and design autosave',()=>{const ui=read('gold-v13.js'),h=ui.slice(ui.indexOf('function hangar()'),ui.indexOf('const rewardText'));assert.match(h,/for\(const \[index,d\] of drones\.entries\(\)\)/);assert.match(h,/slot<2/);assert.match(h,/slot>=cap/);assert.match(h,/\['lasers','shields'\]/);assert.match(h,/pick\.onchange=\(\)=>saveDroneDesign/);assert.match(h,/api\('equip'/);assert.match(h,/layout\.inert=true/);assert.doesNotMatch(h,/Guardar y activar/);});
