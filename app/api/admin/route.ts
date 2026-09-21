import { identity, checkOrigin, body, failure, json } from "@/lib/server/api";
import { db, rpc } from "@/lib/server/db";
import { CAMPAIGN, type Participant } from "@/lib/config";
export async function GET() {
  try {
    await identity(true);
    const client = db();
    let rows: Participant[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client
        .from("pulsik_participants")
        .select("*")
        .eq("campaign_id", CAMPAIGN)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + 999);
      if (error) throw error;
      rows = rows.concat(data);
      if (data.length < 1000) break;
    }
    const { data: stock, error } = await client
      .from("pulsik_prizes")
      .select("id,remaining")
      .eq("campaign_id", CAMPAIGN);
    if (error) throw error;
    return json({ rows, stock });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await identity(true);
    const v = await body(request);
    if (typeof v.code !== "string" || v.code.length > 64)
      throw new Error("invalid_request");
    return json(
      await rpc("pulsik_redeem_v2", { p_user: user.id, p_code: v.code }),
    );
  } catch (e) {
    return failure(e);
  }
}
