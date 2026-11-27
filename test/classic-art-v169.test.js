'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function boot(){
 let theme='gold';
 const canvasCalls=[];
 const methods=['arc','beginPath','bezierCurveTo','closePath','drawImage','ellipse','fill','fillRect','fillText','lineTo','moveTo','quadraticCurveTo','restore','rotate','save','scale','stroke','translate'];
 const context=()=>Object.assign(Object.fromEntries(methods.map(name=>[name,(...args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),name+' received non-finite coordinate');canvasCalls.push(name);} ])),{
  createLinearGradient:()=>({addColorStop(offset,color){assert.ok(offset>=0&&offset<=1);assert.equal(typeof color,'string');}}),
  createRadialGradient:()=>({addColorStop(offset,color){assert.ok(offset>=0&&offset<=1);assert.equal(typeof color,'string');}})
 });
 const window={devicePixelRatio:1,document:{createElement(tag){assert.equal(tag,'canvas');return {getContext:()=>context()};}},ggVisualTheme:{current:()=>theme}};
 for(const file of ['classic-art-v166.js','graphics-v161.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public',file),'utf8'),{window},{filename:file});
 return {window,context,canvasCalls,setTheme(value){theme=value;}};
}

test('V1.69 classic species retain dedicated models across all tiers; GOLD remains independent',()=>{
 const {window,context,setTheme}=boot(),g=window.ggGraphics161,art=window.ggClassicArt;
 const species={Lordakia:'alien',Saimon:'alien',Mordon:'largeAlien',Devolarium:'largeAlien',Kristallin:'largeAlien',Kristallon:'largeAlien',Cubikon:'largeAlien',Sibelon:'raider',Sibelonit:'raider',Lordakium:'raider'};
 const calls=[];
 for(const method of new Set(Object.values(species))){const original=art[method];art[method]=function(c,kind,color){calls.push([method,kind]);return original(c,kind,color);};}
 for(const [name,method] of Object.entries(species))for(const tier of ['normal','boss','uber','emperor']){
  const label=tier==='normal'?name:tier+' '+name;
  setTheme('gold');const standard=g.npcStyle(label,tier);assert.ok(!standard.kind.startsWith('classic-'));
  const before=calls.length;g.draw(context(),standard.kind,standard.color);assert.equal(calls.length,before);
  setTheme('classic');const classic=g.npcStyle(label,tier),kind='classic-'+name.toLowerCase()+(tier==='normal'?'':'-'+tier);
  assert.equal(classic.kind,kind);assert.equal(classic.tier,tier);
  g.draw(context(),classic.kind,classic.color);assert.deepEqual(calls.at(-1),[method,kind]);assert.equal(calls.length,before+1);
  setTheme('gold');assert.equal(g.npcStyle(label,tier).kind,standard.kind);
 }
});

test('V1.69 classic Goliath and PET execute drawing paths without non-finite coordinates',()=>{
 const {window,context,canvasCalls,setTheme}=boot();setTheme('classic');
 const g=window.ggGraphics161,ship=g.playerStyle('goliath',null,true);
 assert.equal(ship.kind,'classic-ship-goliath');g.draw(context(),ship.kind,ship.color);g.draw(context(),'pet','#76f5bd');
 assert.ok(canvasCalls.includes('drawImage'));assert.ok(canvasCalls.includes('fill'));
});
