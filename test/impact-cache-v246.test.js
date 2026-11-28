'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create,MAX}=require('../public/impact-cache-v246');
function mock(){let created=0,draws=0;const doc={createElement(){created++;return {getContext:()=>({scale(){},beginPath(){},arc(){},stroke(){}})};}};return {doc,ctx:{drawImage(){draws++;}},counts:()=>[created,draws]};}
test('impact sprites are reused for identical visual parameters',()=>{const m=mock(),c=create(m.doc),s={impact:.3,color:'#579dff',rocket:false};assert.equal(c.draw(m.ctx,s,100,200,1),true);assert.equal(c.draw(m.ctx,s,110,210,1),true);assert.deepEqual(m.counts(),[1,2]);assert.equal(c.size(),1);c.draw(m.ctx,s,100,200,.5,2);assert.equal(c.size(),2);});
test('cache stays bounded and can be cleared',()=>{const m=mock(),c=create(m.doc);for(let i=0;i<MAX+10;i++)c.draw(m.ctx,{impact:.5,color:'#'+i.toString(16).padStart(6,'0'),rocket:false},0,0,1);assert.equal(c.size(),MAX);c.clear();assert.equal(c.size(),0);});
test('unsupported contexts and invalid input use direct draw fallback',()=>{const c=create({createElement:()=>({getContext:()=>null})});assert.equal(c.draw({},null,0,0,1),false);assert.equal(c.draw({},{impact:null},0,0,1),false);assert.equal(c.draw({},{impact:.3,color:'#fff'},0,0,1),false);});
