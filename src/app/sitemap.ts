import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n/routing";
import { getBaseUrl } from "@/lib/config/site";
import { getActiveCategories } from "@/lib/domain/catalog/category.service";
import { getSitemapProducts } from "@/lib/domain/catalog/product.service";

const STATIC_PATHS = [
  "",
  "/shop",
  "/about",
  "/contact",
  "/shipping-delivery",
  "/returns-exchange",
  "/privacy-policy",
  "/terms-conditions",
];

/**
 * `app/sitemap.ts` (T219, research.md §35): both `/en/...` and `/ar/...`
 * entries per URL, each carrying the other language (plus `x-default`) as
 * an `hreflang` alternate — mirrors `buildLocalizedMetadata` (T218)
 * exactly, so a page's sitemap entry and its own `<link rel="alternate">`
 * tags can never disagree about which URLs are language variants of one
 * another.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const [categories, products] = await Promise.all([getActiveCategories(), getSitemapProducts()]);

  const paths: { path: string; lastModified?: Date }[] = [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...categories.map((category) => ({
      path: `/shop/category/${category.slug}`,
      lastModified: category.updatedAt.toDate(),
    })),
    ...products.map((product) => ({
      path: `/shop/${product.slug}`,
      lastModified: product.updatedAt.toDate(),
    })),
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const { path, lastModified } of paths) {
    const languages: Record<string, string> = {};
    for (const locale of locales) {
      languages[locale] = `${baseUrl}/${locale}${path}`;
    }
    languages["x-default"] = `${baseUrl}/en${path}`;

    for (const locale of locales) {
      entries.push({
        url: `${baseUrl}/${locale}${path}`,
        lastModified,
        alternates: { languages },
      });
    }
  }

  return entries;
}
