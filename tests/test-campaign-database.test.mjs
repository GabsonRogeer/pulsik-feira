import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
test("real test campaign: isolation, unspun registrations, inventory and safe reset", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const q = (sql, args = []) => db.query(sql, args);
  const val = async (sql, args = []) => (await q(sql, args)).rows[0].v;
  const migrate = async (name) =>
    db.exec(
      await readFile(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',encrypted_password text);
 create table auth.identities(user_id uuid references auth.users(id),provider text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated,service_role;`);
  for (const file of [
    "202609170001_pulsik.sql",
    "202609170002_email_login.sql",
    "202609210001_participant_phone.sql",
    "202609210002_nextauth.sql",
  ])
    await migrate(file);
  const admin = await val(
    "select public.pulsik_verified_user('admin@example.com','Admin') as v",
  );
  const visitor = await val(
    "select public.pulsik_verified_user('visitor@example.com','Visitor') as v",
  );
  const pending = await val(
    "select public.pulsik_verified_user('pending@example.com','Pending') as v",
  );
  await q("update public.pulsik_users set is_admin=true where id=$1", [
    admin.id,
  ]);
  const real = "siara-2026",
    test = "siara-2026-test";
  const register = (id, campaign) =>
    val(
      "select public.pulsik_register_v2($1,$2,'Visitor','Company','Role','85989255170',false) as v",
      [id, campaign],
    );
  const spin = (id, campaign, request = randomUUID()) =>
    val("select public.pulsik_spin_v2($1,$2,$3) as v", [id, campaign, request]);
  const draw = (n) =>
    db.exec(
      `create or replace function public.pulsik_draw() returns numeric language sql volatile set search_path='' as $$ select ${n}::numeric $$`,
    );
  await db.exec(
    "update public.pulsik_campaigns set starts_at=now()-interval '1 day',ends_at=now()+interval '1 day'",
  );
  await register(visitor.id, real);
  await register(pending.id, real);
  await draw(1);
  const prize = await spin(visitor.id, real);
  await db.exec(
    "update public.pulsik_campaigns set starts_at=now()+interval '10 days',ends_at=now()+interval '11 days'",
  );
  await migrate("202609210003_test_campaign.sql");
  const snapshot = async () => ({
    campaign: (
      await q("select * from public.pulsik_campaigns where id=$1", [real])
    ).rows,
    stock: (
      await q(
        "select * from public.pulsik_prizes where campaign_id=$1 order by id",
        [real],
      )
    ).rows,
    participants: (
      await q(
        "select * from public.pulsik_participants where campaign_id=$1 order by id",
        [real],
      )
    ).rows,
    spins: (
      await q(
        "select s.* from public.pulsik_spins s join public.pulsik_participants p on p.id=s.participant_id where p.campaign_id=$1",
        [real],
      )
    ).rows,
  });
  const baseline = await snapshot();
  const state = (active, id = admin.id) =>
    q("select public.pulsik_admin_test_state($1,$2)", [id, active]);
  const reset = (
    campaign = test,
    confirmation = "LIMPAR TESTES",
    id = admin.id,
  ) =>
    val("select public.pulsik_admin_reset_test($1,$2,$3) as v", [
      id,
      campaign,
      confirmation,
    ]);
  const stocks = async () =>
    (
      await q(
        "select * from public.pulsik_prizes where campaign_id=$1 order by id",
        [test],
      )
    ).rows;
  const adjust = (items, id = admin.id, campaign = test) =>
    q("select public.pulsik_admin_stock($1,$2,$3::jsonb)", [
      id,
      campaign,
      JSON.stringify(items),
    ]);
  let reg, win;
  await t.test(
    "existing rows get registration codes; test is initially paused and fair stays closed",
    async () => {
      assert.match(
        baseline.participants[0].registration_code,
        /^CAD-[A-F0-9]{16}$/,
      );
      await assert.rejects(register(visitor.id, test), /campaign_closed/);
      const newcomer = await val(
        "select public.pulsik_verified_user('new@example.com',null) as v",
      );
      await assert.rejects(register(newcomer.id, real), /campaign_closed/);
      await assert.rejects(state(true, visitor.id), /admin_required/);
    },
  );
  await t.test(
    "real login identity can register independently and admin sees it before the first spin",
    async () => {
      await state(true);
      reg = await register(visitor.id, test);
      assert.match(reg.registration_code, /^CAD-[A-F0-9]{16}$/);
      assert.equal(reg.claim_code, null);
      const row = (
        await q("select * from public.pulsik_admin_participants where id=$1", [
          reg.id,
        ])
      ).rows[0];
      assert.equal(row.spin_count, 0);
      assert.equal(row.status, "ready");
      assert.equal((await register(visitor.id, test)).id, reg.id);
      assert.notEqual(
        reg.id,
        baseline.participants.find((p) => p.user_id === visitor.id).id,
      );
    },
  );
  await t.test(
    "retry, winner and idempotency operate only on test stock",
    async () => {
      await draw(95);
      const request = randomUUID();
      assert.equal((await spin(visitor.id, test, request)).outcome, "retry");
      assert.equal((await spin(visitor.id, test, request)).outcome, "retry");
      assert.equal(
        (
          await q(
            "select spin_count from public.pulsik_admin_participants where id=$1",
            [reg.id],
          )
        ).rows[0].spin_count,
        1,
      );
      await draw(1);
      win = await spin(visitor.id, test);
      assert.match(win.claim_code, /^TST-/);
      assert.equal((await spin(visitor.id, test)).id, win.id);
      assert.equal((await stocks()).find((s) => s.id === "cup").remaining, 29);
      assert.deepEqual(await snapshot(), baseline);
    },
  );
  await t.test(
    "redemption checks role, selected campaign and test availability",
    async () => {
      const redeem = (id, campaign, code) =>
        val("select public.pulsik_admin_redeem($1,$2,$3) as v", [
          id,
          campaign,
          code,
        ]);
      await assert.rejects(
        redeem(visitor.id, test, win.claim_code),
        /admin_required/,
      );
      await assert.rejects(
        redeem(admin.id, real, win.claim_code),
        /code_not_found/,
      );
      await assert.rejects(
        redeem(admin.id, test, prize.claim_code),
        /code_not_found/,
      );
      await state(false);
      await assert.rejects(
        redeem(admin.id, test, win.claim_code),
        /campaign_closed/,
      );
      await state(true);
      assert.equal(
        (await redeem(admin.id, test, win.claim_code)).already_redeemed,
        false,
      );
      assert.equal(
        (await redeem(admin.id, test, win.claim_code)).already_redeemed,
        true,
      );
    },
  );
  await t.test(
    "editing available stock preserves awarded prizes and detects concurrent changes atomically",
    async () => {
      const items = (await stocks()).map((s) => ({
        id: s.id,
        expected: s.remaining,
        remaining: 5,
      }));
      await assert.rejects(adjust(items, visitor.id), /admin_required/);
      const stale = items.map((s, i) => ({
        ...s,
        expected: i === 2 ? s.expected + 1 : s.expected,
      }));
      await assert.rejects(adjust(stale), /stock_changed/);
      assert.equal((await stocks()).find((s) => s.id === "cup").remaining, 29);
      await adjust(items);
      const cup = (await stocks()).find((s) => s.id === "cup");
      assert.equal(cup.remaining, 5);
      assert.equal(cup.initial_stock, 6);
      await assert.rejects(adjust(items), /stock_changed/);
      const valid = (await stocks()).map((s) => ({
        id: s.id,
        expected: s.remaining,
        remaining: s.remaining,
      }));
      for (const amount of [-1, 1.5, 100001, null, "5"])
        await assert.rejects(
          adjust(
            valid.map((s, i) => (i === 0 ? { ...s, remaining: amount } : s)),
          ),
          /invalid_stock/,
        );
      await assert.rejects(
        adjust([valid[0], valid[0], valid[2]]),
        /invalid_stock/,
      );
      assert.equal(
        (
          await q(
            "select claim_code from public.pulsik_participants where id=$1",
            [reg.id],
          )
        ).rows[0].claim_code,
        win.claim_code,
      );
    },
  );
  await t.test(
    "reset requires exact confirmation, cannot target fair and preserves identities",
    async () => {
      await register(pending.id, test);
      await assert.rejects(reset(real), /reset_not_allowed/);
      await assert.rejects(reset(test, "yes"), /reset_not_allowed/);
      await assert.rejects(
        reset(test, "LIMPAR TESTES", visitor.id),
        /admin_required/,
      );
      const users = (await q("select * from public.pulsik_users order by id"))
        .rows;
      assert.deepEqual(await reset(), { participants: 2, spins: 2 });
      assert.equal(
        (
          await q(
            "select count(*)::int n from public.pulsik_admin_participants where campaign_id=$1",
            [test],
          )
        ).rows[0].n,
        0,
      );
      assert.ok((await stocks()).every((s) => s.remaining === s.initial_stock));
      assert.deepEqual(
        (await q("select * from public.pulsik_users order by id")).rows,
        users,
      );
      assert.deepEqual(await snapshot(), baseline);
      await assert.rejects(register(visitor.id, test), /campaign_closed/);
      assert.deepEqual(await reset(), { participants: 0, spins: 0 });
      await state(true);
      assert.notEqual((await register(visitor.id, test)).id, reg.id);
    },
  );
  await t.test(
    "anon and authenticated cannot operate campaigns or read the admin view or audit",
    async () => {
      for (const role of ["anon", "authenticated"]) {
        await db.exec("set role " + role);
        for (const sql of [
          "select * from public.pulsik_admin_participants",
          "select * from public.pulsik_admin_events",
          `select public.pulsik_admin_test_state('${admin.id}',true)`,
          `select public.pulsik_admin_reset_test('${admin.id}','${test}','LIMPAR TESTES')`,
          `select public.pulsik_admin_stock('${admin.id}','${test}','[]')`,
          `select public.pulsik_admin_redeem('${admin.id}','${test}','${win.claim_code}')`,
        ])
          await assert.rejects(q(sql), /permission denied/);
        await db.exec("reset role");
      }
      await db.exec("set role service_role");
      assert.ok(
        (await q("select * from public.pulsik_admin_events")).rows.length > 0,
      );
      await db.exec("reset role");
    },
  );
});
