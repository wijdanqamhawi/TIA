import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/config/site";

export type HeroImageSlot = {
  /** Wide/desktop artwork. */
  desktopUrl: string;
  /** Portrait/mobile artwork; falls back to `desktopUrl` when the store has not uploaded a distinct one. */
  mobileUrl: string;
};

/** Entrance-sequence delay for `.hero-rise` (globals.css). */
const rise = (ms: number) => ({ "--hero-delay": `${ms}ms` }) as CSSProperties;

/**
 * The homepage hero (spec FR-001), built to the approved reference: a wide,
 * deliberately *short* cinematic band (~296px on desktop) sitting below the
 * white header, with the campaign photograph on the end side and a deep-navy
 * field on the start side carrying —
 *
 *   the TIA lockup
 *   a serif headline closing on an italic champagne clause
 *   one outlined CTA
 *
 * …and, on the far end edge, the reference's three-line stacked caption over
 * a champagne rule with a small spark.
 *
 * There is no supporting paragraph: the reference's hero is a masthead, not
 * a text block, and the band's height depends on that.
 *
 * ── THE IMAGE SLOT ───────────────────────────────────────────────────────
 * `image` is fed by the homepage from the first active Category Showcase's
 * uploaded artwork (managed at `/admin/showcases`), falling back to the
 * approved TIA hero photograph (`HOME_HERO`) only while the store has none
 * — real store imagery always wins. When `image` is `null` a composed navy
 * ground renders instead.
 *
 * The photograph is never recoloured: the navy field is a scrim over it
 * (`.hero-scrim`), so skin tones and gold jewellery stay warm. The artwork
 * is deliberately *not* mirrored under RTL — `.hero-scrim` already flips its
 * own gradient, and flipping the image too would put the model back
 * underneath the Arabic copy instead of opposite it.
 */
