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
 assert.match(game,/Math.min\(10,Math.max\(0,Number\(o.droneCount\)/);
});

test('each drone palette reflects its equipped design, not its rank or unknown values',()=>{
 const window={};vm.runInNewContext(read('graphics-v161.js'),{window});
 const color=window.ggGraphics161.droneColor;
 assert.equal(color(undefined),'#aab4bd');assert.equal(color(null),'#aab4bd');assert.equal(color('unknown'),'#aab4bd');
 assert.equal(color('Havoc'),'#ff3838');assert.equal(color('Hercules'),'#398dff');assert.equal(color('Spartan'),'#ff8a24');
 assert.match(read('game.js'),/droneColor\(drone\?\.design\)/);
});
