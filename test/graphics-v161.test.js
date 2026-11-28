'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..','public',name),'utf8');
test('graphics sprites reuse cached canvases for the same palette and render portals',()=>{
 let canvases=0,draws=0;
 const gradient={addColorStop(){}};
 const context=()=>new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,drawImage(){draws++;}},{get:(target,k)=>k in target?target[k]:()=>{}});
 const window={devicePixelRatio:2,document:{createElement(tag){assert.equal(tag,'canvas');canvases++;return {getContext:()=>context()};}}};
 vm.runInNewContext(read('graphics-v161.js'),{window});
 const c=context();for(const [kind,color] of [['scout','#76f5bd'],['tank','#77c6ff'],['alien','#70a7ff'],['drone','#ff4949'],['pet','#5ae5ff']]){window.ggGraphics161.draw(c,kind,color);window.ggGraphics161.draw(c,kind,color);}
 assert.equal(canvases,5);assert.equal(draws,10);window.ggGraphics161.portal(c,'#5fd9ff',1000);
});
test('game loads graphics module before the render loop and keeps existing portal input',()=>{
 const html=read('index.html'),game=read('game.js');
 assert.ok(html.indexOf('src="graphics-v161.js')>=0);assert.ok(html.indexOf('src="graphics-v161.js')<html.indexOf('src="game.js'));
 assert.match(game,/function portalRange\(p\)\{return p.kind==='galaxy'\|\|p.kind==='exit'\?125:180;\}/);
 assert.match(game,/formationOffsets\(o.droneCount,o.formation\)/);
});

test('each drone palette reflects its equipped design, not its rank or unknown values',()=>{
 const window={};vm.runInNewContext(read('graphics-v161.js'),{window});
 const color=window.ggGraphics161.droneColor;
 assert.equal(color(undefined),'#aab4bd');assert.equal(color(null),'#aab4bd');assert.equal(color('unknown'),'#aab4bd');
 assert.equal(color('Havoc'),'#ff3838');assert.equal(color('Hercules'),'#398dff');assert.equal(color('Spartan'),'#ff8a24');
 assert.match(read('game.js'),/droneColor\(drone\?\.design\)/);
});

test('NPC variants use different species silhouettes and preserve blue Boss Kristallin',()=>{
 const window={};vm.runInNewContext(read('graphics-v161.js'),{window});
 const style=window.ggGraphics161.npcStyle;
 assert.equal(style('Boss Kristallin','boss').kind,'crystal-elite');
 assert.equal(style('Kristallin','drone').kind,'crystal');
 assert.equal(style('Boss Kristallin','boss').color,'#46a7ff');
 assert.equal(style('Uber-Kristallon','boss').tier,'uber');
 assert.equal(style('Emperor-Kristallon','boss').tier,'emperor');
 assert.equal(style('Streuner','npc').kind,'streuner-original');assert.equal(style('StreuneR','npc').kind,'scout-npc');assert.equal(style('Boss Streuner','boss').kind,'scout-npc');assert.equal(style('Uber-Streuner','boss').kind,'scout-npc');assert.equal(style('Interceptor','npc').kind,'scout-npc');
 assert.equal(style('Lordakia','npc').kind,'claw');
 assert.equal(style('Saimon','npc').kind,'wing');
 assert.equal(style('Mordon','npc').kind,'armor');
 assert.equal(style('Cubikon','npc').kind,'cube');
 assert.equal(style('Barracuda','npc').kind,'pirate');
 assert.equal(style('unknown','npc').kind,'alien');
 assert.match(read('game.js'),/npcStyle\(o.name,o.type\)/);
});

