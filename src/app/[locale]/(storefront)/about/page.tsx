import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { buildLocalizedMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/lib/i18n/routing";

/**
 * The `/[locale]/about` page (T213, spec FR-004): brand concept and
 * identity content. Unlike the Contact page and the legal pages, FR-004
 * carries no "store-provided only" restriction — this is genuine
 * brand-voice copy in the same tone already established for `Home.
 * brandBody`, never a factual/legal claim (no invented founding dates,
 * physical address, or named personnel).
 *
 * Purely static content with no live Firestore read, so this page is
 * prerendered per locale like every other content-only route.
 */
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

  return (
    <main className="container-luxury py-10">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-3xl text-text-primary">{t("title")}</h1>
        <p className="mt-3 text-lg text-brand-burgundy">{t("heroTagline")}</p>
      </div>

      <div className="mx-auto mt-10 flex max-w-2xl flex-col gap-8 text-text-primary">
        <section>
          <h2 className="font-display text-xl text-brand-burgundy">{t("storyHeading")}</h2>
          <p className="mt-2 leading-relaxed text-text-primary/80">{t("storyBody")}</p>
        </section>
        <section>
          <h2 className="font-display text-xl text-brand-burgundy">{t("valuesHeading")}</h2>
          <p className="mt-2 leading-relaxed text-text-primary/80">{t("valuesBody")}</p>
        </section>
        <section>
          <h2 className="font-display text-xl text-brand-burgundy">{t("closingHeading")}</h2>
          <p className="mt-2 leading-relaxed text-text-primary/80">{t("closingBody")}</p>
        </section>
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-burgundy px-6 py-2.5 font-medium text-text-on-dark transition-colors hover:bg-brand-burgundy-dark"
        >
          {tNav("contact")}
        </Link>
      </div>
    </main>
  );
}
