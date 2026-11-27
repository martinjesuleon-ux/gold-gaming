'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8'),server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
test('session retry is bounded and only handles temporary failure codes',()=>{
 const c={};vm.runInNewContext(game.slice(game.indexOf('function retryJoinDelay('),game.indexOf('function clearJoinRetry('))+';this.retry=retryJoinDelay;',c);
 assert.deepEqual(Array.from({length:7},(_,i)=>c.retry(i,null,{code:'ACCOUNT_BUSY'})),[500,1000,2000,4000,8000,8000,null]);
 assert.equal(c.retry(0,Error('timeout'),null),500);assert.equal(c.retry(0,null,{code:'AUTH_REQUIRED'}),null);assert.equal(c.retry(0,null,{code:'SERVER_FULL'}),null);assert.equal(c.retry(0,null,{code:'DB_UNAVAILABLE'}),500);
});
test('reconnect invalidates stale join responses and prevents buffered targeting',()=>{
 assert.match(game,/generation!==joinGeneration\|\|!profile\|\|!socket.connected/);
 assert.match(game,/socket.on\('disconnect',\(\)=>\{joinGeneration\+\+;joinPending=false;clearJoinRetry\(\);recovering=recovering\|\|joined;joined=false/);
 assert.match(game,/function select\(id\)\{if\(!joined\|\|!socket.connected\)return/);
 assert.match(server,/code:'ACCOUNT_BUSY'/);assert.match(server,/code:'AUTH_REQUIRED'/);assert.match(server,/code:'DB_UNAVAILABLE'/);
});
