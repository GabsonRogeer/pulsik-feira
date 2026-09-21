import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
const config = loadTs(new URL("../lib/config.ts", import.meta.url));
const campaigns = loadTs(new URL("../lib/campaign.ts", import.meta.url), {
  "./config": config,
});
test("campaign API permits only known campaigns and never trusts caller identity", async () => {
  const calls = [];
  let denied = false;
  const adminIdentity = { id: "server-admin" };
  const api = {
    identity: async (admin) => {
      assert.equal(admin, true);
      if (denied) throw Error("forbidden");
      return adminIdentity;
    },
    checkOrigin: () => {},
    body: (r) => r.json(),
    json: Response.json,
    failure: (e) => Response.json({ error: e.message }, { status: 400 }),
  };
  const route = loadTs(new URL("../app/api/admin/route.ts", import.meta.url), {
    "@/lib/server/api": api,
    "@/lib/server/db": {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { ok: true };
      },
    },
    "@/lib/campaign": campaigns,
  });
  const post = (campaign, body) =>
    route.POST(
      new Request("https://app.example/api/admin?campaign=" + campaign, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  assert.equal(
    (
      await post("siara-2026", {
        action: "reset_test",
        confirmation: "LIMPAR TESTES",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("siara-2026-test", {
        action: "reset_test",
        confirmation: "yes",
      })
    ).status,
    400,
  );
  assert.equal(
    (await post("unknown", { action: "test_state", active: true })).status,
    400,
  );
  assert.equal(
    (await post("siara-2026", { action: "test_state", active: true })).status,
    400,
  );
  assert.equal(calls.length, 0);
  await post("siara-2026-test", {
    action: "reset_test",
    confirmation: "LIMPAR TESTES",
    p_user: "forged",
  });
  assert.deepEqual(calls[0], {
    name: "pulsik_admin_reset_test",
    args: {
      p_user: "server-admin",
      p_campaign: "siara-2026-test",
      p_confirmation: "LIMPAR TESTES",
    },
  });
  await post("siara-2026", { action: "stock", stock: [] });
  assert.equal(calls[1].args.p_campaign, "siara-2026");
  await post("siara-2026-test", {
    action: "redeem",
    code: "TST-1234567890ABCDEF",
  });
  assert.equal(calls[2].args.p_campaign, "siara-2026-test");
  denied = true;
  await post("siara-2026-test", { action: "test_state", active: true });
  assert.equal(calls.length, 3);
});
test("registration and spin route to the selected campaign with session identity", async () => {
  const calls = [];
  const api = {
    identity: async () => ({ id: "session-user" }),
    checkOrigin: () => {},
    body: (r) => r.json(),
    json: Response.json,
    failure: (e) => Response.json({ error: e.message }, { status: 400 }),
  };
  const mocks = {
    "@/lib/server/api": api,
    "@/lib/server/db": {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return {};
      },
    },
    "@/lib/campaign": campaigns,
  };
  for (const [file, body] of [
    [
      "participation",
      {
        name: "Name",
        company: "Co",
        job_title: "Role",
        phone: "85989255170",
        user: "forged",
        campaign: "siara-2026",
      },
    ],
    [
      "spin",
      { requestId: "11111111-1111-4111-8111-111111111111", user: "forged" },
    ],
  ]) {
    const route = loadTs(
      new URL("../app/api/" + file + "/route.ts", import.meta.url),
      mocks,
    );
    await route.POST(
      new Request(
        "https://app.example/api/" + file + "?campaign=siara-2026-test",
        { method: "POST", body: JSON.stringify(body) },
      ),
    );
  }
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(c.args.p_user, "session-user");
    assert.equal(c.args.p_campaign, "siara-2026-test");
  }
  assert.equal(
    campaigns.campaignFromRequest(new Request("https://app.example/api/spin")),
    "siara-2026",
  );
  assert.throws(() =>
    campaigns.campaignFromRequest(
      new Request("https://app.example/api/spin?campaign=other"),
    ),
  );
});
