'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../public/classic-pack-v263.js'),'utf8');
const item={key:'sprite:classic-ship-goliath',file:'ships/goliath.png',source:'test',permission:'test fixture',mode:'directional',frames:32,columns:8,width:96,height:80};
function setup(assets=[item]){
 let theme='gold',fetches=0;const pending=[],events={},window={ggVisualTheme:{current:()=>theme},fetch:async()=>{fetches++;return {ok:true,json:async()=>({version:1,assets})};},Image:class{constructor(){pending.push(this);this.naturalWidth=800;this.naturalHeight=400;}},addEventListener(name,fn){events[name]=fn;},dispatchEvent(e){events[e.type]?.();}};
 vm.runInNewContext(code,{window,Event:class{constructor(type){this.type=type;}}});
 return {api:window.ggClassicPack,pending,fetches:()=>fetches,set(v){theme=v;events['gg:visualTheme']?.();}};
}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
test('classic pack validates provenance, safe paths, atlas dimensions and uniqueness',()=>{
 const {api}=setup();assert.equal(api.validate({version:1,assets:[item]}).size,1);
 for(const bad of [{file:'../x.png'},{file:'https://example.com/x.png'},{file:'x.swf'},{permission:''},{frames:121},{columns:33},{width:-1},{mode:'static'}])assert.throws(()=>api.validate({version:1,assets:[{...item,...bad}]}));
 assert.throws(()=>api.validate({version:1,assets:[item,item]}));
});
test('classic atlas loads lazily, draws correct heading, and never overrides GOLD',async()=>{
 const s=setup(),calls=[],c={save(){},restore(){},rotate(a){calls.push(a);},drawImage(...a){calls.push(a);}};
 assert.equal(s.api.draw(c,item.key),false);assert.equal(s.fetches(),0);s.set('classic');await turn();
 assert.equal(s.api.status().state,'ready');assert.equal(s.api.draw(c,item.key),false);assert.equal(s.pending.length,1);
 s.pending[0].onload();assert.equal(s.api.draw(c,item.key,{angle:Math.PI/2,rotated:true}),true);
 assert.equal(calls[0],-Math.PI/2);assert.deepEqual(calls[1].slice(1),[0,100,100,100,-48,-40,96,80]);
 s.set('gold');assert.equal(s.api.draw(c,item.key),false);assert.equal(s.api.cover(c,'map:default',100,100),false);
 s.set('classic');assert.equal(s.api.draw(c,'unknown'),false);assert.equal(s.fetches(),1);
});
test('missing images retain fallback; empty packs are valid',async()=>{
 const s=setup();s.set('classic');await turn();assert.equal(s.api.draw({},item.key),false);s.pending[0].onerror();assert.equal(s.api.draw({},item.key),false);
 const e=setup([]);e.set('classic');await turn();assert.equal(e.api.status().count,0);assert.equal(e.api.draw({},item.key),false);
});
