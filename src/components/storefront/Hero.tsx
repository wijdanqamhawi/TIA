import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Logo } from "@/components/ui/Logo";

/** The homepage Hero section (spec FR-001): logo, headline, tagline, "Shop Now" CTA. */
export async function Hero({ locale }: { locale: string }) {
  const tHome = await getTranslations({ locale, namespace: "Home" });

  return (
    <section className="border-b border-border-luxury bg-brand-cream py-16 text-center sm:py-24">
      <div className="container-luxury flex flex-col items-center gap-6">
        <Logo locale={locale} priority />
        <h1 className="font-display text-3xl text-brand-burgundy sm:text-4xl md:text-5xl">
          ELORA JEWELLERY
        </h1>
        <p className="max-w-xl text-base text-text-primary/80 sm:text-lg">{tHome("heroTagline")}</p>
        <Link
          href="/shop"
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md bg-brand-burgundy px-6 py-3 text-base font-semibold text-text-on-dark transition-colors hover:bg-brand-burgundy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
        >
          {tHome("heroCta")}
        </Link>
      </div>
    </section>
  );
}
