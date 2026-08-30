import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  getProductBySlug,
  getRelatedProducts,
  toProductCardData,
} from "@/lib/domain/catalog/product.service";
import { getWishlistedProductIds } from "@/lib/domain/wishlist/wishlist.service";
import { resolveOfferPricing } from "@/lib/domain/catalog/offer";
import { getCategoryOrThrow } from "@/lib/domain/catalog/category.service";
import { resolveLocalizedString } from "@/types/localizedString";
import { ImageGallery } from "@/components/storefront/ImageGallery";
import { ProductPurchasePanel } from "@/components/storefront/ProductPurchasePanel";
import { ProductCard } from "@/components/storefront/ProductCard";
import { PRODUCT_GRID_CLASS } from "@/components/storefront/productGrid";
import { buildLocalizedMetadata } from "@/lib/seo/metadata";
import { getBaseUrl } from "@/lib/config/site";
import type { Locale } from "@/lib/i18n/routing";

// Reads live pricing/stock/Sold-Out data on every request (Constitution
// Principle 7/10) — a statically-frozen build would go stale immediately.
export const dynamic = "force-dynamic";

/** T218: bilingual title/description (from the live product name/description), canonical, and hreflang alternates. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || !product.availability) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "Seo" });
  const name = resolveLocalizedString(product.name, locale);
  const description = resolveLocalizedString(product.description, locale);
  return buildLocalizedMetadata({
    locale: locale as Locale,
    pathname: `/shop/${slug}`,
    title: t("productTitleTemplate", { product: name }),
    description: description.slice(0, 160),
  });
}

/**
 * The product detail page (spec: gallery/name/price/description/material/
 * options, stock, quantity, add to cart/wishlist, related products) — all
 * read live from Firestore via the Admin SDK, never hardcoded.
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const product = await getProductBySlug(slug);
  if (!product || !product.availability) {
    notFound();
  }

  const [t, category, wishlistedProductIds, rawRelatedProducts] = await Promise.all([
    getTranslations({ locale, namespace: "Product" }),
    getCategoryOrThrow(product.categoryId).catch(() => null),
    getWishlistedProductIds(),
    getRelatedProducts(product.categoryId, product.id),
  ]);
  const relatedProducts = rawRelatedProducts.map((related) => toProductCardData(related, wishlistedProductIds));

  const name = resolveLocalizedString(product.name, locale);
  const description = resolveLocalizedString(product.description, locale);
  const material = resolveLocalizedString(product.material, locale);
  const categoryName = category ? resolveLocalizedString(category.name, locale) : null;
  const { offerStatus, effectivePrice } = resolveOfferPricing(product);

  // T221: JSON-LD `Product` structured data, localized per the active
  // locale — same live product data the page itself renders, never a
  // second source of truth. Price is authoritative Firestore data
  // (never client-submitted), matching Constitution Principle 13.
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image: product.images.map((image) => image.url),
    sku: product.id,
    category: categoryName ?? undefined,
    offers: {
      "@type": "Offer",
      url: `${getBaseUrl()}/${locale}/shop/${slug}`,
      priceCurrency: "USD",
      price: (effectivePrice / 100).toFixed(2),
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  return (
    <main className="container-luxury py-10">
      {/* JSON-LD is not rendered HTML; the payload is entirely
          server-derived Firestore data (name/description/price/stock),
          never raw user input. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ImageGallery images={product.images} name={name} />

        <div className="flex flex-col gap-4">
          {categoryName ? <p className="text-sm text-text-primary/60">{categoryName}</p> : null}
          <h1 className="font-display text-2xl text-text-primary sm:text-3xl">{name}</h1>

          <ProductPurchasePanel
            productId={product.id}
            price={product.price}
            effectivePrice={effectivePrice}
            offerStatus={offerStatus}
            stock={product.stock}
            options={product.options}
            locale={locale}
          />

          <div className="mt-4 flex flex-col gap-4 border-t border-border-luxury pt-4">
            <div>
              <h2 className="font-medium text-text-primary">{t("description")}</h2>
              <p className="mt-1 text-sm text-text-primary/80">{description}</p>
            </div>
            <div>
              <h2 className="font-medium text-text-primary">{t("material")}</h2>
              <p className="mt-1 text-sm text-text-primary/80">{material}</p>
            </div>
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 text-center font-display text-2xl text-text-primary">
            {t("relatedProducts")}
          </h2>
          <div className={PRODUCT_GRID_CLASS}>
            {relatedProducts.map((related) => (
              <ProductCard key={related.id} product={related} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
