import { identity, checkOrigin, body, failure, json } from "@/lib/server/api";
import { db, rpc } from "@/lib/server/db";
import { campaignFromRequest } from "@/lib/campaign";
export async function GET(request: Request) {
  try {
    const user = await identity();
    const campaign = campaignFromRequest(request);
    const client = db();
    const { data: participant, error } = await client
      .from("pulsik_participants")
      .select("*")
      .eq("user_id", user.id)
      .eq("campaign_id", campaign)
      .maybeSingle();
    if (error) throw error;
    const { data: stock, error: stockError } = await client
      .from("pulsik_prizes")
      .select("id,remaining")
      .eq("campaign_id", campaign);
    if (stockError) throw stockError;
    return json({
      user: { id: user.id, email: user.email, name: user.name },
      participant,
      stock,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await identity();
    const campaign = campaignFromRequest(request);
    const v = await body(request);
    const participant = await rpc("pulsik_register_v2", {
      p_user: user.id,
      p_campaign: campaign,
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
