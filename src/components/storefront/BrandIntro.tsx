import { getTranslations } from "next-intl/server";

/** The homepage brand introduction section (spec FR-001). */
export async function BrandIntro({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <section className="relative isolate overflow-hidden border-t border-hairline bg-brand-ivory section-y text-center">
      {/* Two soft gold blooms in opposite corners give the closing section
          depth without adding a single image request. Decorative only, and
          fully contained by `inset-0` + `overflow-hidden`, so neither can
          introduce horizontal overflow at any breakpoint. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 [background:radial-gradient(55%_60%_at_50%_0%,rgba(196,164,107,0.10),transparent_70%)]"
      />
      <div className="container-luxury mx-auto flex max-w-2xl flex-col items-center gap-5">
        <hr className="rule-champagne" aria-hidden="true" />
        <h2 className="font-display text-3xl font-light text-text-primary sm:text-4xl md:text-[2.75rem]">{t("brandTitle")}</h2>
        <p className="text-base leading-relaxed text-text-primary/75 sm:text-lg">{t("brandBody")}</p>
      </div>
    </section>
  );
}
