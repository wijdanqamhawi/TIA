import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { DEMO_EDITORIAL } from "@/lib/config/demoImages";

/**
 * "LESS ORDINARY" — the reference's full-width navy campaign banner: a deep
 * navy copy field across the start ~60% (serif heading, one supporting line,
 * an outlined champagne CTA) meeting a close-cropped jewellery photograph on
 * the end side, which feathers into the navy at its inner edge.
 *
 * Deliberately wide and shallow (~170px on desktop) so it reads as a
 * horizontal band punctuating the white page rather than as a full-height
 * section. On phones the photograph stacks above the copy, keeping the CTA
 * close to the thumb.
 */
export async function LessOrdinary({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <section className="bg-brand-ivory py-2">
      <div className="container-wide">
        <div className="relative isolate grid overflow-hidden bg-brand-burgundy text-text-on-dark lg:min-h-[9.625rem] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <div className="relative z-10 flex flex-col justify-center gap-2 px-7 py-8 sm:px-10 lg:ps-[5%] lg:pe-8 lg:py-0">
            <h2 className="font-display text-[clamp(1.5rem,2.4vw,2.125rem)] font-normal leading-tight">
              {t("ordinaryLine1")}
            </h2>
            <p className="max-w-[24rem] text-[0.8125rem] leading-relaxed text-text-on-dark/75">{t("ordinaryBody")}</p>
            <Link
              href="/shop"
              className="group/arrow mt-2 inline-flex min-h-10 w-fit items-center justify-center gap-2.5 border border-brand-gold/70 px-6 text-[0.625rem] font-medium uppercase tracking-[0.2em] text-text-on-dark transition-colors duration-300 hover:bg-brand-gold hover:text-brand-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-on-dark rtl:text-xs rtl:normal-case rtl:tracking-normal"
            >
              {t("ordinaryCta")}
              <ArrowRight
                aria-hidden="true"
                size={12}
                className="transition-transform duration-300 ease-luxury group-hover/arrow:translate-x-1 rtl:-scale-x-100 rtl:group-hover/arrow:-translate-x-1 motion-reduce:!translate-x-0"
              />
            </Link>
          </div>

          <div className="relative order-first h-40 sm:h-52 lg:order-none lg:h-auto">
            <Image
              src={DEMO_EDITORIAL.ordinaryModel}
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover object-[center_38%]"
            />
            {/* Feathers the photograph into the navy field at its inner
                edge, mirrored under RTL. */}
            {/* Feathers only the photograph's inner edge into the navy, so
                the jewellery itself stays fully legible. Mirrored under
                RTL. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-brand-burgundy from-0% via-transparent via-45% to-transparent rtl:bg-gradient-to-l"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
