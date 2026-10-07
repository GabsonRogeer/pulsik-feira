import { campaignFromRequest } from "@/lib/campaign";
import { db } from "@/lib/server/db";
import { failure, json } from "@/lib/server/api";

export async function GET(request: Request) {
  try {
    const campaign = campaignFromRequest(request);
    const { data, error } = await db()
      .from("pulsik_campaigns")
      .select("chances")
      .eq("id", campaign)
      .single();
    if (error) throw error;
    return json({ chances: data.chances });
  } catch (e) {
    return failure(e);
  }
}
