import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
test('Google requires verified email and uses the canonical database identity in the session',async()=>{
 let config;let calls=0;
 loadTs(new URL('../auth.ts',import.meta.url),{
  'next-auth':c=>{config=c;return {};},
  'next-auth/providers/google':c=>c,
  'next-auth/providers/credentials':c=>c,
  '@/lib/server/auth-service':{verifiedUser:async email=>{calls++;return {id:'canonical-id',email};}}
 });
 const user={id:'google-id'};const account={provider:'google'};
 assert.equal(await config.callbacks.signIn({user,account,profile:{email:'visitor@example.com',email_verified:false}}),false);
 assert.equal(calls,0);
 assert.equal(await config.callbacks.signIn({user,account,profile:{email:'visitor@example.com',email_verified:true}}),true);
 assert.equal(user.id,'canonical-id');
 const token=await config.callbacks.jwt({token:{},user,account});
 const session=await config.callbacks.session({session:{user:{}},token});
 assert.equal(session.user.id,'canonical-id');assert.equal(session.authMethod,'google');
});
