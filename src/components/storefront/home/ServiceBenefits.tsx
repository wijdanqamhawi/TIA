import { getTranslations } from "next-intl/server";
import { Gem, Truck, Wallet, PackageCheck } from "lucide-react";

/**
 * The trust strip — one compact horizontal band directly beneath the hero,
 * as in the approved reference: four equal columns, each a champagne outline
 * icon beside a two-line stack (navy title, small slate description),
 * divided by thin hairlines.
 *
 * Deliberately the shortest band on the page (~60px on desktop): its job is
 * to bridge the cinematic hero and the New Arrivals row without ever reading
 * as a content block of its own.
 *
 * Gold appears only as the icon stroke — never as text, which at 2.3:1 on
 * this ground could not carry it — so both copy lines stay navy and slate.
 *
 * Presentation only: the same four translations, unchanged in meaning.
 */
export async function ServiceBenefits({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Home" });

  const items = [
    { Icon: Gem, title: t("benefitQualityTitle"), body: t("benefitQualityBody") },
    { Icon: Truck, title: t("benefitDesignTitle"), body: t("benefitDesignBody") },
    { Icon: Wallet, title: t("benefitSecureTitle"), body: t("benefitSecureBody") },
    { Icon: PackageCheck, title: t("benefitReturnsTitle"), body: t("benefitReturnsBody") },
  ];

  return (
    <section aria-label={t("benefitsLabel")} className="border-b border-hairline bg-brand-ivory text-text-primary">
      <div className="container-luxury">
        <ul className="grid grid-cols-2 lg:grid-cols-4">
          {items.map(({ Icon, title, body }, index) => (
            <li
              key={title}
              className={[
                "flex items-center gap-3 px-2 py-4 text-start sm:px-4 lg:justify-center lg:py-5",
                index % 2 === 1 ? "border-s border-hairline" : "",
                index > 1 ? "border-t border-hairline lg:border-t-0" : "",
                index > 0 ? "lg:border-s lg:border-hairline" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Icon aria-hidden="true" size={22} strokeWidth={1.1} className="shrink-0 text-brand-gold sm:size-6" />
              <div className="flex min-w-0 flex-col">
                <p className="text-[0.8125rem] font-medium leading-tight text-text-primary sm:text-[0.875rem]">
                  {title}
                </p>
                <p className="text-[0.625rem] leading-tight text-text-secondary sm:text-[0.6875rem]">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
