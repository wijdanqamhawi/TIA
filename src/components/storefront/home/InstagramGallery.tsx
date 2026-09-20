import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { DEMO_EDITORIAL } from "@/lib/config/demoImages";
import { buildInstagramHref } from "@/lib/config/social";
import { SITE_NAME } from "@/lib/config/site";

/**
 * The "@TIA" gallery — the reference's tight horizontal run of square
 * lifestyle frames, closed by a champagne quote tile carrying the brand
 * line.
 *
 * ── WHAT THIS IS AND IS NOT ──────────────────────────────────────────────
 * It is *not* an Instagram integration: nothing here calls Instagram, and no
 * feed is fetched. The frames are the store's local editorial photography,
 * and the heading links to the configured Instagram profile (the same
 * centralized `social` config the footer and floating button read). If no
 * Instagram URL is configured the heading simply renders as text, so the
 * section never advertises a destination that does not exist.
 *
 * Replace the demo frames with real campaign photography by swapping the
 * files in `public/images/demo/` — no code change needed.
 */
export async function InstagramGallery({ locale }: { locale: string }) {
  const [tHome, tSocial] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Social" }),
  ]);
  const instagramHref = buildInstagramHref();

  const frames = [
    DEMO_EDITORIAL.statementModel,
    DEMO_EDITORIAL.featurePiece,
    DEMO_EDITORIAL.storyDetail,
    DEMO_EDITORIAL.statementStill,
    DEMO_EDITORIAL.ordinaryProduct,
    DEMO_EDITORIAL.storyModel,
  ];

  const handle = `@${SITE_NAME}`;

  return (
    <section aria-labelledby="tia-gallery-heading" className="overflow-x-clip bg-brand-ivory pb-2 pt-2 text-text-primary">
      <div className="container-rows">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id="tia-gallery-heading" className="font-display text-[1.125rem] font-normal leading-none lg:text-[1.25rem]">
            {instagramHref ? (
              <a
                href={instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={tSocial("instagramLabel")}
                className="transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
              >
                <span dir="ltr">{handle}</span>
              </a>
            ) : (
              <span dir="ltr">{handle}</span>
            )}
          </h2>
          <p className="text-xs text-text-secondary">{tHome("galleryCaption")}</p>
        </div>

        {/* `tabIndex`: below `sm` this row scrolls horizontally, and its
            tiles are decorative images with nothing focusable inside, so
            without a tab stop the row's off-screen content is unreachable
            by keyboard (axe `scrollable-region-focusable`). The label names
            what the tab stop is. */}
        <ul
          tabIndex={0}
          aria-label={tHome("galleryCaption")}
          className="scrollbar-none -mx-5 flex max-w-[calc(100%+2.5rem)] snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy sm:mx-0 sm:grid sm:max-w-full sm:grid-cols-4 sm:gap-2.5 sm:overflow-visible sm:px-0 lg:grid-cols-7"
        >
          {frames.map((src, index) => (
            // `relative`: the tile's `sr-only` label is absolutely positioned,
            // and without a positioned tile its containing block sat outside
            // the phone scroll row, so off-screen labels escaped the row's
            // clipping and widened the whole page (horizontal scroll).
            <li key={src} className="relative w-[38%] shrink-0 snap-start sm:w-auto">
              <div className="relative aspect-square w-full overflow-hidden bg-brand-cream">
                <Image
                  src={src}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(max-width: 640px) 38vw, (max-width: 1024px) 24vw, 12vw"
                  className="object-cover object-center transition-transform duration-700 ease-luxury hover:scale-105"
                />
              </div>
              <span className="sr-only">{index + 1}</span>
            </li>
          ))}

          {/* The closing quote tile — the brand line, never a photograph. */}
          <li className="w-[38%] shrink-0 snap-start sm:w-auto">
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 bg-brand-cream px-3 text-center">
              <p className="font-display text-[0.8125rem] leading-snug text-text-primary lg:text-sm">
                {tHome("statementTitle")}
              </p>
              <p className="font-display text-[0.8125rem] italic leading-snug text-brand-gold-ink lg:text-sm rtl:not-italic">
                {tHome("statementSubtitle")}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
