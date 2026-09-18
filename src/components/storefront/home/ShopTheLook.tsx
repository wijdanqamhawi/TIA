import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocalizedString } from "@/types/localizedString";
import type { ProductCardData } from "@/lib/domain/catalog/product.service";
import { DEMO_EDITORIAL, resolveProductImage } from "@/lib/config/demoImages";
import { cn } from "@/lib/utils/cn";
import { ARROW_ICON, KICKER, OUTLINE_CTA } from "./editorial";

/**
 * "SHOP THE LOOK" — a split editorial: a large lifestyle photograph on the
 * start side; the title, copy and an outlined CTA on the end side; and a
 * narrow stack of real product thumbnails (each linking to its product)
 * along the far edge. On phones the stack becomes a row under the copy.
 */
export async function ShopTheLook({
  products,
  locale,
}: {
  products: ProductCardData[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "Home" });
  const look = products.slice(0, 4);

  return (
    <section className="bg-brand-sand text-text-primary">
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[32rem]">
          <Image
            src={DEMO_EDITORIAL.lookModel}
            alt=""
            aria-hidden="true"
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover object-[center_30%]"
          />
        </div>

        <div className="flex flex-col gap-10 px-4 py-12 sm:px-10 sm:py-14 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-14 xl:px-20">
          <div className="flex max-w-sm flex-col items-start gap-5">
            <p className={cn(KICKER, "text-text-primary/80")}>{t("lookEyebrow")}</p>
            <h2 className="max-w-[10ch] font-display text-4xl font-light leading-[1.08] sm:text-5xl lg:text-[3rem]">
              {t("lookTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-text-primary/80">{t("lookBody")}</p>
            <Link href="/shop" className={cn(OUTLINE_CTA, "mt-2 text-text-primary")}>
              {t("lookCta")}
              <ArrowRight aria-hidden="true" size={14} className={ARROW_ICON} />
            </Link>
          </div>

          {look.length > 0 ? (
            <ul className="flex shrink-0 gap-3 lg:w-24 lg:flex-col xl:w-28">
              {look.map((product) => {
                const name = resolveLocalizedString(product.name, locale);
                const image = resolveProductImage(product.images[0]?.url, product.id);
                return (
                  <li key={product.id} className="w-1/4 max-w-24 lg:w-full lg:max-w-none">
                    <Link
                      href={`/shop/${product.slug}`}
                      aria-label={name}
                      title={name}
                      className="group relative block aspect-square overflow-hidden bg-brand-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
                    >
                      <Image
                        src={image.url}
                        alt=""
                        fill
                        sizes="112px"
                        className="object-cover transition-transform duration-500 ease-luxury group-hover:scale-110"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
