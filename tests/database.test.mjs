import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// Real migration and PostgreSQL engine; only Supabase's auth schema is stubbed.
const db = new PGlite();
const campaign = "siara-2026";
async function owner() {
  await db.exec("reset role");
}
async function asUser(id) {
  await owner();
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function user(
  email = "visitor-" + randomUUID() + "@example.com",
  provider = "google",
) {
  await owner();
  const id = randomUUID();
  await db.query("insert into auth.users values($1,$2,now())", [id, email]);
  await db.query("insert into auth.identities values($1,$2)", [id, provider]);
  return id;
}
async function register(id, name = "Visitante Teste") {
  await asUser(id);
  return (
    await db.query("select public.pulsik_register($1,$2,$3,$4,$5,$6,$7) as p", [
      campaign,
      name,
      "Empresa Modelo",
      "Diretor",
      "Fortaleza",
      "CE",
      false,
    ])
  ).rows[0].p;
}
async function roll(value) {
  await owner();
  await db.exec(
    `create or replace function public.pulsik_draw() returns numeric language sql volatile set search_path='' as $$ select ${Number(value)}::numeric; $$;`,
  );
}
async function spin(id, request = randomUUID()) {
  await asUser(id);
  return (
    await db.query("select public.pulsik_spin($1,$2) as s", [campaign, request])
  ).rows[0].s;
}
after(async () => {
  await db.close();
});

test("Pulsik: atomic participation, inventory, identity and redemption", async (t) => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.identities(user_id uuid references auth.users(id),provider text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
 grant usage on schema public,auth to authenticated,anon;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609170001_pulsik.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await t.test("closed campaign rejects registration", async () => {
    const id = await user();
    await owner();
    await db.exec(
      "update public.pulsik_campaigns set starts_at=now()+interval '1 day',ends_at=now()+interval '2 days'",
    );
    await assert.rejects(register(id), /campaign_closed/);
    await owner();
    await db.exec(
      "update public.pulsik_campaigns set starts_at=now()-interval '1 day',ends_at=now()+interval '1 day'",
    );
  });
  await t.test("only verified Google identities can register", async () => {
    const id = await user(undefined, "email");
    await assert.rejects(register(id), /google_required/);
    const unverified = await user();
    await owner();
    await db.query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [unverified],
    );
    await assert.rejects(register(unverified), /google_required/);
  });
  let firstUser, first;
  await t.test(
    "register is idempotent, email is trusted and duplicate email is rejected",
    async () => {
      firstUser = await user("VISITOR@example.com");
      first = await register(firstUser);
      assert.equal(first.email, "visitor@example.com");
      assert.equal((await register(firstUser, "Nome alterado")).id, first.id);
      assert.equal((await register(firstUser)).name, "Visitante Teste");
      const duplicate = await user(" visitor@EXAMPLE.com ");
      await assert.rejects(register(duplicate), /duplicate_email/);
    },
  );
  await t.test("invalid fields rejected by the database", async () => {
    const id = await user();
    await assert.rejects(register(id, " "), /invalid_fields/);
  });
  await t.test(
    "cup is reserved once; repeated requests and new requests return the same final result",
    async () => {
      await roll(1);
      const request = randomUUID();
      const a = await spin(firstUser, request);
      const b = await spin(firstUser, request);
      const c = await spin(firstUser);
      assert.equal(a.outcome, "cup");
      assert.equal(a.id, b.id);
      assert.equal(a.id, c.id);
      assert.ok(a.claim_code.startsWith("PUL-"));
      await owner();
      const stock = await db.query(
        "select remaining from public.pulsik_prizes where id='cup'",
      );
      assert.equal(stock.rows[0].remaining, 29);
    },
  );
  await t.test(
    "retry remains ready and grants another chance; repeated request does not consume it",
    async () => {
      const id = await user();
      await register(id);
      await roll(99);
      const request = randomUUID();
      const a = await spin(id, request);
      assert.equal(a.outcome, "retry");
      assert.equal((await spin(id, request)).id, a.id);
      await roll(10);
      const b = await spin(id);
      assert.equal(b.outcome, "keychain");
      await asUser(id);
      assert.equal(
        (await db.query("select status from public.pulsik_participants"))
          .rows[0].status,
        "complete",
      );
    },
  );
  await t.test("draw thresholds match 3%,20%,20%,47%,10%", async () => {
    for (const [value, expected] of [
      [0, "cup"],
      [2.999, "cup"],
      [3, "keychain"],
      [22.999, "keychain"],
      [23, "pen"],
      [42.999, "pen"],
      [43, "none"],
      [89.999, "none"],
      [90, "retry"],
      [99.999, "retry"],
    ]) {
      const id = await user();
      await register(id);
      await roll(value);
      assert.equal((await spin(id)).outcome, expected);
    }
  });
  await t.test(
    "exhausted prizes turn into no-win and never make inventory negative",
    async () => {
      await owner();
      await db.exec(
        "update public.pulsik_prizes set remaining=0 where id='cup'",
      );
      const id = await user();
      await register(id);
      await roll(1);
      assert.equal((await spin(id)).outcome, "none");
      await owner();
      assert.equal(
        (
          await db.query(
            "select remaining from public.pulsik_prizes where id='cup'",
          )
        ).rows[0].remaining,
        0,
      );
    },
  );
  await t.test(
    "RLS isolates participants and denies direct writes, stock edits and admin actions",
    async () => {
      await asUser(firstUser);
      const visible = await db.query(
        "select id from public.pulsik_participants",
      );
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0].id, first.id);
      await assert.rejects(
        db.exec("update public.pulsik_participants set outcome='pen'"),
        /permission denied/,
      );
      await assert.rejects(
        db.exec("update public.pulsik_prizes set remaining=200"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select public.pulsik_redeem($1)", ["PUL-INVALID"]),
        /admin_required/,
      );
      await assert.rejects(
        db.exec("select public.pulsik_draw()"),
        /permission denied/,
      );
    },
  );
  await t.test("anonymous users cannot access data or draw", async () => {
    await owner();
    await db.exec("set role anon");
    await assert.rejects(
      db.exec("select * from public.pulsik_participants"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.pulsik_spin($1,$2)", [campaign, randomUUID()]),
      /permission denied/,
    );
  });
  await t.test("admin sees records and can redeem only once", async () => {
    const admin = await user();
    await owner();
    await db.query("insert into public.pulsik_admins values($1)", [admin]);
    const code = (
      await db.query(
        "select claim_code from public.pulsik_participants where id=$1",
        [first.id],
      )
    ).rows[0].claim_code;
    await asUser(admin);
    assert.ok(
      (await db.query("select id from public.pulsik_participants")).rows
        .length > 1,
    );
    const a = (await db.query("select public.pulsik_redeem($1) as r", [code]))
      .rows[0].r;
    const b = (await db.query("select public.pulsik_redeem($1) as r", [code]))
      .rows[0].r;
    assert.equal(a.already_redeemed, false);
    assert.equal(b.already_redeemed, true);
    assert.equal(a.participant.redeemed_at, b.participant.redeemed_at);
  });
  await t.test(
    "closed campaign preserves existing result and blocks unused spins",
    async () => {
      const id = await user();
      await register(id);
      await owner();
      await db.exec(
        "update public.pulsik_campaigns set ends_at=now()-interval '1 second'",
      );
      assert.equal((await spin(firstUser)).outcome, "cup");
      await assert.rejects(spin(id), /campaign_closed/);
    },
  );
});
