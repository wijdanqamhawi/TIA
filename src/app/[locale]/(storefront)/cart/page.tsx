import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { CartLineItem } from "@/components/storefront/CartLineItem";
import { CartEmptyState } from "@/components/storefront/CartEmptyState";
import { getCartForDisplay, buildCartSummary } from "@/lib/domain/cart/cart.service";

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
    <main className="container-luxury py-10">
      <h1 className="mb-6 text-center font-display text-3xl text-text-primary">{t("title")}</h1>

      {summary.isEmpty ? (
        <CartEmptyState locale={locale} />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {summary.hasIssues ? (
              <p role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
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

          <div className="flex flex-col gap-4 rounded-lg border border-border-luxury bg-brand-ivory p-6">
            <div className="flex items-center justify-between text-sm text-text-primary">
              <span>{t("subtotal")}</span>
              <Price minorUnits={summary.subtotal} locale={locale} />
            </div>
            <div className="flex items-center justify-between border-t border-border-luxury pt-4 text-base font-semibold text-text-primary">
              <span>{t("total")}</span>
              <Price minorUnits={summary.total} locale={locale} className="text-lg" />
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
