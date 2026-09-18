import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Gem, Gift, Heart, Leaf } from "lucide-react";
import { DEMO_EDITORIAL } from "@/lib/config/demoImages";
import { SITE_NAME } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";
import { KICKER } from "./editorial";
import { RevealOnView } from "./RevealOnView";

/** Position in the entrance sequence; each step is 100ms (globals.css). */
const revealStep = (index: number) => ({ "--reveal-i": index }) as CSSProperties;

/**
 * Small stacked caption set over a photograph's quiet corner. Colour is
 * chosen per photograph (navy over the light marble, warm white over the
 * darker portrait) so each keeps AA contrast.
 */
const CAPTION =
  "max-w-[10ch] text-center font-body text-[0.625rem] font-medium uppercase leading-[1.9] tracking-[0.3em] rtl:max-w-[12rem] rtl:text-sm rtl:font-normal rtl:normal-case rtl:leading-relaxed rtl:tracking-normal";

/**
 * The brand statement — a cinematic magazine-spread band between Best
 * Sellers and Shop by Category:
 *
 *   still life | MORE THAN ACCESSORIES / made to be part of you / 4 values | lifestyle
 *
 * with an oversized, near-invisible TIA watermark behind the statement.
 * Presentation only — no data, links or state.
 *
 * Layout: three columns from `lg` (the photographs feather into the pearl
 * ground at their inner edge, mirrored under RTL); on tablets the statement spans
 * the width with both photographs side by side beneath it; on phones it is
 * a vertical story — image, statement, values in a 2×2, second image.
 *
 * Motion: the shared one-time reveal (watermark fades, heading rises,
 * values stagger) plus a very slight CSS scroll-parallax on the photographs
 * where the browser supports scroll timelines; all removed under
 * `prefers-reduced-motion`.
 */
export async function BrandStatement({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Home" });

  const values = [
    { Icon: Gem, label: t("valueQuality") },
    { Icon: Leaf, label: t("valueDesign") },
    { Icon: Heart, label: t("valueForYou") },
    { Icon: Gift, label: t("valueGift") },
  ];

  return (
    <section aria-labelledby="brand-statement-title" className="relative isolate overflow-hidden bg-brand-cream text-text-primary">
      <RevealOnView className="grid grid-cols-1 sm:grid-cols-2 lg:h-[clamp(27rem,30vw,31rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        {/* START — jewellery still life. */}
        <figure className="statement-photo statement-photo--start relative h-72 overflow-hidden sm:h-80 lg:h-full">
          <div className="statement-parallax absolute inset-0">
            <Image
              src={DEMO_EDITORIAL.statementStill}
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw"
              className="object-cover object-center"
            />
          </div>
          <figcaption className="absolute start-6 top-8 flex flex-col items-center gap-4 sm:start-10 sm:top-10">
            <span className={cn(CAPTION, "text-text-primary/80")}>{t("statementCaptionStart")}</span>
            <span aria-hidden="true" className="block h-px w-8 bg-brand-gold/80" />
          </figcaption>
        </figure>

        {/* CENTRE — the statement. First on tablets (full width), second on
            phones and desktop. */}
        <div className="relative flex flex-col items-center justify-center px-6 py-16 text-center sm:order-first sm:col-span-2 sm:py-20 lg:order-none lg:col-span-1 lg:px-8 lg:py-10">
          {/* The oversized watermark: Latin, never mirrored, never read. */}
          <span
            aria-hidden="true"
            dir="ltr"
            data-reveal="fade"
            style={revealStep(0)}
            className="pointer-events-none absolute inset-0 -z-10 flex select-none items-center justify-center font-display text-[clamp(9rem,24vw,24rem)] font-light leading-none tracking-[0.08em] text-text-primary/[0.045]"
          >
            {SITE_NAME}
          </span>

          <h2
            id="brand-statement-title"
            data-reveal="up"
            style={revealStep(1)}
            className="font-display text-[clamp(1.875rem,2.6vw,3.25rem)] font-normal uppercase leading-[1.08] tracking-[0.06em] text-brand-burgundy rtl:normal-case rtl:leading-[1.4] rtl:tracking-normal"
          >
            {t("statementTitle")}
          </h2>

          <div data-reveal="up" style={revealStep(2)} className="mt-5 flex items-center gap-3 sm:gap-6">
            <span aria-hidden="true" className="block h-px w-8 shrink-0 bg-brand-gold/70 sm:w-16" />
            <p
              className={cn(
                KICKER,
                // `rtl:!tracking-normal` wins over the `sm:` tracking at every
                // width: letter-spacing breaks Arabic's joined letterforms.
                "whitespace-nowrap text-[0.6875rem] tracking-[0.26em] text-text-primary/80 sm:text-xs sm:tracking-[0.42em] rtl:text-sm rtl:!tracking-normal",
              )}
            >
              {t("statementSubtitle")}
            </p>
            <span aria-hidden="true" className="block h-px w-8 shrink-0 bg-brand-gold/70 sm:w-16" />
          </div>

          <ul className="mt-12 grid w-full max-w-2xl grid-cols-2 gap-y-10 sm:grid-cols-4 sm:gap-y-0 lg:mt-12">
            {values.map(({ Icon, label }, index) => (
              <li
                key={label}
                data-reveal="up"
                style={revealStep(3 + index)}
                className={cn(
                  "flex flex-col items-center gap-3 px-3",
                  // Thin champagne rules between values (start side, so they
                  // follow reading direction); none on the phone 2×2.
                  index > 0 && "sm:border-s sm:border-brand-gold/40",
                )}
              >
                <Icon aria-hidden="true" size={26} strokeWidth={1} className="text-brand-gold" />
                <span className="max-w-[7.5rem] text-[0.625rem] font-medium uppercase leading-[1.7] tracking-[0.22em] text-text-primary/80 rtl:max-w-none rtl:text-sm rtl:font-normal rtl:normal-case rtl:tracking-normal">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* END — lifestyle crop. */}
        <figure className="statement-photo statement-photo--end relative h-72 overflow-hidden sm:h-80 lg:h-full">
          <div className="statement-parallax absolute inset-0">
            <Image
              src={DEMO_EDITORIAL.statementModel}
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw"
              className="object-cover object-[65%_center]"
            />
          </div>
          {/* On the photograph's outer (dark) side — clear of the feathered
              inner edge — in warm white for contrast against the image. */}
          <figcaption className="absolute end-6 top-8 flex flex-col items-center gap-4 sm:end-10 sm:top-10">
            <span className={cn(CAPTION, "text-text-on-dark/90")}>{t("statementCaptionEnd")}</span>
            <span aria-hidden="true" className="block h-px w-8 bg-brand-gold/80" />
          </figcaption>
        </figure>
      </RevealOnView>
    </section>
  );
}
