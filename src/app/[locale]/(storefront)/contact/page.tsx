import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/SocialIcons";
import { buildInstagramHref, buildWhatsAppHref } from "@/lib/config/social";
import { buildLocalizedMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/lib/i18n/routing";

// Unlike the icon-only Navbar/Footer/floating placements, these CTAs
// already carry clear, self-descriptive visible text ("Chat with us on
// WhatsApp") — an `aria-label` here would *override* that text as the
// accessible name rather than supplement it (WCAG 2.5.3 "Label in Name"),
// making the visible and accessible names diverge for no benefit.

/**
 * The `/[locale]/contact` page (T214, spec FR-005): the store's contact
 * details and channels. FR-005 explicitly forbids inventing placeholder
 * contact values — this page shows only the same real, centrally
 * configured Instagram/WhatsApp channels every other placement in the app
 * reads (T202/lib/config/social.ts), never a fabricated email, phone, or
 * address. When neither is configured yet, it says so plainly instead of
 * rendering a dead link (mirrors T208's fail-safe pattern).
 */
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

  return (
    <main className="container-luxury py-10">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="font-display text-3xl text-text-primary">{t("title")}</h1>
        <p className="mt-3 text-text-primary/80">{t("intro")}</p>
      </div>

      <div className="mx-auto mt-10 flex max-w-md flex-col gap-4">
        <h2 className="text-center font-display text-xl text-brand-burgundy">{t("channelsHeading")}</h2>

        {!hasAnyChannel ? (
          <p className="rounded-lg border border-border-luxury bg-brand-ivory p-6 text-center text-sm text-text-primary/70">
            {t("noChannelsConfigured")}
          </p>
        ) : (
          <>
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center justify-center gap-3 rounded-md bg-brand-burgundy px-6 py-3 font-medium text-brand-gold transition-colors hover:bg-brand-burgundy-dark"
              >
                <WhatsAppIcon size={22} /> {t("whatsappCta")}
              </a>
            ) : null}
            {instagramHref ? (
              <a
                href={instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center justify-center gap-3 rounded-md border border-border-luxury px-6 py-3 font-medium text-text-primary transition-colors hover:bg-brand-beige"
              >
                <InstagramIcon size={22} /> {t("instagramCta")}
              </a>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
