import {test} from 'node:test';import assert from 'node:assert/strict';import {loadTs} from './helpers/load-ts.mjs';
test('admin credentials use NextAuth; failure never grants client access',async()=>{
 let input;let fail=false;
 const {signInAdmin}=loadTs(new URL('../lib/admin-auth.ts',import.meta.url),{'next-auth/react':{signIn:async(provider,body)=>{input={provider,...body};return fail?{error:'CredentialsSignin'}:{error:null}}}});
 await assert.rejects(signInAdmin('','x'),/invalid_credentials/);
 await signInAdmin(' pulsikadmin ','test-password');assert.deepEqual(input,{provider:'admin',username:'pulsikadmin',password:'test-password',redirect:false});
 fail=true;await assert.rejects(signInAdmin('pulsikadmin','wrong'),/invalid_credentials/);
});
