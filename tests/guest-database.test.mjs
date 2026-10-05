import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("guest registration, recovery, isolation and database privileges", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const q = (sql, args = []) => db.query(sql, args);
  const val = async (sql, args = []) => (await q(sql, args)).rows[0].v;
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',encrypted_password text);
    create table auth.identities(user_id uuid references auth.users(id),provider text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;`);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    await db.exec(await readFile(new URL(name, directory), "utf8"));
  }
  await db.exec(
    "update public.pulsik_campaigns set active=true,starts_at=now()-interval '1 day',ends_at=now()+interval '1 day'",
  );
  const real = "siara-2026",
    trial = "siara-2026-test";
  const token = () => randomBytes(32).toString("hex");
  const register = (
    email,
    hash = token(),
    campaign = real,
    phone = "85989255170",
  ) =>
    val(
      "select public.pulsik_register_guest($1,$2,$3,'Visitante','Empresa','Cargo',$4,false) as v",
      [hash, campaign, email, phone],
    );
  const hash = token();
  let guest;

  await t.test(
    "service role creates user, participant and session atomically without verifying email",
    async () => {
      await db.exec("set role service_role");
      guest = await register(" GUEST@EXAMPLE.COM ", hash);
      await db.exec("reset role");
      assert.equal(guest.email, "guest@example.com");
      assert.equal(guest.status, "ready");
      const user = (
        await q("select * from public.pulsik_users where id=$1", [
          guest.user_id,
        ])
      ).rows[0];
      assert.equal(user.email_verified, false);
      assert.equal(user.is_admin, false);
      assert.equal(user.password_hash, null);
      const session = (
        await q(
          "select * from public.pulsik_guest_sessions where token_hash=$1",
          [hash],
        )
      ).rows[0];
      assert.equal(session.user_id, guest.user_id);
      assert.equal(
        new Date(session.expires_at) - new Date(session.created_at),
        8 * 3600000,
      );
    },
  );

  await t.test(
    "same secret recovers a lost response; a different visitor cannot claim that email",
    async () => {
      assert.equal((await register("guest@example.com", hash)).id, guest.id);
      await assert.rejects(register("GUEST@example.com"), /duplicate_email/);
      await assert.rejects(
        register("other@example.com", hash),
        /duplicate_email/,
      );
      await assert.rejects(
        register("guest@example.com", token(), trial),
        /duplicate_email/,
      );
      assert.equal(
        await val("select count(*)::int as v from public.pulsik_users"),
        1,
      );
    },
  );

  await t.test(
    "simultaneous duplicate submissions create exactly one participant",
    async () => {
      const attempts = await Promise.allSettled(
        Array.from({ length: 12 }, () => register("race@example.com")),
      );
      assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
      for (const result of attempts.filter((r) => r.status === "rejected"))
        assert.match(result.reason.message, /duplicate_email/);
      assert.equal(
        await val(
          "select count(*)::int as v from public.pulsik_participants where email='race@example.com'",
        ),
        1,
      );
    },
  );

  await t.test(
    "invalid input and closed campaigns create no orphan accounts",
    async () => {
      await assert.rejects(
        register("bad@example.com", token(), real, "123"),
        /invalid_phone/,
      );
      await assert.rejects(register("bad email"), /invalid_email/);
      await assert.rejects(
        register("bad@example.com", "forged"),
        /invalid_request/,
      );
      await q("update public.pulsik_campaigns set active=false where id=$1", [
        trial,
      ]);
      await assert.rejects(
        register("closed@example.com", token(), trial),
        /campaign_closed/,
      );
      assert.equal(
        await val(
          "select count(*)::int as v from public.pulsik_users where email in ('bad@example.com','closed@example.com')",
        ),
        0,
      );
      await q("update public.pulsik_campaigns set active=true where id=$1", [
        trial,
      ]);
    },
  );

  await t.test(
    "existing verified and administrator accounts cannot be accessed by guests",
    async () => {
      const admin = await val(
        "select public.pulsik_verified_user('admin@example.com','Admin') as v",
      );
      await q("update public.pulsik_users set is_admin=true where id=$1", [
        admin.id,
      ]);
      await assert.rejects(register(admin.email), /duplicate_email/);
      await assert.rejects(
        val("select public.pulsik_admin_test_state($1,false) as v", [
          guest.user_id,
        ]),
        /admin_required/,
      );
    },
  );

  await t.test(
    "guest spin is idempotent; verified login preserves owner, prize and inventory",
    async () => {
      await db.exec(
        "create or replace function public.pulsik_draw() returns numeric language sql volatile set search_path='' as $$ select 1::numeric $$",
      );
      const request = randomUUID();
      const spin = await val("select public.pulsik_spin_v2($1,$2,$3) as v", [
        guest.user_id,
        real,
        request,
      ]);
      assert.equal(spin.outcome, "cup");
      assert.equal(
        (await register(guest.email, hash)).claim_code,
        spin.claim_code,
      );
      const owner = await val(
        "select public.pulsik_verified_user($1,'Owner') as v",
        [guest.email],
      );
      assert.equal(owner.id, guest.user_id);
      await assert.rejects(register(guest.email, hash), /duplicate_email/);
      const repeat = await val("select public.pulsik_spin_v2($1,$2,$3) as v", [
        owner.id,
        real,
        randomUUID(),
      ]);
      assert.equal(repeat.id, spin.id);
      assert.equal(
        await val(
          "select remaining as v from public.pulsik_prizes where campaign_id=$1 and id='cup'",
          [real],
        ),
        29,
      );
    },
  );

  await t.test("expired sessions cannot recover registration", async () => {
    const expired = token();
    await register("expired@example.com", expired);
    await q(
      "update public.pulsik_guest_sessions set created_at=now()-interval '9 hours',expires_at=now()-interval '1 hour' where token_hash=$1",
      [expired],
    );
    await assert.rejects(
      register("expired@example.com", expired),
      /unauthorized/,
    );
  });

  await t.test("test reset cascades only test guest sessions", async () => {
    await register("trial@example.com", token(), trial);
    const admin = await val(
      "select id as v from public.pulsik_users where email='admin@example.com'",
    );
    await val(
      "select public.pulsik_admin_reset_test($1,$2,'LIMPAR TESTES') as v",
      [admin, trial],
    );
    assert.equal(
      await val(
        "select count(*)::int as v from public.pulsik_guest_sessions where campaign_id=$1",
        [trial],
      ),
      0,
    );
    assert.ok(
      (await val(
        "select count(*)::int as v from public.pulsik_guest_sessions where campaign_id=$1",
        [real],
      )) > 0,
    );
  });

  await t.test(
    "public roles cannot read secrets or execute guest registration",
    async () => {
      assert.equal(
        await val(
          "select relrowsecurity as v from pg_class where oid='public.pulsik_guest_sessions'::regclass",
        ),
        true,
      );
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`);
        await assert.rejects(
          q("select * from public.pulsik_guest_sessions"),
          /permission denied/,
        );
        await assert.rejects(
          register("denied@example.com"),
          /permission denied/,
        );
        await db.exec("reset role");
      }
    },
  );

  await t.test(
    "600 requests per five minutes and one per twenty seconds are enforced persistently",
    async () => {
      const limits = await q(
        "select public.pulsik_auth_limit('stand',600,300) as allowed from generate_series(1,601)",
      );
      assert.equal(limits.rows.filter((r) => r.allowed).length, 600);
      assert.equal(
        await val("select public.pulsik_auth_limit('email',1,20) as v"),
        true,
      );
      assert.equal(
        await val("select public.pulsik_auth_limit('email',1,20) as v"),
        false,
      );
      await db.exec(
        "update public.pulsik_auth_limits set resets_at=now()-interval '1 second'",
      );
      assert.equal(
        await val("select public.pulsik_auth_limit('stand',600,300) as v"),
        true,
      );
      assert.equal(
        await val("select public.pulsik_auth_limit('email',1,20) as v"),
        true,
      );
    },
  );
});
