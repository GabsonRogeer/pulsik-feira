import "server-only";
import { auth } from "@/auth";
import { db } from "./db";
import { guestIdentity } from "./guest";
export async function identity(admin = false, campaign?: string) {
  const session = await auth();
  if (!session?.user?.id) {
    if (!admin && campaign) return guestIdentity(campaign);
    throw new Error("unauthorized");
  }
  const { data, error } = await db()
    .from("pulsik_users")
    .select("id,email,name,is_admin,email_verified")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.email_verified) throw new Error("unauthorized");
  // An administrator must use the username/password provider, not a participant login.
  if (admin && (!data.is_admin || session.authMethod !== "admin"))
    throw new Error("forbidden");
  return { ...data, guest: false };
}
export function checkOrigin(request: Request) {
  const expected = process.env.AUTH_URL;
  if (!expected || request.headers.get("origin") !== new URL(expected).origin)
    throw new Error("forbidden");
}
export async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("invalid_request");
  const text = await request.text();
  if (text.length > 10000) throw new Error("invalid_request");
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("invalid_request");
    return parsed;
  } catch {
    throw new Error("invalid_request");
  }
}
export function failure(e: unknown) {
  const m = (e as { message?: string })?.message || "";
  const allowed = [
    "unauthorized",
    "forbidden",
    "campaign_closed",
    "not_registered",
    "invalid_fields",
    "invalid_phone",
    "invalid_request",
    "invalid_stock",
    "stock_changed",
    "reset_not_allowed",
    "duplicate_email",
    "invalid_email",
    "rate_limit",
    "email_unavailable",
    "admin_required",
    "code_not_found",
    "verified_email_required",
  ];
  const code = allowed.find((c) => m.includes(c)) || "server_error";
  return Response.json(
    { error: code },
    {
      status:
        code === "unauthorized"
          ? 401
          : code === "forbidden"
            ? 403
            : code === "rate_limit"
              ? 429
              : code === "server_error" || code === "email_unavailable"
                ? 503
                : 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export function json(data: unknown) {
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
