import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("configurable chances: migration, authorization, atomic updates and real draws", async (t) => {
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
  const files = (await readdir(directory))
    .filter((n) => n.endsWith(".sql"))
    .sort();
  for (const name of files.filter(
    (n) => !n.includes("configurable_prize_chances"),
  ))
    await db.exec(await readFile(new URL(name, directory), "utf8"));
  await db.exec(
    "update public.pulsik_campaigns set active=true,starts_at=now()-interval '1 day',ends_at=now()+interval '1 day'",
  );
  const real = "siara-2026",
    trial = "siara-2026-test";
  const defaults = { cup: 4, keychain: 23, pen: 23, none: 20, retry: 30 };
  const edited = {
    cup: 10.25,
    keychain: 20.25,
    pen: 19.5,
    none: 25,
    retry: 25,
  };
  const user = async () =>
    val("select public.pulsik_verified_user($1,'Visitor') as v", [
      `${randomUUID()}@example.com`,
    ]);
  const admin = await user(),
    visitor = await user();
  await q("update public.pulsik_users set is_admin=true where id=$1", [
    admin.id,
  ]);
  const register = async (campaign) => {
    const u = await user();
    await val(
      "select public.pulsik_register_v2($1,$2,'Visitor','Company','Role','85989255170',false) as v",
      [u.id, campaign],
    );
    return u;
  };
  const spin = (u, campaign, request = randomUUID()) =>
    val("select public.pulsik_spin_v2($1,$2,$3) as v", [
      u.id,
      campaign,
      request,
    ]);
  // Deterministic draws exercise exact boundaries; production RNG is not changed.
  const roll = (n) =>
    db.exec(
      `create or replace function public.pulsik_draw() returns numeric language sql volatile as $$ select ${n}::numeric $$;`,
    );
  const savedUser = await register(real);
  await roll(0);
  const saved = await spin(savedUser, real);
  const beforeStock = (
    await q("select * from public.pulsik_prizes order by campaign_id,id")
  ).rows;
  await db.exec(
    await readFile(
      new URL(
        files.find((n) => n.includes("configurable_prize_chances")),
        directory,
      ),
      "utf8",
    ),
  );
  const get = (campaign) =>
    val("select chances as v from public.pulsik_campaigns where id=$1", [
      campaign,
    ]);
  const save = (
    next,
    expected = defaults,
    campaign = trial,
    actor = admin.id,
  ) =>
    val("select public.pulsik_admin_chances($1,$2,$3,$4) as v", [
      actor,
      campaign,
      next,
      expected,
    ]);

  await t.test(
    "migration retains defaults, stock and already awarded results",
    async () => {
      assert.deepEqual(await get(real), defaults);
      assert.deepEqual(await get(trial), defaults);
      assert.deepEqual(
        (await q("select * from public.pulsik_prizes order by campaign_id,id"))
          .rows,
        beforeStock,
      );
      assert.equal((await spin(savedUser, real)).id, saved.id);
    },
  );
  await t.test(
    "database enforces valid percentages and the admin boundary",
    async () => {
      await assert.rejects(
        save(edited, defaults, trial, visitor.id),
        /admin_required/,
      );
      for (const invalid of [
        null,
        [],
        {},
        { ...defaults, extra: 0 },
        { ...defaults, cup: "4" },
        { ...defaults, cup: -1 },
        { ...defaults, cup: 101 },
        { ...defaults, cup: 4.001, none: 19.999 },
        { ...defaults, cup: 5 },
        { cup: 0, keychain: 0, pen: 0, none: 0, retry: 100 },
      ]) {
        await assert.rejects(save(invalid), /invalid_chances/);
      }
      await assert.rejects(save(edited, null), /invalid_chances/);
      await assert.rejects(
        save(edited, defaults, "unknown"),
        /invalid_request/,
      );
      await assert.rejects(
        q("update public.pulsik_campaigns set chances=$1 where id=$2", [
          { ...defaults, cup: 0 },
          real,
        ]),
        /pulsik_campaign_chances_valid/,
      );
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`);
        await assert.rejects(save(edited), /permission denied/);
        await assert.rejects(get(real), /permission denied/);
        await db.exec("reset role");
      }
      await db.exec("set role service_role");
      await save(edited);
      await db.exec("reset role");
      assert.deepEqual(await get(trial), edited);
      assert.deepEqual(await get(real), defaults);
      assert.deepEqual(
        await val(
          "select details as v from public.pulsik_admin_events where action='chances'",
        ),
        { before: defaults, after: edited },
      );
      await assert.rejects(save(defaults, defaults), /chances_changed/);
      assert.deepEqual(await get(trial), edited);
      assert.equal(
        await val(
          "select count(*)::int as v from public.pulsik_admin_events where action='chances'",
        ),
        1,
      );
    },
  );
  await t.test(
    "configured decimal boundaries select each outcome",
    async () => {
      for (const [draw, outcome] of [
        [0, "cup"],
        [10.2499, "cup"],
        [10.25, "keychain"],
        [30.4999, "keychain"],
        [30.5, "pen"],
        [49.9999, "pen"],
        [50, "none"],
        [74.9999, "none"],
        [75, "retry"],
        [99.9999, "retry"],
      ]) {
        await roll(draw);
        assert.equal(
          (await spin(await register(trial), trial)).outcome,
          outcome,
        );
      }
    },
  );
  await t.test(
    "new chances apply immediately, preserve idempotency and handle zero stock",
    async () => {
      const retryUser = await register(trial),
        request = randomUUID();
      await roll(99);
      const retry = await spin(retryUser, trial, request);
      const onlyCup = { cup: 100, keychain: 0, pen: 0, none: 0, retry: 0 };
      await save(onlyCup, edited);
      assert.deepEqual(await spin(retryUser, trial, request), retry);
      const prize = await spin(retryUser, trial);
      assert.equal(prize.outcome, "cup");
      assert.match(prize.claim_code, /^TST-[A-HJ-NP-Z2-9]{5}$/);
      assert.equal((await spin(savedUser, real)).id, saved.id);
      const onlyNone = { cup: 0, keychain: 0, pen: 0, none: 100, retry: 0 };
      await save(onlyNone, onlyCup);
      await roll(0);
      assert.equal((await spin(await register(trial), trial)).outcome, "none");
      assert.equal((await spin(retryUser, trial)).id, prize.id);
      await save(onlyCup, onlyNone);
      await q(
        "update public.pulsik_prizes set remaining=0 where campaign_id=$1 and id='cup'",
        [trial],
      );
      const exhausted = await spin(await register(trial), trial);
      assert.equal(exhausted.outcome, "none");
      assert.equal(exhausted.claim_code, null);
      assert.deepEqual(await get(real), defaults);
    },
  );
});
