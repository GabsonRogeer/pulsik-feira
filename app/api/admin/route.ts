import { identity, checkOrigin, body, failure, json } from "@/lib/server/api";
import { db, rpc } from "@/lib/server/db";
import { campaignFromRequest, TEST_CAMPAIGN } from "@/lib/campaign";
import type { Participant } from "@/lib/config";
export async function GET(request: Request) {
  try {
    await identity(true);
    const campaignId = campaignFromRequest(request);
    const client = db();
    const { data: campaign, error: campaignError } = await client
      .from("pulsik_campaigns")
      .select("id,active,starts_at,ends_at")
      .eq("id", campaignId)
      .single();
    if (campaignError) throw campaignError;
    let rows: Participant[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client
        .from("pulsik_admin_participants")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + 999);
      if (error) throw error;
      rows = rows.concat(data);
      if (data.length < 1000) break;
    }
    const { data: stock, error } = await client
      .from("pulsik_prizes")
      .select("id,initial_stock,remaining")
      .eq("campaign_id", campaignId);
    if (error) throw error;
    return json({ rows, stock, campaign });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await identity(true);
    const campaign = campaignFromRequest(request);
    const v = await body(request);
    switch (v.action) {
      case "stock":
        if (!Array.isArray(v.stock)) throw new Error("invalid_stock");
        await rpc("pulsik_admin_stock", {
          p_user: user.id,
          p_campaign: campaign,
          p_stock: v.stock,
        });
        return json({ ok: true });
      case "test_state":
        if (campaign !== TEST_CAMPAIGN || typeof v.active !== "boolean")
          throw new Error("invalid_request");
        await rpc("pulsik_admin_test_state", {
          p_user: user.id,
          p_active: v.active,
        });
        return json({ ok: true });
      case "reset_test":
        if (campaign !== TEST_CAMPAIGN || v.confirmation !== "LIMPAR TESTES")
          throw new Error("reset_not_allowed");
        return json(
          await rpc("pulsik_admin_reset_test", {
            p_user: user.id,
            p_campaign: campaign,
            p_confirmation: v.confirmation,
          }),
        );
      case "redeem":
      case undefined:
        if (
          typeof v.code !== "string" ||
          !/^(?:(?:PLS|TST)-[A-HJ-NP-Z2-9]{5}|(?:PUL|TST)-[A-F0-9]{16})$/i.test(
            v.code.trim(),
          )
        )
          throw new Error("invalid_request");
        return json(
          await rpc("pulsik_admin_redeem", {
            p_user: user.id,
            p_campaign: campaign,
            p_code: v.code,
          }),
        );
      default:
        throw new Error("invalid_request");
    }
  } catch (e) {
    return failure(e);
  }
}
