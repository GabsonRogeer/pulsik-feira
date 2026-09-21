import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { compare } from "bcryptjs";
import nodemailer from "nodemailer";
import { db, rpc } from "./db";
import { accessCodeEmail } from "../email/access-code";
export function emailAddress(value: unknown) {
  const email = String(value || "")
    .trim()
    .toLowerCase();
  if (
    email.length > 254 ||
    !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)
  )
    throw new Error("invalid_email");
  return email;
}
export function digest(value: string) {
  if (!process.env.AUTH_SECRET) throw new Error("server_configuration");
  return createHmac("sha256", process.env.AUTH_SECRET)
    .update(value)
    .digest("hex");
}
export async function limit(key: string, max: number, seconds: number) {
  const allowed = await rpc<boolean>("pulsik_auth_limit", {
    p_key: digest(key),
    p_max: max,
    p_seconds: seconds,
  });
  if (!allowed) throw new Error("rate_limit");
}
export type AppIdentity = { id: string; email: string; name: string | null };
export async function verifiedUser(email: string, name?: string | null) {
  return rpc<AppIdentity>("pulsik_verified_user", {
    p_email: emailAddress(email),
    p_name: name || null,
  });
}
export async function passwordLogin(username: unknown, password: unknown) {
  const login = String(username || "")
    .trim()
    .toLowerCase();
  const pass = String(password || "");
  if (!login || login.length > 100 || !pass || pass.length > 128) return null;
  await limit("admin:" + login, 10, 900);
  const { data, error } = await db()
    .from("pulsik_users")
    .select("id,email,name,password_hash,is_admin")
    .eq("username", login)
    .maybeSingle();
  if (error) throw error;
  if (
    !data?.is_admin ||
    !data.password_hash ||
    !(await compare(pass, data.password_hash))
  )
    return null;
  return { id: data.id, email: data.email, name: data.name || login };
}
export async function emailCodeLogin(address: unknown, code: unknown) {
  const email = emailAddress(address);
  const token = String(code || "");
  if (!/^\d{6}$/.test(token)) return null;
  const valid = await rpc<boolean>("pulsik_verify_code", {
    p_email: email,
    p_hash: digest(email + ":" + token),
  });
  return valid ? verifiedUser(email) : null;
}
export async function sendCode(address: unknown, ip: string) {
  const email = emailAddress(address);
  const {
    SMTP_HOST: host,
    SMTP_USER: user,
    SMTP_PASSWORD: pass,
    SMTP_FROM: from,
  } = process.env;
  if (!host || !user || !pass || !from) throw new Error("email_unavailable");
  await limit("mail-ip:" + ip, 15, 600);
  await limit("mail:" + email, 1, 60);
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const hash = digest(email + ":" + code);
  const { error } = await db()
    .from("pulsik_email_codes")
    .upsert({
      email,
      token_hash: hash,
      expires_at: new Date(Date.now() + 600000).toISOString(),
      attempts: 0,
    });
  if (error) throw error;
  try {
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
    });
    await transport.sendMail({
      from,
      to: { address: email, name: "" },
      ...accessCodeEmail(code),
    });
  } catch {
    await db()
      .from("pulsik_email_codes")
      .delete()
      .eq("email", email)
      .eq("token_hash", hash);
    throw new Error("email_unavailable");
  }
}
