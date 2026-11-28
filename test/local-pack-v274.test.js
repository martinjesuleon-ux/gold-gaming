'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('local MOD validates metadata, preserves original renderer and isolates GOLD',async()=>{
 let theme='classic',fallback=0;const window={ggVisualTheme:{current:()=>theme},ggClassicPack:{draw(){fallback++;return false},shop(){return false},cover(){return false}},Image:class{set src(v){this.naturalWidth=64;this.naturalHeight=32;this.onload();}}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/local-pack-v274.js'),'utf8'),{window});const m=window.ggLocalPack;
 const asset={key:'sprite:classic-ship-phoenix',source:'ship1.swf',data:'data:image/webp;base64,AAAA',mode:'directional',frames:2,columns:2,width:30,height:30};
 const data={version:1,assets:[asset]};await m.load({size:100,text:async()=>JSON.stringify(data)});assert.equal(m.count(),1);
 const calls=[],c={save(){},restore(){},rotate(a){calls.push(a)},drawImage(...args){calls.push(args)}};
 assert.equal(window.ggClassicPack.draw(c,asset.key,{angle:Math.PI,rotated:true}),true);assert.deepEqual(calls[1].slice(1,5),[32,0,32,32]);
 assert.equal(window.ggClassicPack.draw(c,'sprite:classic-ship-goliath'),false);
 theme='gold';assert.equal(window.ggClassicPack.draw(c,asset.key),false);await assert.rejects(m.load({size:100,text:async()=>JSON.stringify(data)}),/Clásico/);theme='classic';
 assert.throws(()=>m.validate({version:1,assets:[{...asset,data:'https://example.com/a.png'}]}),/inválido/);
 assert.throws(()=>m.validate({version:1,assets:[asset,asset]}),/inválido/);
 assert.throws(()=>m.validate({version:1,assets:[{...asset,frames:0}]}),/inválidos/);assert.equal(m.count(),1);
 m.clear();assert.equal(window.ggClassicPack.draw(c,asset.key),false);assert.equal(fallback,3);
});