export async function Hero({ locale, image }: { locale: string; image?: HeroImageSlot | null }) {
  const [tHome, tCommon, tSplash] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Splash" }),
  ]);

  // The reference stacks the motto as three lines. It is authored as one
  // bulleted string, so it is split here rather than duplicated as three
  // new translation keys.
  const mottoLines = tSplash("motto")
    .split("•")
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <section className="relative isolate w-full overflow-hidden bg-brand-espresso">
      <div className="relative h-[23rem] w-full sm:h-[19rem] lg:h-[clamp(17rem,19.65vw,19.5rem)]">
        {image ? (
          <div className="hero-image absolute inset-0">
            {/* The approved photograph is a 3:1 landscape frame, so
                `object-cover` crops it on a different axis at each width
                and only one half of each `object-position` pair is ever
                doing work:

                  · tablet (band taller than 3:1) — the frame overflows
                    horizontally, so *x* picks the window. 62% holds the
                    model and all four pieces (earring, ring, necklace,
                    bracelet) while leaving the navy field on the start
                    side, under the copy.
                  · desktop (band flatter than 3:1) — the frame overflows
                    vertically instead and *y* picks the window, with less
                    of the frame surviving the wider the viewport gets. At
                    ~1024px the whole set still fits; by 1440px the band
                    shows ~59% of the frame and by 1920px only ~49%, which
                    is narrower than the earring-to-bracelet span. 45%
                    therefore keeps the three pieces the eye lands on —
                    ring, pendant, bracelet charm — and lets the earring go
                    with the top of the face rather than clipping the
                    necklace, which is the hero of the shot.
                  · 2xl and up — the band is flattest here, so the window
                    drops to 58% to hold the bracelet, which 45% would
                    otherwise cut.

                Both halves ride on one class so a single file behaves at
                every width. The frame is never mirrored under RTL (see the
                note above). */}
            <Image
              src={image.desktopUrl}
              alt=""
              aria-hidden="true"
              fill
              sizes="100vw"
              priority
              className="hidden object-cover object-[62%_45%] sm:block 2xl:object-[62%_58%]"
            />
            {/* Phones: the band is nearly square, so the frame overflows
                horizontally by a wide margin — x alone chooses the window,
                and 62% centres it on the jewellery. */}
            <Image
              src={image.mobileUrl}
              alt=""
              aria-hidden="true"
              fill
              sizes="100vw"
              priority
              className="object-cover object-[62%_center] sm:hidden"
            />
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 [background:radial-gradient(60%_70%_at_70%_40%,rgba(196,164,107,0.2),transparent_70%),linear-gradient(to_bottom,#16223e,#0a1226)]"
          />
        )}

        <div aria-hidden="true" className="hero-scrim absolute inset-0" />

        <div className="container-luxury relative flex h-full flex-col justify-center text-text-on-dark">
          <div className="flex max-w-[32rem] flex-col items-start gap-3.5 text-start lg:ps-[3%]">
            {/* The TIA lockup, as in the reference — rendered directly here
                rather than via `Logo`, which is a link; a second home link
                inside the hero would duplicate the header's. */}
            <div style={rise(0)} className="hero-rise flex flex-col items-start leading-none">
              <span dir="ltr" className="font-display text-[1.75rem] font-normal tracking-[0.3em] lg:text-[2rem]">
                {SITE_NAME}
              </span>
              <span
                dir="ltr"
                className="mt-1.5 text-[0.5625rem] font-normal uppercase tracking-[0.3em] text-text-on-dark/80"
              >
                {SITE_TAGLINE}
              </span>
            </div>

            {/* The reference sets the headline as a three-line stack. The
                measure below is what produces it: at this size
                "More than accessories" cannot fit on one line, so it breaks
                after "More than" and the italic champagne clause lands on
                the third line. Arabic keeps its natural wrap — forcing an
                English line count onto it would break mid-phrase. */}
            <h1
              style={rise(150)}
              className="hero-rise max-w-[21rem] font-display text-[clamp(1.75rem,2.9vw,2.375rem)] font-normal leading-[1.16] rtl:max-w-none rtl:text-[clamp(1.625rem,2.6vw,2.125rem)] rtl:leading-[1.45]"
            >
              {tHome("heroHeadline")}
              <span className="block italic text-brand-gold-muted rtl:not-italic">{tHome("heroSecondary")}</span>
            </h1>

            <Link
              href="/shop"
              style={rise(320)}
              className="hero-rise group/arrow mt-1 inline-flex min-h-11 items-center justify-center gap-3 border border-brand-gold/70 px-8 text-[0.625rem] font-medium uppercase tracking-[0.22em] text-text-on-dark transition-colors duration-300 hover:bg-brand-gold hover:text-brand-espresso focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-on-dark rtl:text-xs rtl:normal-case rtl:tracking-normal"
            >
              {tCommon("shopNow")}
              <ArrowRight
                aria-hidden="true"
                size={13}
                className="transition-transform duration-300 ease-luxury group-hover/arrow:translate-x-1 rtl:-scale-x-100 rtl:group-hover/arrow:-translate-x-1 motion-reduce:!translate-x-0"
              />
            </Link>
          </div>
        </div>

        {/* Far end edge: the stacked caption over a champagne rule with a
            small spark at its centre. Desktop only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute end-10 top-1/2 hidden -translate-y-1/2 flex-col items-start gap-3 lg:flex xl:end-16"
        >
          <span className="flex flex-col gap-1 text-[0.625rem] font-medium uppercase leading-[1.8] tracking-[0.24em] text-text-on-dark/85 rtl:text-[0.8125rem] rtl:normal-case rtl:leading-relaxed rtl:tracking-normal">
            {mottoLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </span>
          <span className="flex w-full items-center gap-2 text-brand-gold/70">
            <span className="block h-px flex-1 bg-current" />
            <svg viewBox="0 0 24 24" className="size-2.5 shrink-0" fill="currentColor">
              <path d="M12 0 C12.6 7.4 16.6 11.4 24 12 C16.6 12.6 12.6 16.6 12 24 C11.4 16.6 7.4 12.6 0 12 C7.4 11.4 11.4 7.4 12 0Z" />
            </svg>
            <span className="block h-px flex-1 bg-current" />
          </span>
        </div>
      </div>
    </section>
  );
}
