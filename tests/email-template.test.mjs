import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { loadTs } from "./helpers/load-ts.mjs";
const template = loadTs(
  new URL("../lib/email/access-code.ts", import.meta.url),
  { "server-only": {} },
);

test("email preserves leading zeros, rejects invalid codes and embeds both PNG logos in MIME", async () => {
  const mail = template.accessCodeEmail("001234");
  assert.match(mail.text, /001234/);
  assert.match(mail.html, />001234<\/td>/);
  assert.match(mail.text, /Pulsik, automa\u00e7\u00e3o inteligente/);
  assert.doesNotMatch(mail.html, /CONEX\u00d5ES QUE|TRANSFORMAM/);
  for (const bad of ["12345", "1234567", "<12345", "123456\n"])
    assert.throws(() => template.accessCodeEmail(bad));
  for (const attachment of mail.attachments) {
    assert.ok(mail.html.includes("cid:" + attachment.cid));
    assert.equal(
      Buffer.from(attachment.content, "base64").subarray(0, 8).toString("hex"),
      "89504e470d0a1a0a",
    );
  }
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
  });
  const result = await transport.sendMail({
    from: "sender@example.com",
    to: "recipient@example.com",
    ...mail,
  });
  const mime = result.message.toString();
  assert.match(mime, /multipart\/alternative/);
  assert.match(mime, /multipart\/related/);
  assert.match(mime, /Content-Type: text\/plain/);
  assert.match(mime, /Content-Type: text\/html/);
  for (const a of mail.attachments)
    assert.ok(mime.includes("Content-ID: <" + a.cid + ">"));
});

test("sendCode sends the generated OTP in HTML and text and stores only its digest", async () => {
  Object.assign(process.env, {
    AUTH_SECRET: "test-only",
    SMTP_HOST: "smtp.example.com",
    SMTP_USER: "test",
    SMTP_PASSWORD: "test-only",
    SMTP_FROM: "sender@example.com",
    SMTP_PORT: "465",
  });
  let stored, message, transportOptions;
  const deleted = [];
  const limits = [];
  let fail = false;
  const chain = {
    async upsert(row) {
      stored = row;
      return { error: null };
    },
    delete() {
      return this;
    },
    eq(key, value) {
      deleted.push([key, value]);
      return this;
    },
  };
  const service = loadTs(
    new URL("../lib/server/auth-service.ts", import.meta.url),
    {
      "server-only": {},
      "../auth-limits": loadTs(
        new URL("../lib/auth-limits.ts", import.meta.url),
      ),
      "../email/access-code": template,
      "./db": {
        db: () => ({ from: () => chain }),
        rpc: async (name, args) => {
          limits.push({ name, args });
          return true;
        },
      },
      nodemailer: {
        createTransport(options) {
          transportOptions = options;
          return {
            async sendMail(mail) {
              message = mail;
              if (fail) throw Error("SMTP unavailable");
            },
          };
        },
      },
    },
  );
  await service.sendCode("recipient@example.com", "127.0.0.1");
  const code = message.html.match(/>(\d{6})<\/td>/)[1];
  assert.ok(message.text.includes(code));
  assert.equal(
    stored.token_hash,
    service.digest("recipient@example.com:" + code),
  );
  assert.equal(message.attachments.length, 2);
  assert.equal(transportOptions.secure, true);
  assert.deepEqual(
    limits.map((x) => [x.args.p_max, x.args.p_seconds]),
    [
      [600, 300],
      [1, 20],
    ],
  );
  assert.equal(transportOptions.connectionTimeout, 10000);
  assert.equal(transportOptions.socketTimeout, 15000);
  fail = true;
  await assert.rejects(
    service.sendCode("recipient@example.com", "127.0.0.1"),
    /email_unavailable/,
  );
  assert.deepEqual(deleted, [
    ["email", "recipient@example.com"],
    ["token_hash", stored.token_hash],
  ]);
});
