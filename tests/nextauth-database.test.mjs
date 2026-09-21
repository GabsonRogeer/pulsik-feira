import {test,after} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';import {hashSync,compareSync} from 'bcryptjs';
const db=new PGlite();after(()=>db.close());
const migration=async name=>db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
const query=async(sql,args=[])=>db.query(sql,args);
const value=async(sql,args=[]) => (await query(sql,args)).rows[0].v;
const campaign='siara-2026';
test('NextAuth cutover preserves data and enforces server-only operations',async(t)=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',encrypted_password text);
 create table auth.identities(user_id uuid references auth.users(id),provider text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated,service_role;`);
 for(const name of ['202609170001_pulsik.sql','202609170002_email_login.sql','202609210001_participant_phone.sql'])await migration(name);
 const admin=randomUUID(),visitor=randomUUID();const passwordHash=hashSync('migration-test-password',4);
 await query("insert into auth.users(id,email,email_confirmed_at,encrypted_password) values($1,'pulsikadmin@pulsik.com.br',now(),$3),($2,'visitor@example.com',now(),null)",[admin,visitor,passwordHash]);
 await query("insert into auth.identities values($1,'google'),($2,'email')",[visitor,admin]);
 await query('insert into public.pulsik_admins values($1)',[admin]);
 await db.exec("update public.pulsik_campaigns set starts_at=now()-interval '1 day',ends_at=now()+interval '1 day'");
 await query("select set_config('request.jwt.claim.sub',$1,false)",[visitor]);
 const old=await value("select public.pulsik_register($1,'Visitante','Empresa','Cargo','85989255170',false) as v",[campaign]);
 await db.exec("create or replace function public.pulsik_draw() returns numeric language sql volatile set search_path='' as $$ select 1::numeric $$");
 const oldSpin=await value('select public.pulsik_spin($1,$2) as v',[campaign,randomUUID()]);
 await migration('202609210002_nextauth.sql');
 await t.test('UUIDs, passwords, prizes and inventory survive the migration',async()=>{
 const row=(await query('select * from public.pulsik_users where id=$1',[admin])).rows[0];
 assert.equal(row.username,'pulsikadmin');assert.equal(row.is_admin,true);assert.ok(compareSync('migration-test-password',row.password_hash));
 assert.equal((await query('select user_id from public.pulsik_participants where id=$1',[old.id])).rows[0].user_id,visitor);
 assert.equal((await query("select remaining from public.pulsik_prizes where id='cup'")).rows[0].remaining,29);
 });
 await t.test('legacy public and authenticated keys cannot access data or call either version of RPCs',async()=>{
 for(const role of ['anon','authenticated']){
 await db.exec('set role '+role);
 for(const sql of ['select * from public.pulsik_users','select * from public.pulsik_participants','select * from public.pulsik_email_codes',"select public.pulsik_verified_user('attacker@example.com',null)","select public.pulsik_spin_v2('"+visitor+"','siara-2026','"+randomUUID()+"')","select public.pulsik_spin('siara-2026','"+randomUUID()+"')"]){await assert.rejects(query(sql),/permission denied/);}
 await db.exec('reset role');
 }
 });
 await db.exec('set role service_role');
 await t.test('verified email reuses migrated identity and final result',async()=>{
 const user=await value("select public.pulsik_verified_user(' VISITOR@EXAMPLE.COM ',null) as v");assert.equal(user.id,visitor);
 const result=await value('select public.pulsik_spin_v2($1,$2,$3) as v',[visitor,campaign,randomUUID()]);assert.equal(result.id,oldSpin.id);
 });
 await t.test('new email/Google identity shares one participation and retry remains usable',async()=>{
 const user=await value("select public.pulsik_verified_user('new@example.com','New') as v");
 const again=await value("select public.pulsik_verified_user('NEW@example.com','Google Name') as v");assert.equal(user.id,again.id);
 const reg=()=>value("select public.pulsik_register_v2($1,$2,'Name','Company','Role','85989255170',false) as v",[user.id,campaign]);
 assert.equal((await reg()).id,(await reg()).id);
 await db.exec("reset role;create or replace function public.pulsik_draw() returns numeric language sql volatile set search_path='' as $$ select 95::numeric $$;set role service_role");
 const request=randomUUID();const a=await value('select public.pulsik_spin_v2($1,$2,$3) as v',[user.id,campaign,request]);assert.equal(a.outcome,'retry');
 assert.equal((await value('select public.pulsik_spin_v2($1,$2,$3) as v',[user.id,campaign,request])).id,a.id);
 await db.exec("reset role;create or replace function public.pulsik_draw() returns numeric language sql volatile set search_path='' as $$ select 50::numeric $$;set role service_role");
 assert.equal((await value('select public.pulsik_spin_v2($1,$2,$3) as v',[user.id,campaign,randomUUID()])).outcome,'none');
 });
 await t.test('only real admins may redeem and redemption remains idempotent',async()=>{
 await assert.rejects(value('select public.pulsik_redeem_v2($1,$2) as v',[visitor,oldSpin.claim_code]),/admin_required/);
 assert.equal((await value('select public.pulsik_redeem_v2($1,$2) as v',[admin,oldSpin.claim_code])).already_redeemed,false);
 assert.equal((await value('select public.pulsik_redeem_v2($1,$2) as v',[admin,oldSpin.claim_code])).already_redeemed,true);
 });
 await t.test('OTP is consumed once, expires, and locks after five wrong attempts',async()=>{
 const store=()=>query("insert into public.pulsik_email_codes values('code@example.com','correct',now()+interval '10 minutes',0) on conflict(email) do update set token_hash='correct',expires_at=now()+interval '10 minutes',attempts=0");
 const verify=hash=>value("select public.pulsik_verify_code('code@example.com',$1) as v",[hash]);
 await store();for(let i=0;i<5;i++)assert.equal(await verify('wrong'),false);assert.equal(await verify('correct'),false);
 await store();assert.equal(await verify('correct'),true);assert.equal(await verify('correct'),false);
 await store();await query("update public.pulsik_email_codes set expires_at=now()-interval '1 second'");assert.equal(await verify('correct'),false);
 });
 await t.test('rate limit counters persist and reset after their window',async()=>{
 const hit=()=>value("select public.pulsik_auth_limit('test',2,60) as v");assert.equal(await hit(),true);assert.equal(await hit(),true);assert.equal(await hit(),false);
 await query("update public.pulsik_auth_limits set resets_at=now()-interval '1 second'");assert.equal(await hit(),true);
 });
});
