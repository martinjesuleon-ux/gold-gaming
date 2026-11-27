'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {hashPassword,verifyPassword}=require('../accounts');
test('contraseñas: hash salado, verificación y rechazo',async()=>{const p='Prueba-segura-123';const a=await hashPassword(p),b=await hashPassword(p);assert.notEqual(a,b);assert(!a.includes(p));assert.equal(await verifyPassword(p,a),true);assert.equal(await verifyPassword('incorrecta',a),false);assert.equal(await verifyPassword(p,'!disabled!'),false);});
