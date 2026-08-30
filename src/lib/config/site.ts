/**
 * The single canonical site base URL every SEO surface (metadata,
 * sitemap, robots, JSON-LD) reads from — never a second hardcoded copy.
 * Falls back to localhost so `next build`/tests never fail for lacking a
 * production URL; a real deployment MUST set `NEXT_PUBLIC_APP_URL`.
 */
export function getBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return (configured || "http://localhost:3000").replace(/\/+$/, "");
}

export const SITE_NAME = "ELORA JEWELLERY";
