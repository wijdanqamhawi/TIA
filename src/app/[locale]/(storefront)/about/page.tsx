import type { Metadata } from "next";
import type React from "react";
import Image from "next/image";
import { EB_Garamond } from "next/font/google";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { buildLocalizedMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/lib/i18n/routing";
import styles from "./about.module.css";

/**
 * The `/[locale]/about` page (T213, spec FR-004), reproduced from the
 * approved 1024px reference: hero, Our Story, Our Values, the navy
 * editorial banner, and the Thank You close.
 *
 * ── WHAT THIS PAGE DOES NOT OWN ──────────────────────────────────────────
 * The announcement bar, navbar and footer come from
 * `src/app/[locale]/layout.tsx`; this file renders only what sits between
 * them (the About link's active underline is a page-scoped CSS rule in
 * `about.module.css`). No Firestore or product data is read — every image is
 * an About-only presentation asset in `public/images/about/`, cut from the
 * approved reference itself.
 *
 * ── LAYOUT ───────────────────────────────────────────────────────────────
 * All geometry lives in `about.module.css`, written in reference pixels;
 * see the header comment there.
 */

/**
 * The reference's headline serif is an old-style Garamond; the site-wide
 * Playfair is far wider and higher-contrast and cannot reproduce its line
 * lengths. Loaded here only, so no other route changes. Arabic keeps the
 * site's Arabic display face.
 */
const aboutSerif = EB_Garamond({
  variable: "--font-about-serif",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

/** The wordmark, identical in both locales — a brand mark, not translated copy. */
const WORDMARK = "TIA";

/** Splits a sentence after its first comma so the reference's two-line break holds on wide screens. */
function splitAfterFirstComma(text: string): [string, string] {
  const match = /[,،]\s/.exec(text);
  if (!match) return [text, ""];
  const cut = match.index + 1;
  return [text.slice(0, cut), text.slice(cut).trimStart()];
}

/* Line icons redrawn from the reference at its measured sizes (px at 1024). */
function InfinityIcon() {
  return (
    <svg viewBox="0 0 58 25" style={{ "--icon-w": 56 } as React.CSSProperties} fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M29 12.5C25.5 6.5 21.5 2 14.5 2 7.5 2 2 6.6 2 12.5S7.5 23 14.5 23C21.5 23 25.5 18.5 29 12.5 32.5 6.5 36.5 2 43.5 2 50.5 2 56 6.6 56 12.5S50.5 23 43.5 23C36.5 23 32.5 18.5 29 12.5Z" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg viewBox="0 0 42 36" style={{ "--icon-w": 40 } as React.CSSProperties} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M10 2h22l8 10.5L21 34 2 12.5 10 2Z" />
      <path d="M2 12.5h38M10 2l5.5 10.5L21 2l5.5 10.5L32 2M15.5 12.5 21 34l5.5-21.5" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 42 38" style={{ "--icon-w": 40 } as React.CSSProperties} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M21 36 5.2 20.2C.9 15.9.9 9 5.2 4.9 9.4.8 16.3 1 20.3 5.4l.7.8.7-.8C25.7 1 32.6.8 36.8 4.9c4.3 4.1 4.3 11 0 15.3L21 36Z" />
    </svg>
  );
}

/** T218: bilingual title/description, canonical, and hreflang alternates. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, tSeo] = await Promise.all([
    getTranslations({ locale, namespace: "About" }),
    getTranslations({ locale, namespace: "Seo" }),
  ]);
  return buildLocalizedMetadata({
    locale: locale as Locale,
    pathname: "/about",
    title: t("title"),
    description: tSeo("aboutDescription"),
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  const tNav = await getTranslations({ locale, namespace: "Nav" });
  const isArabic = locale === "ar";

  // The reference breaks each value's copy at a specific word; these
  // measures (reference px) reproduce those breaks in English.
  const values = [
    { Icon: InfinityIcon, title: t("value1Title"), body: t("value1Body"), measure: 162 },
    { Icon: DiamondIcon, title: t("value2Title"), body: t("value2Body"), measure: 180 },
    { Icon: HeartIcon, title: t("value3Title"), body: t("value3Body"), measure: 220 },
  ];
  const [closingLine1, closingLine2] = splitAfterFirstComma(t("closingBody"));
  const caption = t("storyCaption");

  return (
    <main className={`${styles.page} ${aboutSerif.variable}`}>
      {/* ── 1 · HERO ─────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <Image
          src="/images/about/about-hero.jpg"
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={`${styles.frame} ${styles.heroInner}`}>
          <span className={`${styles.eyebrow} ${styles.heroEyebrow}`}>{WORDMARK}</span>
          <hr className={`${styles.rule} ${styles.heroRule}`} aria-hidden="true" />
          <h1 className={`${styles.serif} ${styles.heroTitle}`}>{t("heroHeading")}</h1>
          <p className={`${styles.serif} ${styles.heroTagline}`}>{t("heroTagline")}</p>
        </div>
      </section>

      {/* ── 2 · OUR STORY ────────────────────────────────────────────── */}
      <section className={`${styles.frame} ${styles.story}`}>
        <div className={styles.storyMedia}>
          <Image
            src="/images/about/about-story.jpg"
            alt={caption}
            fill
            sizes="(max-width: 639px) 100vw, 43vw"
            className={styles.storyImage}
          />
          <div className={styles.storyCaption} aria-hidden="true">
            <span className={`${styles.eyebrow} ${styles.storyCaptionText}`}>
              {isArabic ? caption : caption.split(" ").map((word) => <span key={word}>{word}</span>)}
            </span>
            <span className={styles.storyCaptionRule} />
          </div>
        </div>

        <div className={styles.storyText}>
          <span className={`${styles.eyebrow} ${styles.storyEyebrow}`}>{t("storyHeading")}</span>
          <hr className={`${styles.rule} ${styles.storyRule}`} aria-hidden="true" />
          <h2 className={`${styles.serif} ${styles.storyTitle}`}>{t("storyTitle")}</h2>
          <p className={styles.storyBody}>{t("storyBody")}</p>
          {isArabic ? (
            <p className={`${styles.serif} ${styles.storyAccentText}`}>{t("accent")}</p>
          ) : (
            // The reference's hand-lettered line, cut from the reference itself.
            <Image
              src="/images/about/about-script-story.png"
              alt={t("accent")}
              width={660}
              height={128}
              sizes="(max-width: 639px) 300px, 33vw"
              className={styles.storyScript}
            />
          )}
        </div>
      </section>

      {/* ── 3 · OUR VALUES ───────────────────────────────────────────── */}
      <section className={styles.values}>
        <div className={styles.valuesHead}>
          <span className={`${styles.eyebrow} ${styles.valuesEyebrow}`}>{t("valuesLabel")}</span>
          <hr className={`${styles.rule} ${styles.valuesRule}`} aria-hidden="true" />
          <h2 className={`${styles.serif} ${styles.valuesTitle}`}>{t("valuesHeading")}</h2>
        </div>
        <div className={styles.valuesGrid}>
          {values.map(({ Icon, title, body, measure }) => (
            <div key={title} className={styles.valueItem}>
              <span className={styles.valueIcon} aria-hidden="true">
                <Icon />
              </span>
              <h3 className={styles.valueTitle}>{title}</h3>
              <hr className={`${styles.rule} ${styles.valueRule}`} aria-hidden="true" />
              <p className={styles.valueBody} style={{ maxWidth: `calc(var(--t) * ${measure})` }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4 · NAVY EDITORIAL BANNER ────────────────────────────────── */}
      <section className={styles.banner}>
        <div className={styles.bannerMedia}>
          <Image
            src="/images/about/about-rings.jpg"
            alt=""
            aria-hidden="true"
            fill
            sizes="(max-width: 639px) 100vw, 50vw"
            className={styles.bannerImage}
          />
        </div>
        <div className={styles.frame}>
          <div className={styles.bannerQuote}>
            <blockquote className={styles.serif}>
              <span>{t("statementLine1")}</span>{" "}
              <span className={styles.bannerLine2}>{t("statementLine2")}</span>
            </blockquote>
            <hr className={`${styles.rule} ${styles.bannerRule}`} aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* ── 5 · THANK YOU ────────────────────────────────────────────── */}
      <section className={styles.thanks}>
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative multiply layer, sized in CSS */}
        <img src="/images/about/about-floral.jpg" alt="" aria-hidden="true" className={styles.floral} />
        <div className={`${styles.frame} ${styles.thanksInner}`}>
          <span className={`${styles.eyebrow} ${styles.thanksEyebrow}`}>{WORDMARK}</span>
          <hr className={`${styles.rule} ${styles.thanksRule}`} aria-hidden="true" />
          <h2 className={`${styles.serif} ${styles.thanksTitle}`}>{t("closingHeading")}</h2>
          <p className={styles.thanksBody}>
            <span>{closingLine1}</span> <span>{closingLine2}</span>
          </p>
          <Link href="/contact" className={styles.thanksButton}>
            {tNav("contact")}
          </Link>
          {isArabic ? (
            <p aria-hidden="true" className={`${styles.serif} ${styles.thanksAccentText}`}>
              {t("closingAccent")}
            </p>
          ) : (
            <Image
              src="/images/about/about-script-thanks.png"
              alt=""
              aria-hidden="true"
              width={348}
              height={168}
              sizes="(max-width: 639px) 150px, 17vw"
              className={styles.thanksScript}
            />
          )}
        </div>
      </section>
    </main>
  );
}
