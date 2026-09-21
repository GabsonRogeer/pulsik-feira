import { identity, checkOrigin, body, failure, json } from "@/lib/server/api";
import { rpc } from "@/lib/server/db";
import { campaignFromRequest } from "@/lib/campaign";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await identity();
    const v = await body(request);
    if (
      typeof v.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        v.requestId,
      )
    )
      throw new Error("invalid_request");
    return json(
      await rpc("pulsik_spin_v2", {
        p_user: user.id,
        p_campaign: campaignFromRequest(request),
        p_request: v.requestId,
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
