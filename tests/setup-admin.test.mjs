import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { hashSync, compareSync } from "bcryptjs";

test("admin setup creates and explicitly recovers accounts without changing ownership", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create table public.pulsik_users (
    id uuid primary key default gen_random_uuid(), email text not null unique,
    name text, username text unique, password_hash text,
    is_admin boolean not null default false, email_verified boolean not null default false
  ); create table audit_record (owner uuid references public.pulsik_users(id));`);
  const template = await readFile(new URL("../supabase/setup-admin.sql", import.meta.url), "utf8");
  const hash = hashSync("test-only-new-password", 12);
  const setup = template.replace("'HASH_BCRYPT'", () => `'${hash}'`);
  const reset = setup.replace("v_reset_password boolean := false", "v_reset_password boolean := true");
  const account = async () => (await db.query("select * from public.pulsik_users where username='pulsikadmin'")).rows[0];

  await assert.rejects(db.exec(template), /hash bcrypt valido/);
  await db.exec(setup);
  const original = await account();
  assert.equal(original.is_admin, true);
  assert.equal(original.email_verified, true);
  assert.ok(compareSync("test-only-new-password", original.password_hash));
  await db.query("insert into audit_record values ($1)", [original.id]);
  await db.exec("update public.pulsik_users set password_hash='old-hash', name='Original', email_verified=false");
  await assert.rejects(db.exec(setup), /recuperacao exige/);
  assert.equal((await account()).password_hash, "old-hash");
  await db.exec(reset);
  const recovered = await account();
  assert.equal(recovered.id, original.id);
  assert.equal(recovered.name, "Original");
  assert.equal(recovered.email_verified, true);
  assert.ok(compareSync("test-only-new-password", recovered.password_hash));
  assert.equal((await db.query("select owner from audit_record")).rows[0].owner, original.id);
  await db.exec("update public.pulsik_users set is_admin=false, password_hash='participant-hash'");
  await assert.rejects(db.exec(reset), /recuperacao exige/);
  assert.equal((await account()).password_hash, "participant-hash");
  assert.equal((await account()).is_admin, false);
  await assert.rejects(db.exec(reset.replaceAll("pulsikadmin@pulsik.com.br", "other@example.com")), /unique constraint/);
  assert.equal((await db.query("select count(*)::int as count from public.pulsik_users")).rows[0].count, 1);
});
