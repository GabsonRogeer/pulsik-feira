import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../lib/email-auth.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const { normalizeEmail, sendEmailCode, verifyEmailCode, emailAuthError } =
  await import(
    "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
  );
test("email login normalizes address and refuses malformed input before sending", async () => {
  assert.equal(
    normalizeEmail(" Visitante@Example.com "),
    "visitante@example.com",
  );
  let calls = 0;
  const auth = {
    signInWithOtp: async () => {
      calls++;
      return { error: null };
    },
  };
  for (const invalid of ["", "abc", "a b@example.com", "a@", "a@@example.com"])
    await assert.rejects(sendEmailCode(auth, invalid), /invalid_email/);
  assert.equal(calls, 0);
});
test("email request supports first-time and returning accounts, without granting a session", async () => {
  let input;
  const email = await sendEmailCode(
    {
      signInWithOtp: async (value) => {
        input = value;
        return { data: { user: null, session: null }, error: null };
      },
    },
    " Visitante@Example.com ",
  );
  assert.deepEqual(input, {
    email: "visitante@example.com",
    options: { shouldCreateUser: true },
  });
  assert.equal(email, "visitante@example.com");
});
test("verification binds the code to the requested email and requires a real session", async () => {
  let input;
  const user = { id: "verified-user" };
  const result = await verifyEmailCode(
    {
      verifyOtp: async (value) => {
        input = value;
        return {
          data: { user, session: { access_token: "test" } },
          error: null,
        };
      },
    },
    " VISITANTE@example.com ",
    "123 456",
  );
  assert.deepEqual(input, {
    email: "visitante@example.com",
    token: "123456",
    type: "email",
  });
  assert.equal(result, user);
  await assert.rejects(
    verifyEmailCode(
      {
        verifyOtp: async () => ({ data: { user, session: null }, error: null }),
      },
      "a@example.com",
      "123456",
    ),
    /missing_session/,
  );
});
test("malformed codes never call Supabase and expired codes never authenticate", async () => {
  let calls = 0;
  const expired = {
    code: "otp_expired",
    message: "Token has expired or is invalid",
  };
  const auth = {
    verifyOtp: async () => {
      calls++;
      return { data: { user: null, session: null }, error: expired };
    },
  };
  for (const code of ["", "123", "abcdef", "1234567"])
    await assert.rejects(
      verifyEmailCode(auth, "a@example.com", code),
      /invalid_code/,
    );
  assert.equal(calls, 0);
  await assert.rejects(
    verifyEmailCode(auth, "a@example.com", "123456"),
    (e) => e === expired,
  );
  assert.match(emailAuthError(expired), /inválido ou expirado/);
});
test("send failures propagate and rate limits have a useful message", async () => {
  const error = {
    status: 429,
    code: "over_email_send_rate_limit",
    message: "rate limit",
  };
  await assert.rejects(
    sendEmailCode({ signInWithOtp: async () => ({ error }) }, "a@example.com"),
    (e) => e === error,
  );
  assert.match(emailAuthError(error), /Aguarde/);
  assert.match(
    emailAuthError({ code: "email_address_not_authorized" }),
    /indisponível/,
  );
});
