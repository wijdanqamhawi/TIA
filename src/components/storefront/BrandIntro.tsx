import { getTranslations } from "next-intl/server";

/** The homepage brand introduction section (spec FR-001). */
export async function BrandIntro({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <section className="border-t border-border-luxury bg-brand-beige py-14 text-center sm:py-20">
      <div className="container-luxury mx-auto max-w-2xl">
        <h2 className="font-display text-2xl text-brand-burgundy sm:text-3xl">{t("brandTitle")}</h2>
        <p className="mt-4 text-base text-text-primary/80 sm:text-lg">{t("brandBody")}</p>
      </div>
    </section>
  );
}
