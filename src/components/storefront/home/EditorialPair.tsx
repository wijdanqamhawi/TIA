import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocalizedString } from "@/types/localizedString";
import type { Product } from "@/types/product";
import { DEMO_EDITORIAL, resolveEditorialImage } from "@/lib/config/demoImages";

const CTA =
  "group/arrow inline-flex min-h-10 w-fit items-center justify-center gap-2.5 border border-brand-burgundy px-5 text-[0.625rem] font-medium uppercase tracking-[0.2em] text-brand-burgundy transition-colors duration-300 hover:bg-brand-burgundy hover:text-text-on-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy rtl:text-xs rtl:normal-case rtl:tracking-normal";

const ARROW =
  "transition-transform duration-300 ease-luxury group-hover/arrow:translate-x-1 rtl:-scale-x-100 rtl:group-hover/arrow:-translate-x-1 motion-reduce:!translate-x-0";

/**
 * The reference's editorial pair — two half-width panels side by side, each
 * a copy block meeting a square-ish photograph:
 *
 *   start — "The Piece": a real product, on the warm-white ground
 *   end   — "Every Detail Tells Your Story": the Shop the Look invitation,
 *           on the cool-pearl ground
 *
 * "The Piece" shows a real product chosen by the page (its own name is not
 * used as the heading — the reference's heading is the section label, and
 * the product is what the photograph and the link point at). With no
 * product at all the panel falls back to demo copy and links to the Shop.
 *
 * On phones the two panels stack, each keeping its image above its copy.
 */
export async function EditorialPair({
  product,
  locale,
}: {
  product: Product | null;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "Home" });

  const href = product ? `/shop/${product.slug}` : "/shop";
  const pieceImage = resolveEditorialImage(product?.images[0]?.url, DEMO_EDITORIAL.featurePiece);
  const pieceAlt = product ? resolveLocalizedString(product.name, locale) : "";

  return (
    <section className="bg-brand-ivory py-2">
      <div className="container-wide grid gap-5 lg:grid-cols-2">
        {/* START — The Piece */}
        <div className="grid overflow-hidden bg-brand-ivory sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col justify-center gap-2.5 px-1 py-6 sm:px-2 sm:py-8 lg:ps-4">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-[clamp(1.125rem,1.6vw,1.5rem)] font-normal leading-tight text-text-primary">
                {t("pieceEyebrow")}
              </h2>
              <span aria-hidden="true" className="block h-px w-10 bg-brand-gold/60" />
            </div>
            <p className="max-w-[20rem] text-[0.8125rem] leading-relaxed text-text-secondary">{t("storyBody")}</p>
            <Link href={href} className={`${CTA} mt-2`}>
              {t("pieceCta")}
              <ArrowRight aria-hidden="true" size={12} className={ARROW} />
            </Link>
          </div>

          <div className="relative order-first aspect-[4/3] w-full sm:order-none sm:aspect-auto sm:min-h-[10.5rem]">
            <Image
              src={pieceImage.url}
              alt={product?.images[0]?.alt || pieceAlt}
              fill
              sizes="(max-width: 640px) 100vw, 26vw"
              className="object-cover object-center"
            />
          </div>
        </div>

        {/* END — Every Detail Tells Your Story */}
        <div className="grid overflow-hidden bg-brand-cream sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col justify-center gap-2.5 px-6 py-6 sm:py-8">
            <h2 className="font-display text-[clamp(1.125rem,1.6vw,1.5rem)] font-normal leading-tight text-text-primary">
              {t("lookTitle")}
            </h2>
            <p className="max-w-[18rem] text-[0.8125rem] leading-relaxed text-text-secondary">{t("lookBody")}</p>
            <Link href="/shop" className={`${CTA} mt-2`}>
              {t("lookCta")}
              <ArrowRight aria-hidden="true" size={12} className={ARROW} />
            </Link>
          </div>

          <div className="relative order-first aspect-[4/3] w-full sm:order-none sm:aspect-auto sm:min-h-[10.5rem]">
            <Image
              src={DEMO_EDITORIAL.storyDetail}
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 640px) 100vw, 26vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
