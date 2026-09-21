import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../lib/admin-auth.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { signInAdmin, ADMIN_EMAIL } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);
test("admin login rejects invalid username before authenticating", async () => {
  let calls = 0;
  const client = {
    auth: {
      signInWithPassword: async () => {
        calls++;
      },
    },
  };
  await assert.rejects(
    signInAdmin(client, "visitor", "test-password"),
    /invalid_credentials/,
  );
  await assert.rejects(
    signInAdmin(client, "pulsikadmin", ""),
    /invalid_credentials/,
  );
  assert.equal(calls, 0);
});
test("admin login requires password authentication followed by server authorization", async () => {
  const calls = [];
  const client = {
    auth: {
      signInWithPassword: async (input) => {
        calls.push(input);
        return { data: { session: { access_token: "test" } }, error: null };
      },
    },
    rpc: async (name) => {
      calls.push(name);
      return { data: true, error: null };
    },
  };
  await signInAdmin(client, " PULSIKADMIN ", "test-password");
  assert.deepEqual(calls, [
    { email: ADMIN_EMAIL, password: "test-password" },
    "pulsik_is_admin",
  ]);
});
test("authenticated non-admin is signed out and cannot open the panel", async () => {
  let scope;
  const client = {
    auth: {
      signInWithPassword: async () => ({ data: { session: {} }, error: null }),
      signOut: async (options) => {
        scope = options.scope;
        return { error: null };
      },
    },
    rpc: async () => ({ data: false, error: null }),
  };
  await assert.rejects(
    signInAdmin(client, "pulsikadmin", "test-password"),
    /admin_required/,
  );
  assert.equal(scope, "local");
});
test("wrong passwords never reach admin authorization", async () => {
  let called = false;
  const failure = { message: "Invalid login credentials" };
  const client = {
    auth: {
      signInWithPassword: async () => ({
        data: { session: null },
        error: failure,
      }),
    },
    rpc: async () => {
      called = true;
    },
  };
  await assert.rejects(
    signInAdmin(client, "pulsikadmin", "incorrect"),
    (e) => e === failure,
  );
  assert.equal(called, false);
});

test('login and SQL authorization target the same administrator email', async () => {
  const sql = await readFile(new URL('../supabase/setup-admin.sql', import.meta.url), 'utf8');
  const match = sql.match(/lower\(email\)\s*=\s*'([^']+)'/);
  assert.equal(match?.[1], ADMIN_EMAIL);
});