test('all catalog ships have their own hull and all catalog designs have a palette',()=>{
 const window={};vm.runInNewContext(read('graphics-v161.js'),{window});
 const style=window.ggGraphics161.playerStyle;
 const catalog=require('../data/catalog-v13.json');
 const kinds=catalog.ships.map(s=>style(s.id,null,true).kind);
 assert.equal(new Set(kinds).size,catalog.ships.length);
 for(const s of catalog.ships)assert.equal(style(s.id,null,true).kind,'ship-'+s.id);
 for(const d of catalog.designs){const equipped=style(d.ship,d.id,true);assert.match(equipped.color,/^#[0-9a-f]{6}$/i);assert.notEqual(equipped.color,style(d.ship,null,true).color);}
 assert.equal(style('missing',null,true).kind,'scout');
 assert.equal(style('tank',null,false).kind,'tank');
 assert.match(read('game.js'),/playerStyle\(o.ship,o.design,isMe\)/);
});

test('all detailed player hulls and equipped designs render with finite geometry and reuse their sprite',()=>{
 let canvases=0,draws=0;
 const validate=(...args)=>{assert.ok(args.every(Number.isFinite));};
 const gradient={addColorStop(offset,color){assert.ok(Number.isFinite(offset));assert.equal(typeof color,'string');}};
 const context=()=>new Proxy({createLinearGradient(...a){validate(...a);return gradient;},createRadialGradient(...a){validate(...a);assert.ok(a[2]>=0&&a[5]>=0);return gradient;},moveTo:validate,lineTo:validate,scale:validate,translate:validate,fillRect:validate,drawImage(canvas,...a){validate(...a);draws++;}},{get:(target,k)=>k in target?target[k]:()=>{}});
 const window={devicePixelRatio:2,document:{createElement(){canvases++;return {getContext:()=>context()};}}};
 vm.runInNewContext(read('graphics-v161.js'),{window});const graphics=window.ggGraphics161,c=context(),catalog=require('../data/catalog-v13.json');
 const variants=[...catalog.ships.map(s=>graphics.playerStyle(s.id,null,true)),...catalog.designs.map(d=>graphics.playerStyle(d.ship,d.id,true))];
 for(const {kind,color} of variants){graphics.draw(c,kind,color);const prior=canvases;graphics.draw(c,kind,color);assert.equal(canvases,prior);}
 assert.equal(draws,variants.length*2);assert.ok(canvases<=variants.length);
});

test('four VANT hulls render independently of equipped design colors',()=>{
 let canvases=0;
 const gradient={addColorStop(){}},context=()=>new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(t,k)=>k in t?t[k]:()=>{}});
 const window={document:{createElement(){canvases++;return {getContext:()=>context()};}}};
 vm.runInNewContext(read('graphics-v161.js'),{window});
 const g=window.ggGraphics161,c=context(),codes=['flax','iris','apis','zeus'],designs=[null,'Havoc','Hercules','Spartan'];
 assert.equal(new Set(codes.map(g.droneKind)).size,4);
 assert.equal(g.droneKind('unknown'),'drone');
 for(const code of codes)for(const design of designs){g.draw(c,g.droneKind(code),g.droneColor(design));g.draw(c,g.droneKind(code),g.droneColor(design));}
 assert.equal(canvases,16);assert.match(read('game.js'),/droneKind\(drone\?\.code\)/);
});

test('detailed NPC hulls render for every NPC in the catalog without invalid geometry',()=>{
 let count=0;const valid=(...a)=>assert.ok(a.every(Number.isFinite));
 const gradient={addColorStop(offset,color){assert.ok(Number.isFinite(offset));assert.match(color,/^#[0-9a-f]{6}([0-9a-f]{2})?$/i);}};
 const context=()=>new Proxy({createLinearGradient(...a){valid(...a);return gradient;},createRadialGradient(...a){valid(...a);return gradient;},moveTo:valid,lineTo:valid,scale:valid,translate:valid,fillRect:valid,drawImage(canvas,...a){valid(...a);count++;}},{get:(t,k)=>k in t?t[k]:()=>{}});
 const window={document:{createElement(){return {getContext:()=>context()};}}};
 vm.runInNewContext(read('graphics-v161.js'),{window});const g=window.ggGraphics161,c=context(),names=Object.keys(require('../data/npcs-v14.json'));
 for(const name of names){const v=g.npcStyle(name,name.startsWith('Boss')?'boss':'drone');g.draw(c,v.kind,v.color);}
 assert.equal(count,names.length);
 assert.equal(g.npcStyle('Boss Kristallin','boss').color,'#46a7ff');
 assert.notEqual(g.npcStyle('Boss Kristallin','boss').kind,g.npcStyle('Kristallin','drone').kind);
});

test('adaptive labels clear ten drone formations at all rotations, bars stay bounded',()=>{
 const window={};vm.runInNewContext(read('graphics-v161.js'),{window});const g=window.ggGraphics161;
 const visual=g.playerStyle('goliath',null,true);
 for(const formation of ['normal','arrow','double-arrow','chevron','drill','ring','dome','heart','wave','bat','moth','star','diamond']){
 const offsets=g.formationOffsets(10,formation);assert.equal(offsets.length,10);
 for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5]){
 const layout=g.labelLayout({},visual,false,1,angle,offsets);
 for(const {x,y} of offsets){const v=x*Math.sin(angle)+y*Math.cos(angle);assert.ok(layout.top>=-v+15);assert.ok(layout.name>=v+19);}
 }}
 assert.equal(g.formationOffsets(99,'normal').length,10);assert.equal(g.formationOffsets(-1,'normal').length,0);
 assert.equal(g.safeRatio(1,0),0);assert.equal(g.safeRatio(12,10),1);assert.equal(g.safeRatio(-1,10),0);assert.equal(g.safeRatio(5,10),.5);
 const boss=g.labelLayout({type:'boss'},g.npcStyle('Boss Kristallin','boss'),true,1.7);assert.ok(boss.top>75);
});

test('dark-space background cache regenerates only when viewport dimensions change',()=>{
 let canvases=0,draws=0;const gradient={addColorStop(){}};
 const context=()=>new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,drawImage(){draws++;}},{get:(t,k)=>k in t?t[k]:()=>{}});
 const window={document:{createElement(){canvases++;return {getContext:()=>context()};}}};
 vm.runInNewContext(read('graphics-v161.js'),{window});const g=window.ggGraphics161,c=context();
 g.sky(c,1280,720);g.sky(c,1280,720);assert.equal(canvases,1);assert.equal(draws,2);
 g.sky(c,1920,1080);assert.equal(canvases,2);g.sky(c,0,0);assert.equal(canvases,2);
 g.draw(c,'pet','#5ae5ff');g.draw(c,'pet','#5ae5ff');assert.equal(canvases,3);
});

