import { checkOrigin, body, failure, json } from "@/lib/server/api";
import { sendCode } from "@/lib/server/auth-service";
import { requestIp } from "@/lib/server/request-ip";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const data = await body(request);
    await sendCode(data.email, requestIp(request));
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
