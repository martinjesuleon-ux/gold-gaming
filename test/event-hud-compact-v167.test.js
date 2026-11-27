'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'../public',n),'utf8');
test('event toolbar is consolidated without removing invasion or lottery actions',()=>{const hud=read('gold-hud.js'),feed=read('event-calendar-v158.js'),html=read('index.html');assert.match(hud,/menus\.slice\(0,-4\)/);assert.match(hud,/filter\(x=>x\.name!=='VANT'\)/);assert.match(html,/id="eventFeedStatus"/);assert.match(html,/id="eventTypes"/);assert.match(feed,/actions=\{invasion:'Invasión','hitac-lottery':'Hitac'\}/);assert.match(feed,/window\.gg13Open\(action\)/);assert.match(feed,/Sin eventos activos/);assert.match(feed,/Estado no disponible/);});
