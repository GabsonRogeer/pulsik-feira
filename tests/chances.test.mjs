import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTs } from "./helpers/load-ts.mjs";
const load = (path, mocks = {}) =>
  loadTs(new URL("../" + path, import.meta.url), mocks);
const config = load("lib/config.ts");
const chances = load("lib/chances.ts", { "./config": config });
const campaigns = load("lib/campaign.ts", { "./config": config });
const defaults = chances.DEFAULT_CHANCES;
const edited = { cup: 10.25, keychain: 20.25, pen: 19.5, none: 25, retry: 25 };

test("admin loads, edits and saves chances for the selected campaign", async () => {
  let cursor = 0;
  const state = [],
    refs = [],
    calls = [];
  let saved = defaults,
    conflict = false;
  const draft = (value) =>
    Object.fromEntries(
      Object.entries(value).map(([key, n]) => [key, String(n)]),
    );
  const hook = load("components/admin/use-admin.ts", {
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in state)) state[i] = initial;
        return [
          state[i],
          (value) => {
            state[i] = typeof value === "function" ? value(state[i]) : value;
          },
        ];
      },
      useRef(initial) {
        const i = cursor++;
        return (refs[i] ??= { current: initial });
      },
      useEffect() {},
    },
    "@/lib/config": config,
    "@/lib/chances": chances,
    "@/lib/campaign": campaigns,
    "next-auth/react": {},
    "@/lib/admin-auth": {},
    "@/lib/export-participants": {},
    "@/lib/api-client": {
      api: async (url, payload) => {
        calls.push({ url, payload });
        if (payload) {
          if (conflict) throw Error("chances_changed");
          saved = payload.chances;
          return { ok: true };
        }
        return { rows: [], stock: [], campaign: { chances: saved } };
      },
    },
  });
  const render = () => {
    cursor = 0;
    return hook.useAdmin();
  };
  let model = render();
  await model.load();
  model = render();
  assert.deepEqual(model.chancesDraft, draft(defaults));
  await model.changeCampaign("siara-2026-test");
  model = render();
  model.setChancesDraft(draft(edited));
  model = render();
  await model.saveChances({ preventDefault() {} });
  const mutation = calls.find((c) => c.payload);
  assert.equal(mutation.url, "/api/admin?campaign=siara-2026-test");
  assert.deepEqual(mutation.payload, {
    action: "chances",
    chances: edited,
    expected: defaults,
  });
  model = render();
  assert.deepEqual(model.chancesDraft, draft(edited));
  assert.match(model.message, /Porcentagens salvas/);
  conflict = true;
  model.setChancesDraft(draft(defaults));
  model = render();
  await model.saveChances({ preventDefault() {} });
  assert.match(render().message, /alteradas por outra pessoa/);
  assert.deepEqual(saved, edited);
});

test("chances validation rejects incomplete, invalid and endless distributions", () => {
  for (const value of [
    defaults,
    edited,
    { cup: 100, keychain: 0, pen: 0, none: 0, retry: 0 },
  ])
    assert.equal(chances.validChances(value), true);
  for (const value of [
    null,
    [],
    {},
    { ...defaults, cup: "4" },
    { ...defaults, cup: NaN },
    { ...defaults, cup: -1 },
    { ...defaults, cup: 4.001, none: 19.999 },
    { ...defaults, cup: 5 },
    { ...defaults, extra: 0 },
    { cup: 0, keychain: 0, pen: 0, none: 0, retry: 100 },
  ])
    assert.equal(chances.validChances(value), false);
  assert.deepEqual(
    chances.parseChancesDraft({
      cup: "10,25",
      keychain: "20.25",
      pen: "19.5",
      none: "25",
      retry: "25",
    }),
    edited,
  );
  assert.equal(
    chances.parseChancesDraft({
      cup: "",
      keychain: "23",
      pen: "23",
      none: "24",
      retry: "30",
    }),
    null,
  );
});

