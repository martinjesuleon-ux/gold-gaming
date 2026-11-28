'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build}=require('../public/performance-report-v251');
const meta={theme:'classic',quality:'high',fpsLimit:120,rtt:25,w:1920,h:1080,dpr:2,entities:40,username:'private',token:'secret'};
test('report requires a minimum of 30 measured intervals',()=>{assert.equal(build(null,meta),null);assert.equal(build({fps:60,p95:16.7,count:29,slow:0},meta),null);});
test('report reflects measured frame window and excludes private metadata',()=>{const r=build({fps:59.94,p95:18.23,count:240,slow:2},meta);assert.equal(r.fpsPromedio,59.9);assert.equal(r.p95Ms,18.2);assert.equal(r.ventanaSegundos,4);assert.equal(r.tema,'Clásico');assert.equal(r.latenciaMs,25);assert.equal(r.entidades,40);assert.equal(r.username,undefined);assert.equal(r.token,undefined);assert.equal(build({fps:60,p95:17,count:60,slow:0},{...meta,rtt:null}).latenciaMs,null);});
