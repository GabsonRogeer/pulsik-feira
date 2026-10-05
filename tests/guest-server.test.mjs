import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadTs } from "./helpers/load-ts.mjs";
const load = (path, mocks) =>
  loadTs(new URL("../" + path, import.meta.url), mocks);
const limits = load("lib/auth-limits.ts");
const campaign = load("lib/campaign.ts", { "./config": load("lib/config.ts") });

test("guest secrets are HttpOnly, bounded, campaign scoped and revoked on logout", async () => {
  process.env.AUTH_URL = "https://app.example";
  const jar = new Map();
  let options,
    lookup = { user_id: "guest-id" },
    user = {
      id: "guest-id",
      email: "g@example.com",
      email_verified: false,
      is_admin: false,
    };
  const filters = [],
    deletes = [];
  const guest = load("lib/server/guest.ts", {
    "server-only": {},
    "next/headers": {
      cookies: async () => ({
        get: (key) => (jar.has(key) ? { value: jar.get(key) } : undefined),
        set: (key, value, opts) => {
          jar.set(key, value);
          options = opts;
        },
        delete: (key) => jar.delete(key),
      }),
    },
    "./auth-service": {
      digest: (value) => createHash("sha256").update(value).digest("hex"),
    },
    "./db": {
      db: () => ({
        from: (table) => ({
          select() {
            return this;
          },
          eq(key, value) {
            filters.push([table, key, value]);
            return this;
          },
          gt(key, value) {
            filters.push([table, key, value]);
            return this;
          },
          async maybeSingle() {
            return {
              data: table === "pulsik_users" ? user : lookup,
              error: null,
            };
          },
          delete() {
            deletes.push(table);
            return this;
          },
        }),
      }),
    },
  });
  assert.equal(await guest.guestHash(), null);
  await assert.rejects(guest.guestIdentity("siara-2026"), /unauthorized/);
  await guest.startGuest();
  const raw = jar.get("pulsik-guest");
  assert.match(raw, /^[a-f0-9]{64}$/);
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.maxAge, 28800);
  assert.notEqual(await guest.guestHash(), raw);
  await guest.startGuest();
  assert.equal(jar.get("pulsik-guest"), raw);
  assert.equal((await guest.guestIdentity("siara-2026")).id, "guest-id");
  assert.ok(
    filters.some((f) => f[1] === "campaign_id" && f[2] === "siara-2026"),
  );
  assert.ok(filters.some((f) => f[1] === "expires_at"));
  user.email_verified = true;
  await assert.rejects(guest.guestIdentity("siara-2026"), /unauthorized/);
  user.email_verified = false;
  user.is_admin = true;
  await assert.rejects(guest.guestIdentity("siara-2026"), /unauthorized/);
  user.is_admin = false;
  lookup = null;
  await assert.rejects(guest.guestIdentity("siara-2026"), /unauthorized/);
  await guest.endGuest();
  assert.deepEqual(deletes, ["pulsik_guest_sessions"]);
  assert.equal(await guest.guestHash(), null);
});

test("guest identity never authorizes admin routes or unscoped registration", async () => {
  let session = null,
    calls = 0;
  const api = load("lib/server/api.ts", {
    "server-only": {},
    "@/auth": { auth: async () => session },
    "./guest": {
      guestIdentity: async (c) => {
        calls++;
        return { id: "guest", guest: true, campaign: c };
      },
    },
    "./db": {
      db: () => ({
        from: () => ({
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async maybeSingle() {
            return {
              data: { id: "verified", email_verified: true, is_admin: false },
              error: null,
            };
          },
        }),
      }),
    },
  });
  assert.equal((await api.identity(false, "siara-2026")).id, "guest");
  await assert.rejects(api.identity(true, "siara-2026"), /unauthorized/);
  await assert.rejects(api.identity(), /unauthorized/);
  assert.equal(calls, 1);
  session = { user: { id: "verified" }, authMethod: "google" };
  assert.equal((await api.identity(false, "siara-2026")).guest, false);
  await assert.rejects(api.identity(true), /forbidden/);
});

test("guest API validates origin, session, campaign and uses server-owned identity only", async () => {
  process.env.AUTH_URL = "https://app.example";
  let hash = "a".repeat(64),
    starts = 0,
    ended = 0,
    dbError;
  const calls = [],
    throttles = [];
  const helpers = load("lib/server/api.ts", {
    "server-only": {},
    "@/auth": {},
    "./db": {},
    "./guest": {},
  });
  const route = load("app/api/guest/route.ts", {
    "@/lib/server/api": helpers,
    "@/lib/campaign": campaign,
    "@/lib/auth-limits": limits,
    "@/lib/server/request-ip": { requestIp: () => "203.0.113.10" },
    "@/lib/server/auth-service": {
      emailAddress: (e) => e.trim().toLowerCase(),
      limit: async (...args) => throttles.push(args),
    },
    "@/lib/server/guest": {
      guestHash: async () => hash,
      startGuest: async () => starts++,
      endGuest: async () => ended++,
    },
    "@/lib/server/db": {
      rpc: async (...args) => {
        calls.push(args);
        if (dbError) throw Error(dbError);
        return { id: "new-participant" };
      },
    },
  });
  const request = (body, origin = "https://app.example", camp = "siara-2026") =>
    new Request(`https://app.example/api/guest?campaign=${camp}`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal((await route.POST(request({ action: "start" }))).status, 200);
  assert.equal(starts, 1);
  const form = {
    action: "register",
    email: " NEW@EXAMPLE.COM ",
    name: "Visitante",
    company: "Empresa",
    job_title: "Cargo",
    phone: "85989255170",
    p_user: "forged",
    p_token_hash: "forged",
    email_verified: true,
    is_admin: true,
  };
  assert.equal(
    (await route.POST(request(form, "https://evil.example"))).status,
    403,
  );
  assert.equal(
    (await route.POST(request(form, undefined, "unknown"))).status,
    400,
  );
  hash = null;
  assert.equal((await route.POST(request(form))).status, 401);
  assert.equal(calls.length, 0);
  hash = "a".repeat(64);
  assert.equal((await route.POST(request(form))).status, 200);
  assert.deepEqual(throttles[0], ["guest-ip:203.0.113.10", 600, 300]);
  assert.deepEqual(calls[0], [
    "pulsik_register_guest",
    {
      p_token_hash: hash,
      p_campaign: "siara-2026",
      p_email: "new@example.com",
      p_name: "Visitante",
      p_company: "Empresa",
      p_job_title: "Cargo",
      p_phone: "85989255170",
      p_marketing: false,
    },
  ]);
  dbError = "duplicate_email";
  assert.deepEqual(await (await route.POST(request(form))).json(), {
    error: "duplicate_email",
  });
  assert.equal(
    (await route.DELETE(request({}, "https://evil.example"))).status,
    403,
  );
  assert.equal(ended, 0);
  assert.equal((await route.DELETE(request({}))).status, 200);
  assert.equal(ended, 1);
});