test('sprite cache retains recently used hulls when many palettes are rendered',()=>{
 let canvases=0;const gradient={addColorStop(){}},context=()=>new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(t,k)=>k in t?t[k]:()=>{}});
 const window={document:{createElement(){canvases++;return {getContext:()=>context()};}}};vm.runInNewContext(read('graphics-v161.js'),{window});
 const g=window.ggGraphics161,c=context(),color=i=>'#'+i.toString(16).padStart(6,'0');
 for(let i=0;i<128;i++)g.draw(c,'scout',color(i));
 g.draw(c,'scout',color(0));assert.equal(canvases,128);
 g.draw(c,'scout',color(128));assert.equal(canvases,129);
 g.draw(c,'scout',color(0));assert.equal(canvases,129);
 g.draw(c,'scout',color(1));assert.equal(canvases,130);
});
test('HUD resize work is coalesced and avoids unchanged style mutations',()=>{
 const hud=read('gold-hud.js');assert.match(hud,/if\(layoutQueued\)return/);assert.match(hud,/getPropertyValue\(name\)!==next/);assert.match(hud,/requestAnimationFrame/);assert.match(hud,/attributeFilter:\['hidden'\]/);
});

test('HUD values are only written when changed and radar grid is cached',()=>{
 const game=read('game.js'),window={},vmContext={};
 vm.runInNewContext(game.slice(game.indexOf('function setHudText('),game.indexOf('function updateHud('))+';this.setHudText=setHudText;this.setHudValue=setHudValue;',vmContext);
 let writes=0,value='42';const node={get textContent(){return value;},set textContent(v){writes++;value=v;}};
 vmContext.setHudText(node,42);assert.equal(writes,0);vmContext.setHudText(node,43);assert.equal(writes,1);
 const meter={get value(){return value;},set value(v){writes++;value=String(v);}};vmContext.setHudValue(meter,43);assert.equal(writes,1);vmContext.setHudValue(meter,44);assert.equal(writes,2);
 assert.match(game,/if\(!radarGrid\|\|radarTheme!==theme\|\|radarGrid.width!==w\|\|radarGrid.height!==h\)/);
 assert.match(game,/if\(!mini.closest\('\[hidden\]'\)\)radar\(\)/);
});

test('distant entity interpolation snaps only outside the warm-up viewport, local pilot stays smooth',()=>{
 const game=read('game.js'),c={};vm.runInNewContext(game.slice(game.indexOf('function advanceVisual('),game.indexOf('function frame('))+';this.advance=advanceVisual;',c);
 const camera={x:0,y:0},w=1000,h=800;
 const far={x:3000,y:0,a:0,tx:3100,ty:50,ta:1};c.advance(far,.5,camera,w,h);assert.equal(far.x,3100);assert.equal(far.y,50);assert.equal(far.a,1);
 const close={x:100,y:0,a:0,tx:200,ty:50,ta:1};c.advance(close,.5,camera,w,h);assert.equal(close.x,150);assert.equal(close.y,25);assert.equal(close.a,.5);
 const incoming={x:1500,y:0,a:0,tx:1100,ty:0,ta:0};c.advance(incoming,.5,camera,w,h);assert.equal(incoming.x,1300);
 const local={x:3000,y:0,a:0,tx:3100,ty:0,ta:0};c.advance(local,.5,camera,w,h,true);assert.equal(local.x,3050);
 const crossing={x:-3000,y:0,a:0,tx:3000,ty:0,ta:0};c.advance(crossing,.5,camera,w,h);assert.equal(crossing.x,0);
});

