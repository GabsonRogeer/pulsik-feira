import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

test("auth logs identify missing configuration without exposing error details", (t) => {
  let config;
  loadTs(new URL("../auth.ts", import.meta.url), {
    "next-auth": (value) => { config = value; return {}; },
    "next-auth/providers/google": (value) => value,
    "next-auth/providers/credentials": (value) => value,
    "@/lib/server/auth-service": {},
  });
  const messages = [];
  t.mock.method(console, "error", (...args) => messages.push(args.join(" ")));
  config.logger.error(Object.assign(new Error("private-error-message"), {
    type: "MissingSecret",
    cause: { token: "private-token" },
  }));
  assert.match(messages[0], /MissingSecret/);
  assert.match(messages[0], /AUTH_SECRET.*\.env\.local/);
  config.logger.error(new Error("private-error-message"));
  assert.match(messages[1], /AuthError/);
  assert.doesNotMatch(messages.join("\n"), /private-error-message|private-token/);
});
