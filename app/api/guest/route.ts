import { body, checkOrigin, failure, json } from "@/lib/server/api";
import { emailAddress, limit } from "@/lib/server/auth-service";
import { guestHash, startGuest, endGuest } from "@/lib/server/guest";
import { requestIp } from "@/lib/server/request-ip";
import { rpc } from "@/lib/server/db";
import { campaignFromRequest } from "@/lib/campaign";
import { EMAIL_IP_LIMIT, EMAIL_IP_WINDOW_SECONDS } from "@/lib/auth-limits";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const campaign = campaignFromRequest(request);
    const v = await body(request);
    if (v.action === "start") {
      await startGuest();
      return json({ ok: true });
    }
    if (v.action !== "register") throw new Error("invalid_request");
    const hash = await guestHash();
    if (!hash) throw new Error("unauthorized");
    await limit(
      "guest-ip:" + requestIp(request),
      EMAIL_IP_LIMIT,
      EMAIL_IP_WINDOW_SECONDS,
    );
    const participant = await rpc("pulsik_register_guest", {
      p_token_hash: hash,
      p_campaign: campaign,
      p_email: emailAddress(v.email),
      p_name: v.name,
      p_company: v.company,
      p_job_title: v.job_title,
      p_phone: v.phone,
      p_marketing: v.marketing === true,
    });
    return json(participant);
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    await endGuest();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
