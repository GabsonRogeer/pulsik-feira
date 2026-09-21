import { checkOrigin, body, failure, json } from "@/lib/server/api";
import { sendCode } from "@/lib/server/auth-service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const data = await body(request);
    await sendCode(
      data.email,
      request.headers.get("x-vercel-forwarded-for") ||
        request.headers.get("x-forwarded-for") ||
        "local",
    );
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
