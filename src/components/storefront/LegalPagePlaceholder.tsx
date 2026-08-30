import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

/**
 * Shared shell for the four legal routes (T215): Shipping & Delivery,
 * Returns & Exchange, Privacy Policy, Terms & Conditions.
 *
 * The task is explicit that this content must be "clearly-marked
 * placeholder content pending store-provided legal text — never invented
 * policy text." Rather than writing plausible-sounding fake clauses, every
 * one of these pages renders only its title and a visibly distinct notice
 * stating the real text is pending — so a route existing (satisfying
 * plan.md's Project Structure, remediation finding F4, and every footer
 * link resolving) can never be mistaken for the store's actual published
 * policy.
 */
export async function LegalPagePlaceholder({ locale, title }: { locale: string; title: string }) {
  const t = await getTranslations({ locale, namespace: "Legal" });

  return (
    <main className="container-luxury py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-center font-display text-3xl text-text-primary">{title}</h1>

        <div className="mt-8 rounded-lg border-2 border-dashed border-brand-gold bg-brand-ivory p-6 text-center">
          <p className="font-display text-lg text-brand-burgundy">{t("pendingNoticeTitle")}</p>
          <p className="mt-2 text-sm text-text-primary/80">{t("pendingNoticeBody")}</p>
          <Link
            href="/contact"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-border-luxury px-6 py-2.5 font-medium text-text-primary transition-colors hover:bg-brand-beige"
          >
            {t("contactCta")}
          </Link>
        </div>
      </div>
    </main>
  );
}