test("admin chance endpoint authorizes, checks origin and uses server identity", async () => {
  const calls = [];
  let denied = false,
    wrongOrigin = false;
  const route = load("app/api/admin/route.ts", {
    "@/lib/chances": chances,
    "@/lib/campaign": campaigns,
    "@/lib/server/api": {
      identity: async (admin) => {
        assert.equal(admin, true);
        if (denied) throw Error("forbidden");
        return { id: "admin" };
      },
      checkOrigin: () => {
        if (wrongOrigin) throw Error("forbidden");
      },
      body: (r) => r.json(),
      json: Response.json,
      failure: (e) => Response.json({ error: e.message }, { status: 400 }),
    },
    "@/lib/server/db": {
      rpc: async (name, args) => calls.push({ name, args }),
    },
  });
  const post = (body, campaign = "siara-2026-test") =>
    route.POST(
      new Request(`https://example.com/api/admin?campaign=${campaign}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  const payload = {
    action: "chances",
    chances: edited,
    expected: defaults,
    p_user: "forged",
  };
  assert.equal((await post(payload)).status, 200);
  assert.deepEqual(calls[0], {
    name: "pulsik_admin_chances",
    args: {
      p_user: "admin",
      p_campaign: "siara-2026-test",
      p_chances: edited,
      p_expected: defaults,
    },
  });
  assert.equal(
    (await post({ ...payload, chances: { ...edited, cup: 0 } })).status,
    400,
  );
  assert.equal((await post({ ...payload, expected: null })).status, 400);
  assert.equal((await post(payload, "unknown")).status, 400);
  denied = true;
  assert.equal((await post(payload)).status, 400);
  denied = false;
  wrongOrigin = true;
  assert.equal((await post(payload)).status, 400);
  assert.equal(calls.length, 1);
});

test("percentage form shows saved values and disables invalid or unchanged saves", () => {
  const { ChancesPanel } = load("components/admin/chances-panel.tsx", {
    "@/lib/config": config,
    "@/lib/chances": chances,
  });
  const render = (draft, extra = {}) =>
    renderToStaticMarkup(
      React.createElement(ChancesPanel, {
        model: {
          campaign: { chances: defaults },
          chancesDraft: Object.fromEntries(
            Object.entries(draft).map(([k, v]) => [k, String(v)]),
          ),
          ...extra,
        },
      }),
    );
  assert.match(render(defaults), /<button[^>]*disabled/);
  assert.doesNotMatch(render(edited), /<button[^>]*disabled/);
  assert.match(render({ ...edited, cup: 0 }), /<button[^>]*disabled/);
  assert.match(render(edited, { saving: true }), /<button[^>]*disabled/);
  assert.match(render(edited, { testing: true }), /Chances da roleta · teste/);
  assert.equal((render(edited).match(/type="number"/g) ?? []).length, 5);
  assert.match(render(edited), /Total: 100% de 100%/);
});

test("public endpoint exposes only chances for the selected campaign and avoids caching", async () => {
  let selected;
  const route = load("app/api/chances/route.ts", {
    "@/lib/campaign": campaigns,
    "@/lib/server/api": {
      json: (data) =>
        Response.json(data, { headers: { "Cache-Control": "no-store" } }),
      failure: () => new Response(null, { status: 400 }),
    },
    "@/lib/server/db": {
      db: () => ({
        from: (table) => {
          assert.equal(table, "pulsik_campaigns");
          return {
            select: (columns) => {
              assert.equal(columns, "chances");
              return {
                eq: (column, value) => {
                  assert.equal(column, "id");
                  selected = value;
                  return {
                    single: async () => ({
                      data: { chances: edited },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        },
      }),
    },
  });
  const response = await route.GET(
    new Request("https://example.com/api/chances?campaign=siara-2026-test"),
  );
  assert.equal(selected, "siara-2026-test");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { chances: edited });
  assert.equal(
    (
      await route.GET(
        new Request("https://example.com/api/chances?campaign=unknown"),
      )
    ).status,
    400,
  );
});
