import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocalizedString } from "@/types/localizedString";
import type { Product } from "@/types/product";
import { resolveOfferPricing } from "@/lib/domain/catalog/offer";
import { formatCurrency } from "@/lib/utils/currency";
import { DEMO_EDITORIAL, resolveEditorialImage } from "@/lib/config/demoImages";
import { cn } from "@/lib/utils/cn";
import { ARROW_ICON, ARROW_LINK, KICKER } from "./editorial";

/**
 * "THE PIECE" — one product presented as an editorial feature strip
 * rather than a card: title on the start side, a feathered landscape
 * photograph through the middle, and a specification column (Material /
 * Craft / Details / Price) joined by fine rules on the end side.
 *
 * Reads a real product chosen by the page (a bracelet when there is one).
 * Every value shown is that product's own data — its name, material,
 * category and live offer-aware price — except "Craft", which is a brand
 * statement rather than a product claim. With no product at all the strip
 * falls back to demo copy and links to the Shop.
 */
export async function FeaturePiece({
  product,
  categoryName,
  locale,
}: {
  product: Product | null;
  categoryName: string | null;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "Home" });

  const title = product ? resolveLocalizedString(product.name, locale) : t("pieceDefaultTitle");
  const material = product ? resolveLocalizedString(product.material, locale) : t("pieceDefaultMaterial");
  const price = product ? formatCurrency(resolveOfferPricing(product).effectivePrice, locale) : null;
  const href = product ? `/shop/${product.slug}` : "/shop";
  const image = resolveEditorialImage(product?.images[0]?.url, DEMO_EDITORIAL.featurePiece);

  const specs = [
    { label: t("pieceMaterial"), value: material },
    { label: t("pieceCraft"), value: t("pieceCraftValue") },
    ...(categoryName ? [{ label: t("pieceDetails"), value: categoryName }] : []),
    ...(price ? [{ label: t("piecePrice"), value: price }] : []),
  ];

  return (
    <section className="relative isolate overflow-hidden bg-brand-stone text-text-primary">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 [background:radial-gradient(60%_90%_at_45%_55%,rgba(255,255,255,0.55),transparent_70%)]"
      />
      <div className="container-luxury grid items-center gap-8 py-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)_minmax(0,0.75fr)] lg:gap-6 lg:py-8">
        <div className="order-2 flex flex-col items-start gap-4 lg:order-none lg:ps-[6%]">
          <p className={cn(KICKER, "text-text-primary/80")}>{t("pieceEyebrow")}</p>
          <h2 className="max-w-[12ch] font-display text-4xl font-light leading-[1.08] sm:text-5xl lg:text-[2.75rem] xl:text-[3.25rem]">
            <Link href={href} className="transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current">
              {title}
            </Link>
          </h2>
          <Link href={href} className={cn(ARROW_LINK, "text-text-primary/75")}>
            {t("pieceCta")}
            <ArrowRight aria-hidden="true" size={12} className={ARROW_ICON} />
          </Link>
        </div>

        <div className="feather-x relative order-1 -mx-4 aspect-[16/9] sm:mx-0 lg:order-none lg:aspect-[16/8.5]">
          <Image
            src={image.url}
            alt={product?.images[0]?.alt || title}
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
        </div>

        <dl className="order-3 grid grid-cols-2 gap-x-6 gap-y-6 border-hairline-strong sm:grid-cols-4 lg:order-none lg:grid-cols-1 lg:gap-y-7 lg:border-s lg:py-2 lg:ps-10">
          {specs.map(({ label, value }) => (
            <div key={label} className="relative flex flex-col gap-1.5">
              {/* The short connector rule reaching back to the spine. */}
              <span aria-hidden="true" className="absolute -start-10 top-[0.3rem] hidden h-px w-7 bg-hairline-strong lg:block" />
              <dt className={cn(KICKER, "text-[0.5625rem] text-text-primary/80")}>{label}</dt>
              <dd className="text-sm text-text-primary/80">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
