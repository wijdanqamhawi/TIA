import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

/**
 * "Join the TIA Circle" — the reference's newsletter strip on the cool-pearl
 * ground: the heading and one supporting line on the start side, an email
 * field and a navy Subscribe button on the end side.
 *
 * ── PRESENTATION ONLY ────────────────────────────────────────────────────
 * This store has no newsletter backend, and inventing one (a Server Action,
 * a mailing-list provider, a Firestore collection of addresses) would be
 * building unrequested functionality — and would quietly collect real email
 * addresses with nowhere to send them. So the field and button are rendered
 * exactly as designed but are **not wired to anything**: there is no form
 * element, no action, and no submit handler.
 *
 * Both controls are marked `disabled`, which is the honest state for a
 * control that cannot do its job: it keeps them out of the tab order and
 * tells assistive technology they are unavailable, rather than presenting a
 * working-looking field that silently discards what a customer types.
 *
 * To make it live: add the Server Action, drop the `disabled` attributes,
 * and wrap the two controls in a `<form>`.
 */
export async function NewsletterStrip({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <section aria-labelledby="newsletter-heading" className="bg-brand-ivory py-2">
      <div className="container-wide">
        <div className="flex flex-col items-center gap-5 bg-brand-cream px-6 py-6 text-center lg:flex-row lg:justify-between lg:gap-10 lg:px-12 lg:py-4 lg:text-start">
          <div className="flex flex-col gap-1">
            <h2 id="newsletter-heading" className="font-display text-[clamp(1.125rem,1.5vw,1.375rem)] font-normal leading-tight text-text-primary">
              {t("newsletterTitle")}
            </h2>
            <p className="text-xs leading-relaxed text-text-secondary">{t("newsletterBody")}</p>
          </div>

          <div className="flex w-full max-w-md items-stretch gap-2.5 lg:w-auto">
            <input
              type="email"
              disabled
              aria-describedby="newsletter-unavailable"
              placeholder={t("newsletterPlaceholder")}
              className="min-h-10 w-full min-w-0 border border-hairline-strong bg-brand-ivory px-3.5 text-xs text-text-primary placeholder:text-text-secondary disabled:cursor-not-allowed lg:w-64"
            />
            <button
              type="button"
              disabled
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 bg-brand-burgundy px-5 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-text-on-dark disabled:cursor-not-allowed rtl:text-xs rtl:normal-case rtl:tracking-normal"
            >
              {t("newsletterCta")}
              <ArrowRight aria-hidden="true" size={12} className="rtl:-scale-x-100" />
            </button>
          </div>
          <p id="newsletter-unavailable" className="sr-only">
            {t("newsletterUnavailable")}
          </p>
        </div>
      </div>
    </section>
  );
}
