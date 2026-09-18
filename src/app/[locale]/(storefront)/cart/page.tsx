import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { CartLineItem } from "@/components/storefront/CartLineItem";
import { CartEmptyState } from "@/components/storefront/CartEmptyState";
import { getCartForDisplay, buildCartSummary } from "@/lib/domain/cart/cart.service";
import { PageHeading } from "@/components/ui/PageHeading";

// Reads the caller's live cart + current product pricing/stock on every
// request (Constitution Principle 7/9/10) — never statically cached.
export const dynamic = "force-dynamic";

/**
 * The `/[locale]/cart` page (spec: line items, quantity controls,
 * subtotal/total, continue shopping, proceed to checkout). Every price
 * shown is read live from Firestore — the cart document itself never
 * stores a price (spec "Price Security").
 */
export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Cart" });

  const cart = await getCartForDisplay();
  const summary = cart ? await buildCartSummary(cart) : { lines: [], subtotal: 0, total: 0, hasIssues: false, isEmpty: true };

  return (
    <main className="container-luxury py-14 sm:py-20">
      <PageHeading title={t("title")} className="mb-10 sm:mb-14" />

      {summary.isEmpty ? (
        <CartEmptyState locale={locale} />
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-12">
          <div className="lg:col-span-2">
            {summary.hasIssues ? (
              <p role="alert" className="mb-6 rounded-xl border border-red-300 bg-red-50/80 p-4 text-sm text-red-800">
                {t("hasIssuesWarning")}
              </p>
            ) : null}
            <div>
              {summary.lines.map((line) => (
                <CartLineItem
                  key={`${line.productId}:${line.selectedOption?.optionKey ?? ""}:${line.selectedOption?.valueKey ?? ""}`}
                  line={line}
                  locale={locale}
                />
              ))}
            </div>
            <div className="mt-4">
              <Link href="/shop">
                <Button type="button" variant="outline">
                  {t("continueShopping")}
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex h-fit flex-col gap-4 rounded-2xl border border-hairline bg-brand-cream/50 p-6 shadow-elev-1 sm:p-7 lg:sticky lg:top-28">
            <div className="flex items-center justify-between text-sm text-text-primary/70">
              <span>{t("subtotal")}</span>
              <Price minorUnits={summary.subtotal} locale={locale} className="text-text-primary" />
            </div>
            <div className="flex items-center justify-between border-t border-hairline pt-4 text-base font-semibold text-text-primary">
              <span>{t("total")}</span>
              <Price minorUnits={summary.total} locale={locale} className="text-xl" />
            </div>
            {summary.hasIssues ? (
              <Button type="button" disabled className="w-full">
                {t("proceedToCheckout")}
              </Button>
            ) : (
              <Link href="/checkout">
                <Button type="button" className="w-full">
                  {t("proceedToCheckout")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
