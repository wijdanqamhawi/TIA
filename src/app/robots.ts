import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n/routing";
import { getBaseUrl } from "@/lib/config/site";

/**
 * `app/robots.ts` (T220): disallows the admin surface and every
 * authenticated/live-cart/transactional page — under **both** locale
 * prefixes, since crawling either would either leak nothing useful (an
 * empty cart/account shell) or waste crawl budget on pages that can never
 * be meaningfully indexed. Both locale trees otherwise remain fully
 * crawlable (research.md §35).
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  const disallow = ["/admin", "/api"];
  for (const locale of locales) {
    disallow.push(`/${locale}/account`, `/${locale}/cart`, `/${locale}/checkout`);
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
