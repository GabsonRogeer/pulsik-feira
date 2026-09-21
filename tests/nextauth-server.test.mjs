import {test} from 'node:test';import assert from 'node:assert/strict';import {hashSync} from 'bcryptjs';import {loadTs} from './helpers/load-ts.mjs';
test('server credentials, OTP and session authorization',async(t)=>{
 process.env.AUTH_SECRET='local-test-secret-not-a-deployment-secret';process.env.AUTH_URL='http://localhost:3000';
 let allowed=true,verified=false;let record={id:'id-admin',email:'a@example.com',name:'Admin',email_verified:true,is_admin:true,password_hash:hashSync('test-password',4)};
 const calls=[];const chain={select(){return this},eq(){return this},async maybeSingle(){return {data:record,error:null}}};
 const service=loadTs(new URL('../lib/server/auth-service.ts',import.meta.url),{'server-only':{},'../email/access-code':{},'./db':{db:()=>({from:()=>chain}),rpc:async(name,args)=>{calls.push({name,args});if(name==='pulsik_auth_limit')return allowed;if(name==='pulsik_verify_code')return verified;return {id:'id-verified',email:args.p_email}}}});
 await t.test('password and server admin flag are both required',async()=>{
 assert.equal((await service.passwordLogin('pulsikadmin','test-password')).id,'id-admin');
 assert.equal(await service.passwordLogin('pulsikadmin','wrong'),null);
 record.is_admin=false;assert.equal(await service.passwordLogin('pulsikadmin','test-password'),null);record.is_admin=true;
 allowed=false;await assert.rejects(service.passwordLogin('pulsikadmin','test-password'),/rate_limit/);allowed=true;
 });
 await t.test('OTP is HMAC-bound to email and cannot authenticate before verification',async()=>{
 assert.equal(await service.emailCodeLogin('v@example.com','123456'),null);
 assert.equal(await service.emailCodeLogin('v@example.com','123'),null);
 verified=true;assert.equal((await service.emailCodeLogin(' V@example.com ','123456')).id,'id-verified');
 const verifyCall=calls.find(c=>c.name==='pulsik_verify_code');assert.equal(verifyCall.args.p_hash,service.digest('v@example.com:123456'));
 assert.notEqual(service.digest('v@example.com:123456'),service.digest('other@example.com:123456'));
 });
 let session=null;
 const api=loadTs(new URL('../lib/server/api.ts',import.meta.url),{'server-only':{},'@/auth':{auth:async()=>session},'./db':{db:()=>({from:()=>chain})}});
 await t.test('API requires a valid session; admin requires role and password provider',async()=>{
 await assert.rejects(api.identity(),/unauthorized/);
 session={user:{id:record.id},authMethod:'google'};await assert.rejects(api.identity(true),/forbidden/);
 session.authMethod='admin';assert.equal((await api.identity(true)).id,'id-admin');
 record.is_admin=false;await assert.rejects(api.identity(true),/forbidden/);record.is_admin=true;
 });
 await t.test('mutations reject foreign origins and malformed bodies',async()=>{
 assert.throws(()=>api.checkOrigin(new Request('http://localhost:3000/api/spin',{headers:{origin:'https://evil.example'}})),/forbidden/);
 api.checkOrigin(new Request('http://localhost:3000/api/spin',{headers:{origin:'http://localhost:3000'}}));
 for(const value of ['null','[]','"string"','{'])await assert.rejects(api.body(new Request('http://localhost:3000',{method:'POST',headers:{'content-type':'application/json'},body:value})),/invalid_request/);
 });
});
