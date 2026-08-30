import type { Metadata } from "next";
import { locales, type Locale } from "@/lib/i18n/routing";
import { getBaseUrl, SITE_NAME } from "@/lib/config/site";

/**
 * The shared bilingual SEO metadata builder (T218, research.md §35, spec
 * FR-082) — every route's `generateMetadata` calls this instead of
 * hand-rolling its own `alternates`/`canonical` shape, so the
 * hreflang/canonical strategy can never drift page to page.
 *
 * `pathname` is the **locale-independent** path (e.g. `/shop/category/
 * rings`, `""` for the homepage) — next-intl's `localePrefix: "always"`
 * (routing.ts) means every locale shares the exact same path structure,
 * differing only by the `/en`/`/ar` prefix, so one path plus the locale
 * list is enough to derive every alternate.
 *
 * Each localized page gets its own `canonical` (pointing at *itself*, not
 * the other language) — the two are genuinely distinct, indexable pages,
 * never duplicates needing canonicalization to one (research.md §35).
 */
export function buildLocalizedMetadata({
  locale,
  pathname,
  title,
  description,
}: {
  locale: Locale;
  pathname: string;
  title: string;
  description: string;
}): Metadata {
  const baseUrl = getBaseUrl();
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const cleanPath = normalizedPath === "/" ? "" : normalizedPath;

  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = `${baseUrl}/${l}${cleanPath}`;
  }
  languages["x-default"] = `${baseUrl}/en${cleanPath}`;

  const canonical = `${baseUrl}/${locale}${cleanPath}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: locale === "ar" ? "ar_AR" : "en_US",
      type: "website",
    },
  };
}
