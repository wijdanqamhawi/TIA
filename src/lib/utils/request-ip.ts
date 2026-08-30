import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort caller IP for rate-limit keys (T230). `x-forwarded-for` is
 * the standard header set by Vercel and most reverse proxies; falls back
 * to a single shared bucket when absent (e.g. local `next start` with no
 * proxy in front) rather than throwing — a coarser rate limit is still
 * better than none, and this is explicitly a defense-in-depth control
 * (research.md §13), never the sole protection against abuse.
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return headerList.get("x-real-ip") ?? "unknown";
}
