import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Heart, MessageCircle, Sparkles } from "lucide-react";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/SocialIcons";
import { ServiceBenefits } from "@/components/storefront/home/ServiceBenefits";
import { buildInstagramHref, buildWhatsAppHref } from "@/lib/config/social";
import { buildLocalizedMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/lib/i18n/routing";
import styles from "./contact.module.css";

// Unlike the icon-only Navbar/Footer/floating placements, these CTAs
// already carry clear, self-descriptive visible text ("Chat with us on
// WhatsApp") — an `aria-label` here would *override* that text as the
// accessible name rather than supplement it (WCAG 2.5.3 "Label in Name"),
// making the visible and accessible names diverge for no benefit.

/**
 * The `/[locale]/contact` page (T214, spec FR-005), rebuilt to the approved
 * editorial reference: a two-column hero (copy at the start edge, jewellery
 * still-life at the end edge), the two channel CTAs, three quiet support
 * features, the signature line, then the existing service strip.
 *
 * ── WHAT THIS PAGE DOES NOT OWN ──────────────────────────────────────────
 * The announcement bar, navbar and footer come from
 * `src/app/[locale]/layout.tsx` and are untouched here. The service strip is
 * the homepage's own `ServiceBenefits` component, reused verbatim — its four
 * benefits keep the project's approved wording rather than the reference
 * mockup's shipping/payment claims, which this store has never made.
 *
 * ── CONTACT DETAILS ARE STILL CONFIG-ONLY ────────────────────────────────
 * FR-005 forbids inventing placeholder contact values. Both CTAs read the
 * same centrally configured channels every other placement uses
 * (`lib/config/social.ts`) and each renders only when its channel is
 * configured; when neither is, the page says so plainly rather than showing
 * a dead link. The redesign changed the presentation, not this rule.
 *
 * The hero photograph is a Contact-only presentation asset derived from the
 * approved reference itself (`public/images/contact/`) — the same convention
 * the About page uses for its imagery. No Firestore, no remote host.
 *
 * All geometry lives in `contact.module.css`.
 */

/** The hero still-life, cropped from the approved reference's photography area. */
const HERO_IMAGE = "/images/contact/contact-hero.webp";

/**
 * Splits the lede after its opening question so the reference's three-line
 * shape holds — its first line is exactly that question, and the remaining
 * sentences flow beneath it.
 *
 * Punctuation-driven rather than a hard-coded `<br>`, so Arabic breaks at its
 * own "؟" and both locales still reflow freely on a phone. Same approach as
 * the About page's `splitAfterFirstComma`.
 */
function splitAfterFirstQuestion(text: string): [string, string] {
  const match = /[?؟]\s/.exec(text);
  if (!match) return [text, ""];
  const cut = match.index + 1;
  return [text.slice(0, cut), text.slice(cut).trimStart()];
}

/** T218: bilingual title/description, canonical, and hreflang alternates. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, tSeo] = await Promise.all([
    getTranslations({ locale, namespace: "Contact" }),
    getTranslations({ locale, namespace: "Seo" }),
  ]);
  return buildLocalizedMetadata({
    locale: locale as Locale,
    pathname: "/contact",
    title: t("title"),
    description: tSeo("contactDescription"),
  });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });

  const instagramHref = buildInstagramHref();
  const whatsappHref = buildWhatsAppHref(locale);
  const hasAnyChannel = Boolean(instagramHref || whatsappHref);

  const [ledeOpening, ledeRest] = splitAfterFirstQuestion(t("lede"));

  const features = [
    { Icon: MessageCircle, title: t("featureQuickTitle"), body: t("featureQuickBody") },
    { Icon: Heart, title: t("featurePersonalTitle"), body: t("featurePersonalBody") },
    { Icon: Sparkles, title: t("featureServiceTitle"), body: t("featureServiceBody") },
  ];

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        {/* START — the editorial column. First in the DOM, so the phone
            layout stacks copy → CTAs → features → image without any
            order overrides. */}
        <div className={styles.content}>
          <div className={styles.inner}>
            <span className={styles.eyebrow}>{t("eyebrow")}</span>
            <h1 className={styles.heading}>{t("title")}</h1>
            <p className={styles.lede}>
              <span className={styles.ledeOpening}>{ledeOpening}</span>
              {ledeRest ? <span>{ledeRest}</span> : null}
            </p>

            {!hasAnyChannel ? (
              <p className={styles.lede}>{t("noChannelsConfigured")}</p>
            ) : (
              <div className={styles.ctaRow}>
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.cta} ${styles.ctaPrimary}`}
                  >
                    <WhatsAppIcon size={25} className={styles.ctaIcon} />
                    <span className={styles.ctaLabel}>{t("whatsappCta")}</span>
                    <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} className={styles.ctaChevron} />
                  </a>
                ) : null}

                {instagramHref ? (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.cta} ${styles.ctaSecondary}`}
                  >
                    <InstagramIcon size={25} className={styles.ctaIcon} />
                    <span className={styles.ctaLabel}>{t("instagramCta")}</span>
                    <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} className={styles.ctaChevron} />
                  </a>
                ) : null}
              </div>
            )}

            <ul className={styles.features}>
              {features.map(({ Icon, title, body }) => (
                <li key={title} className={styles.feature}>
                  <Icon aria-hidden="true" size={20} strokeWidth={1.3} className={styles.featureIcon} />
                  {/* A plain grouping box below `900px`; from there up it goes
                      `display: contents` so the title and body become rows of
                      the shared feature grid — see `contact.module.css`. */}
                  <div className={styles.featureText}>
                    <p className={styles.featureTitle}>{title}</p>
                    <p className={styles.featureBody}>{body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className={styles.signature}>
              {t("signature")}
              <span aria-hidden="true" className={styles.signatureHeart}>
                ♡
              </span>
            </p>
          </div>
        </div>

        {/* END — the still-life. `sizes` is half the viewport from `lg` up
            and the full width below it, matching the grid exactly. */}
        <div className={styles.media}>
          <Image
            src={HERO_IMAGE}
            alt={t("heroImageAlt")}
            fill
            priority
            sizes="(min-width: 1024px) 47vw, 100vw"
            className={styles.mediaImage}
          />
        </div>
      </section>

      {/* The hero finishes straight into the existing service strip — the
          same component, wording and hairlines the homepage uses, so the
          hand-off into the footer below needs nothing of its own. */}
      <ServiceBenefits locale={locale} />
    </main>
  );
}
