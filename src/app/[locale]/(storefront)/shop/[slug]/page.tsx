import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Gem, PackageCheck, Wallet } from "lucide-react";
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
import { ProductBreadcrumb, type Crumb } from "@/components/storefront/product/ProductBreadcrumb";
import { ProductInfoTabs, type ProductTab } from "@/components/storefront/product/ProductInfoTabs";
import { SelectedVariantProvider } from "@/components/storefront/product/SelectedVariantContext";
import { Badge } from "@/components/ui/Badge";
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
 * The product detail page, composed to the approved reference: a breadcrumb
 * row, a gallery (thumbnail rail + large pearl-ground frame) beside the
 * product information column, a trust row, the tabbed information strip, and
 * the category-scoped "You May Also Like" grid.
 *
 * ── WHAT THE REFERENCE SHOWS THAT THIS STORE HAS NO DATA FOR ─────────────
 * The reference carries a star rating, "(24 reviews)", a Reviews tab, a
 * Shipping & Returns tab, colour swatches and a bulleted specification list.
 * The product model has none of these: no rating, no review collection, no
 * per-product shipping/returns policy, and `options` carry localized text
 * labels rather than colours. Each is omitted rather than faked, and the
 * remaining composition is balanced to absorb the space.
 *
 * The trust row uses the store's own existing service copy (the same
 * `Home.benefit*` strings the homepage strip renders) instead of the
 * reference's shipping promises, which this store has not made.
 *
 * Everything else — pricing, stock, Sold Out, options, cart, wishlist,
 * recommendations — is the existing live logic, untouched.
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

  const [t, tNav, tShop, tHome, category, wishlistedProductIds, rawRelatedProducts] = await Promise.all([
    getTranslations({ locale, namespace: "Product" }),
    getTranslations({ locale, namespace: "Nav" }),
    getTranslations({ locale, namespace: "Shop" }),
    getTranslations({ locale, namespace: "Home" }),
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

  const crumbs: Crumb[] = [
    { label: tNav("home"), href: "/" },
    { label: tShop("title"), href: "/shop" },
    ...(category && categoryName ? [{ label: categoryName, href: `/shop/category/${category.slug}` }] : []),
    { label: name },
  ];

  // The reference's header row, built only from copy this store actually
  // has. "Description" is a label that points back at the paragraph under
  // the price rather than repeating it: the model has one `description`
  // field, and rendering it twice would duplicate real content on screen and
  // make `getByText(description)` ambiguous for the catalogue specs.
  // "Details" carries the material, which appears nowhere else.
  const tabs: ProductTab[] = [
    ...(description ? [{ id: "description", label: t("description"), href: "#product-description" }] : []),
    ...(material ? [{ id: "details", label: t("details"), body: material }] : []),
  ];

  // The store's own service copy — the same strings the homepage trust strip
  // renders. Nothing here is a promise invented for this page.
  const services = [
    { Icon: Gem, title: tHome("benefitQualityTitle"), body: tHome("benefitQualityBody") },
    { Icon: PackageCheck, title: tHome("benefitReturnsTitle"), body: tHome("benefitReturnsBody") },
    { Icon: Wallet, title: tHome("benefitSecureTitle"), body: tHome("benefitSecureBody") },
  ];

  // T221: JSON-LD `Product` structured data, localized per the active
  // locale — same live product data the page itself renders, never a
  // second source of truth.
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
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <main className="bg-brand-ivory">
      {/* JSON-LD is not rendered HTML; the payload is entirely
          server-derived Firestore data, never raw user input. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />

      <div className="container-rows pb-12 pt-5">
        <ProductBreadcrumb crumbs={crumbs} label={t("breadcrumb")} />

        {/* Product row, information strip and recommendations all share one
            1120px measure, centred under the wider breadcrumb — the
            reference's relationship between the two. */}
        <div className="mx-auto w-full max-w-[70rem]">

        {/* The reference's measure: a 610px gallery (106 rail + 14 gap +
            490 frame) against a 458px information column, separated by 52 —
            1120 in total, and deliberately *not* filling the wider
            breadcrumb container, which is where the composition's air comes
            from. The tab strip and the recommendation row share this same
            1120 measure (see the wrapper below) so the whole page reads as
            one column of content rather than blocks of different widths —
            the tab strip used to run 131px wider than the product above it,
            which is what made it look detached with a blank area beside it. */}
        {/* The selected colour is shared by the gallery (left) and the
            purchase panel (right), which are siblings in this grid — see
            `SelectedVariantContext`. Pre-selected with the product's first
            option value, matching the reference's "Color: Gold" on arrival. */}
        <SelectedVariantProvider initialValueKey={product.options[0]?.values[0]?.key ?? null}>
        <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-[38.125rem_28.625rem] lg:gap-[3.25rem]">
          <ImageGallery
            images={product.images}
            name={name}
            productId={product.id}
            isWishlisted={wishlistedProductIds.has(product.id)}
            locale={locale}
          />

          {/* The column stays its natural height (`items-start` on the grid
              above), rather than being stretched to the plate's height.
              Stretching it put a 124px hole *inside* the column, under the
              trust row, on any product with no options and a one-line
              description. Pushing the trust row down to the plate's foot was
              tried too and was worse again — it split the control group by
              moving the gap between Add to Cart and the trust row. */}
          <div className="flex flex-col gap-4">
            {product.isBestSeller || product.isNewArrival ? (
              <div className="flex w-fit gap-2">
                {product.isBestSeller ? <Badge variant="gold">{tHome("bestSellers")}</Badge> : null}
                {product.isNewArrival ? <Badge variant="gold">{tHome("newArrivals")}</Badge> : null}
              </div>
            ) : null}

            <h1 className="font-display text-[clamp(1.875rem,3vw,2.75rem)] font-normal leading-tight text-text-primary">
              {name}
            </h1>

            <ProductPurchasePanel
              productId={product.id}
              price={product.price}
              effectivePrice={effectivePrice}
              offerStatus={offerStatus}
              stock={product.stock}
              options={product.options}
              locale={locale}
              description={description}
            />

            {/* Trust row — the store's own service copy, on one tight line
                as in the reference. */}
            <ul className="mt-1 grid grid-cols-1 gap-x-2 gap-y-3 pt-1 sm:grid-cols-3">
              {services.map(({ Icon, title, body }) => (
                <li key={title} className="flex items-start gap-2">
                  <Icon aria-hidden="true" size={17} strokeWidth={1.2} className="mt-px shrink-0 text-brand-gold" />
                  <div className="flex min-w-0 flex-col">
                    <p className="text-[0.6875rem] font-medium leading-tight text-text-primary">{title}</p>
                    <p className="text-[0.625rem] leading-tight text-text-secondary">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        </SelectedVariantProvider>

        <div className="mt-12">
          <ProductInfoTabs tabs={tabs} />
        </div>

        {relatedProducts.length > 0 ? (
          <section className="mt-12">
            <div className="flex flex-col items-center gap-2 text-center">
              <span aria-hidden="true" className="block h-px w-9 bg-brand-gold/60" />
              <h2 className="font-body text-[0.8125rem] font-medium uppercase tracking-[0.22em] text-brand-gold-ink rtl:text-sm rtl:normal-case rtl:tracking-normal">
                {t("relatedProducts")}
              </h2>
            </div>
            {/* Four fixed tracks, as in the reference, left-aligned. A
                centred flex row was tried for categories with fewer than
                four related products and looked worse, not better: two cards
                floated in the middle of the 1120 measure with large blank
                flanks either side. Left-aligned tracks keep the cards at
                their reference size and let the row simply end early.
                Nothing is padded out to reach four; only real related
                products are ever shown. */}
            <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {relatedProducts.map((related) => (
                <ProductCard key={related.id} product={related} locale={locale} />
              ))}
            </div>
          </section>
        ) : null}
        </div>
      </div>
    </main>
  );
}
