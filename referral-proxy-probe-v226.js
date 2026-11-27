'use strict';
const crypto=require('node:crypto');
const {canonicalIP}=require('./referrals-v222');
const SENTINELS=new Set(['203.0.113.77','198.51.100.42']);
function createProxyProbe(key=crypto.randomBytes(32)){
 return (req,nonce)=>{
  if(typeof nonce!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nonce))throw Object.assign(Error('Identificador inválido'),{status:400});
  const raw=req.headers?.['x-forwarded-for'],parts=typeof raw==='string'&&raw.length<=2048?raw.split(',').map(x=>canonicalIP(x.trim())):[];
  const valid=parts.length>0&&parts.length<=32&&parts.every(Boolean);
  const peer=canonicalIP(req.socket?.remoteAddress),last=valid?parts.at(-1):null,cf=canonicalIP(req.headers?.['cf-connecting-ip']),client=canonicalIP(req.headers?.['true-client-ip']);
  const tag=ip=>ip?crypto.createHmac('sha256',key).update(nonce+':'+ip).digest('hex').slice(0,24):null;
  return {chainLength:valid?parts.length:0,validChain:valid,peer:tag(peer),candidate:tag(last),cloudflare:tag(cf),trueClient:tag(client),candidateIsPeer:!!last&&last===peer,candidateIsSentinel:SENTINELS.has(last),headersAgree:!!last&&last===cf&&last===client,probeOnly:true};
 };
}
module.exports={createProxyProbe};