test('viewport culling retains objects whose edges intersect the visible map',()=>{
 const game=read('game.js'),c={};vm.runInNewContext(game.slice(game.indexOf('function intersectsViewport('),game.indexOf('function screen('))+';this.visible=intersectsViewport;',c);
 assert.equal(c.visible({x:-100,y:250},150,1000,600),true);
 assert.equal(c.visible({x:-151,y:250},150,1000,600),false);
 assert.equal(c.visible({x:500,y:751},150,1000,600),false);
 assert.equal(c.visible({x:500,y:750},150,1000,600),true);
 assert.equal(c.visible({x:500,y:300},0,1000,600),true);
 assert.match(game,/near=nearestPortal\(list\)/);
});

test('metallic cockpit keeps twenty arsenal slots in two rows of ten',()=>{
 const hud=read('gold-hud.js'),css=read('gold-hud.css'),html=read('index.html');
 assert.match(hud,/for\(let i=1;i<20;i\+\+\)/);assert.match(hud,/slots.append\(fire\)/);
 assert.match(css,/grid-template-columns:repeat\(10,minmax\(0,1fr\)\)/);
 assert.match(html,/gg-radar-key/);assert.match(hud,/gold-hud\.css\?v=\d+/);
});


test('conservative laser culling retains crossing segments and viewport-edge effects',()=>{
 const game=read('game.js'),c={};vm.runInNewContext(game.slice(game.indexOf('function segmentIntersectsViewport('),game.indexOf('function drawLasers('))+';this.visible=segmentIntersectsViewport;',c);
 assert.equal(c.visible({x:-400,y:300},{x:1400,y:300},1000,600),true);
 assert.equal(c.visible({x:-80,y:10},{x:-21,y:500},1000,600),false);
 assert.equal(c.visible({x:1020,y:10},{x:1200,y:500},1000,600),true);
 assert.equal(c.visible({x:0,y:621},{x:900,y:700},1000,600),false);
 assert.match(game,/intersectsViewport\(q,radius\+80\)/);
 assert.match(game,/v.x===v.tx&&v.y===v.ty&&v.a===v.ta/);
 assert.match(game,/radarIntervals=\{low:200,medium:150,high:100\}/);
 assert.match(game,/radarMap===state.map/);
});

test('normal Streuner receives an isolated cached metallic hull; other NPCs keep their original artwork',()=>{let canvases=0,draws=0;const grad={addColorStop(){}};const ctx=()=>new Proxy({createLinearGradient:()=>grad,createRadialGradient:()=>grad,drawImage(){draws++;}},{get:(t,k)=>k in t?t[k]:()=>{}});const window={document:{createElement(){canvases++;return {getContext:ctx};}}};vm.runInNewContext(read('graphics-v161.js'),{window});const g=window.ggGraphics161,style=g.npcStyle('Streuner','drone');assert.equal(style.kind,'streuner-original');assert.equal(style.color,'#b94c3e');g.draw(ctx(),style.kind,style.color);g.draw(ctx(),style.kind,style.color);assert.equal(canvases,1);assert.equal(draws,2);});

test('all catalog formations have distinct ten-drone visual geometry and no overlapping points',()=>{
 const window={};vm.runInNewContext(read('graphics-v161.js'),{window});const g=window.ggGraphics161;
 const {FORMATIONS}=require('../formations-v19');const fingerprints=new Set();
 for(const f of FORMATIONS){const points=g.formationOffsets(10,f.id);assert.equal(points.length,10,f.id);const fingerprint=points.map(p=>p.x+','+p.y).sort().join(';');assert.equal(new Set(points.map(p=>p.x+','+p.y)).size,10,f.id);assert.ok(!fingerprints.has(fingerprint),f.id);fingerprints.add(fingerprint);assert.equal(g.formationOffsets(6,f.id).length,6);}
});
