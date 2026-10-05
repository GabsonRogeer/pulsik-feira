import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { digest } from "./auth-service";
import { db } from "./db";

const COOKIE = "pulsik-guest";
const MAX_AGE = 8 * 60 * 60;

export async function guestHash() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token && /^[a-f0-9]{64}$/.test(token)
    ? digest("guest:" + token)
    : null;
}

export async function startGuest() {
  // Preserve the secret when retrying a request whose response was lost.
  if (await guestHash()) return;
  (await cookies()).set(COOKIE, randomBytes(32).toString("hex"), {
    httpOnly: true,
    secure: new URL(process.env.AUTH_URL!).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endGuest() {
  const hash = await guestHash();
  if (hash) {
    const { error } = await db()
      .from("pulsik_guest_sessions")
      .delete()
      .eq("token_hash", hash);
    if (error) throw error;
  }
  (await cookies()).delete(COOKIE);
}

export async function guestIdentity(campaign: string) {
  const hash = await guestHash();
  if (!hash) throw new Error("unauthorized");
  const { data: session, error } = await db()
    .from("pulsik_guest_sessions")
    .select("user_id")
    .eq("token_hash", hash)
    .eq("campaign_id", campaign)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!session) throw new Error("unauthorized");
  const { data: user, error: userError } = await db()
    .from("pulsik_users")
    .select("id,email,name,is_admin,email_verified")
    .eq("id", session.user_id)
    .maybeSingle();
  if (userError) throw userError;
  // A verified sign-in claims the account and invalidates guest access.
  if (!user || user.is_admin || user.email_verified)
    throw new Error("unauthorized");
  return { ...user, guest: true };
}
