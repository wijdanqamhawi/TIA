import { getTranslations } from "next-intl/server";
import { Gem, PackageCheck, ShieldCheck, ShoppingBag, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import { resolveLocalizedString } from "@/types/localizedString";
import type { CartSummary } from "@/lib/domain/cart/cart.service";
import { CHECKOUT_CARD as CARD, CHECKOUT_ICON_DISC as ICON_DISC } from "./checkoutStyles";
import { ProductThumb } from "./ProductThumb";

/**
 * The right-hand column of the Checkout page: the Order Summary and a small
 * reassurance card. It renders the summary `buildCartSummary` already
 * computed — every line total, the subtotal and the total are that shared
 * function's numbers (live effective prices, so an ACTIVE Special Offer is
 * already applied); nothing is recalculated or re-priced here. The order model
 * has no shipping, tax or discount, so there is no such row.
 *
 * The reassurance rows reuse the storefront's existing trust copy (the
 * homepage "Why TIA" strip) — no new promises are introduced.
 */
export async function CheckoutSummary({
  summary,
  locale,
}: {
  summary: CartSummary;
  locale: string;
}) {
  const [t, tCommon, tCart, tHome] = await Promise.all([
    getTranslations({ locale, namespace: "Checkout" }),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Cart" }),
    getTranslations({ locale, namespace: "Home" }),
  ]);
  const unitCount = summary.lines.reduce((sum, line) => sum + line.quantity, 0);

  const reasons: Array<{ Icon: LucideIcon; title: string; body: string }> = [
    { Icon: Gem, title: tHome("benefitQualityTitle"), body: tHome("benefitQualityBody") },
    { Icon: ShieldCheck, title: tHome("benefitSecureTitle"), body: tHome("benefitSecureBody") },
    { Icon: PackageCheck, title: tHome("benefitReturnsTitle"), body: tHome("benefitReturnsBody") },
  ];

  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
      <section aria-labelledby="checkout-summary-title" className={CARD}>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className={ICON_DISC}>
            <ShoppingBag className="size-[17px] stroke-[1.6]" />
          </span>
          <h2
            id="checkout-summary-title"
            className="font-display text-[1.25rem] leading-tight text-text-primary"
          >
            {t("orderSummary")}
          </h2>
          <span className="ms-auto text-[0.8125rem] text-text-secondary lining-nums">
            {t("itemCount", { count: unitCount })}
          </span>
        </div>

        <ul className="mt-4 flex flex-col divide-y divide-hairline border-y border-hairline">
          {summary.lines.map((line) => {
            const product = line.product;
            const name = product ? resolveLocalizedString(product.name, locale) : "";
            const option = product?.optionLabel
              ? resolveLocalizedString(product.optionLabel, locale)
              : null;
            const image = product?.image?.url ?? null;
            return (
              <li
                key={`${line.productId}:${line.selectedOption?.optionKey ?? ""}:${line.selectedOption?.valueKey ?? ""}`}
                data-testid="checkout-line"
                className="flex items-center gap-3.5 py-3.5"
              >
                <ProductThumb src={image} />

                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] leading-snug text-text-primary">{name}</p>
                  {option ? (
                    <p className="mt-0.5 text-[0.75rem] text-text-secondary">
                      {tCart("option")}: {option}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[0.75rem] text-text-secondary lining-nums">
                    {tCommon("quantity")}: {line.quantity}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  {/* `lineTotal` is the shared effective price × quantity — the sale price while an offer is ACTIVE. */}
                  <Price minorUnits={line.lineTotal} locale={locale} className="text-[0.875rem]" />
                  {product?.offerStatus === "ACTIVE" ? (
                    <Badge variant="gold">{tCommon("onSale")}</Badge>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <dl className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-[0.875rem] text-text-primary">
            <dt className="text-text-secondary">{t("subtotal")}</dt>
            <dd>
              <Price minorUnits={summary.subtotal} locale={locale} className="text-[0.875rem]" />
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-hairline pt-3.5">
            <dt className="font-display text-[1.25rem] leading-none text-text-primary">
              {t("total")}
            </dt>
            <dd>
              <Price minorUnits={summary.total} locale={locale} className="text-[1.25rem]" />
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="checkout-why-title" className={CARD}>
        <h2
          id="checkout-why-title"
          className="font-display text-[1.125rem] leading-tight text-text-primary"
        >
          {t("whyTitle")}
        </h2>
        <ul className="mt-3.5 flex flex-col gap-3">
          {reasons.map(({ Icon, title, body }) => (
            <li key={title} className="flex items-center gap-3">
              <span aria-hidden="true" className={ICON_DISC}>
                <Icon className="size-[17px] stroke-[1.6]" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.8125rem] font-medium leading-snug text-text-primary">
                  {title}
                </p>
                <p className="text-[0.75rem] leading-snug text-text-secondary">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
