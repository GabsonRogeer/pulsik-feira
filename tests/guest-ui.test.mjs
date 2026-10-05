import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTs } from "./helpers/load-ts.mjs";
const load = (path, mocks = {}) =>
  loadTs(new URL("../" + path, import.meta.url), mocks);
const config = load("lib/config.ts");
const campaigns = load("lib/campaign.ts", { "./config": config });
const phone = load("lib/phone.ts");

test("guest form accepts an email; verified and demo forms keep their email locked", () => {
  const { RegistrationForm } = load(
    "components/experience/registration-form.tsx",
    { "@/lib/phone": phone },
  );
  const render = (model) =>
    renderToStaticMarkup(
      React.createElement(RegistrationForm, {
        model: { busy: false, ...model },
      }),
    );
  const guest = render({ guest: true });
  assert.match(guest, /Cadastro de convidado/);
  const email = guest.match(/<input[^>]*name="email"[^>]*>/)[0];
  assert.doesNotMatch(email, /readOnly/i);
  assert.match(email, /required/);
  assert.match(guest, /já estiver cadastrado/);
  for (const model of [
    { demo: true },
    { user: { email: "owner@example.com" } },
  ]) {
    assert.match(
      render(model).match(/<input[^>]*name="email"[^>]*>/)[0],
      /readOnly/i,
    );
  }
  const { WelcomeCard } = load("components/experience/welcome-card.tsx", {
    "./email-login": { EmailLogin: () => null },
  });
  const welcome = renderToStaticMarkup(
    React.createElement(WelcomeCard, {
      model: { emailLogin: { busy: false } },
    }),
  );
  assert.match(welcome, /Entrar como convidado/);
});

test("guest journey opens form, handles duplicate email and recovers a saved registration", async () => {
  let cursor = 0;
  const state = [],
    refs = [],
    calls = [];
  let failure = "duplicate_email";
  const participant = {
    id: "participant",
    status: "ready",
    email: "visitor@example.com",
    name: "Visitante",
  };
  const hook = load("components/experience/use-experience.ts", {
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
    "next-auth/react": {},
    "@/lib/campaign": campaigns,
    "@/lib/config": config,
    "@/lib/phone": phone,
    "@/lib/errors": load("lib/errors.ts"),
    "@/lib/celebrate": {},
    "./use-email-login": { useEmailLogin: () => ({ reset() {} }) },
    "@/lib/api-client": {
      api: async (url, body) => {
        calls.push({ url, body });
        if (body?.action === "register" && failure) throw Error(failure);
        if (url.startsWith("/api/participation"))
          return {
            user: { id: "guest", email: participant.email, guest: true },
            participant,
            stock: [],
          };
        return participant;
      },
    },
  });
  const render = () => {
    cursor = 0;
    return hook.useExperience(false, "siara-2026");
  };
  let model = render();
  await model.enterGuest();
  model = render();
  assert.equal(model.guest, true);
  assert.equal(model.step, "form");
  assert.equal(calls[0].body.action, "start");
  const OriginalFormData = globalThis.FormData;
  globalThis.FormData = class {
    get(key) {
      return (
        {
          name: "Visitante",
          email: " VISITOR@EXAMPLE.COM ",
          company: "Empresa",
          job_title: "Cargo",
          phone: "(85) 98925-5170",
        }[key] ?? null
      );
    }
  };
  try {
    const event = { preventDefault() {}, currentTarget: {} };
    await model.register(event);
    model = render();
    assert.equal(model.step, "form");
    assert.match(model.error, /já foi cadastrado ou utilizado/);
    assert.equal(model.busy, false);
    failure = null;
    await model.register(event);
    model = render();
    assert.equal(model.step, "wheel");
    assert.equal(model.user.id, "guest");
    assert.equal(model.participant.id, "participant");
    assert.equal(
      calls.find((c) => c.body?.action === "register").body.email,
      "visitor@example.com",
    );
    assert.ok(calls.every((c) => !c.url.includes("email-code")));
  } finally {
    globalThis.FormData = OriginalFormData;
  }
});

test("IP limits trust the current platform header, not a header from another provider", () => {
  const originalVercel = process.env.VERCEL;
  const { requestIp } = load("lib/server/request-ip.ts", { "server-only": {} });
  const request = new Request("https://app.example", {
    headers: {
      "x-vercel-forwarded-for": "203.0.113.2",
      "x-forwarded-for": "203.0.113.3, 192.0.2.1",
    },
  });
  try {
    process.env.VERCEL = "1";
    assert.equal(requestIp(request), "203.0.113.2");
    delete process.env.VERCEL;
    assert.equal(requestIp(request), "203.0.113.3");
    assert.equal(requestIp(new Request("https://app.example")), "unknown");
  } finally {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
});
