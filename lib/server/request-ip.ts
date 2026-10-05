import "server-only";
import { isIP } from "node:net";

export function requestIp(request: Request) {
  // Trust the Vercel-specific header only when running on Vercel.
  const forwarded = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")
    : request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0].trim();
  return ip && isIP(ip) ? ip : "unknown";
}
