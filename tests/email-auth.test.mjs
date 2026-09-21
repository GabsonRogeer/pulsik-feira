import {test} from 'node:test';import assert from 'node:assert/strict';import {loadTs} from './helpers/load-ts.mjs';
test('email login uses our code endpoint and NextAuth rather than Supabase Auth',async()=>{
 const calls=[];let fail=false;
 const {normalizeEmail,sendEmailCode,verifyEmailCode}=loadTs(new URL('../lib/email-auth.ts',import.meta.url),{
 './api-client':{api:async(...args)=>calls.push(args)},
 'next-auth/react':{signIn:async(...args)=>{calls.push(args);return fail?{error:'CredentialsSignin'}:{error:null}},getSession:async()=>({user:{id:'test-id',email:'v@example.com',name:'Visitante'}})}
 });
 assert.equal(normalizeEmail(' V@EXAMPLE.COM '),'v@example.com');
 for(const invalid of ['', 'bad', 'a b@example.com'])await assert.rejects(sendEmailCode(invalid),/invalid_email/);
 assert.equal(calls.length,0);await sendEmailCode(' V@EXAMPLE.COM ');assert.deepEqual(calls[0],['/api/email-code',{email:'v@example.com'}]);
 await assert.rejects(verifyEmailCode('v@example.com','123'),/invalid_code/);
 assert.equal((await verifyEmailCode('v@example.com','123 456')).id,'test-id');
 assert.deepEqual(calls[1],['email-code',{email:'v@example.com',code:'123456',redirect:false}]);
 fail=true;await assert.rejects(verifyEmailCode('v@example.com','999999'),/invalid_code/);
});
