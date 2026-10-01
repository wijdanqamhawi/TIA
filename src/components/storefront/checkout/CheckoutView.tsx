import { getTranslations } from "next-intl/server";
import type { DeliveryRegionId } from "@/types/deliveryRegion";
import type { CartSummary } from "@/lib/domain/cart/cart.service";
import { CheckoutForm, type CheckoutRegionOption } from "@/components/storefront/CheckoutForm";
import type { LocationOption } from "@/components/storefront/LocationSelectorDialog";
import { CheckoutSummary } from "./CheckoutSummary";

/**
 * The Checkout page's presentation (header, form card and summary column),
 * separate from the page's data loading so the layout can be rendered and
 * tested on its own. Desktop: the form card (~65%) beside the order summary
 * (~35%); one column below `lg`. Everything it shows is passed in.
 */
export async function CheckoutView({
  locale,
  summary,
  regionOptions,
  prefill,
  prefillLocation,
  locationsByRegionForDialog,
}: {
  locale: string;
  summary: CartSummary;
  regionOptions: CheckoutRegionOption[];
  prefill: { fullName: string; email: string; phone: string };
  prefillLocation?: { regionId: DeliveryRegionId; locationId: string } | null;
  locationsByRegionForDialog: Record<string, LocationOption[]>;
}) {
  const t = await getTranslations({ locale, namespace: "Checkout" });

  return (
    <main className="bg-brand-ivory pb-14 sm:pb-16">
      {/* A compact header: a refined title, one quiet line and a small gold rule — never a tall banner. */}
      <header className="mx-auto flex max-w-xl flex-col items-center gap-2 px-5 pb-7 pt-8 text-center sm:pb-8 sm:pt-10">
        <h1 className="font-display text-[clamp(1.875rem,3.2vw,2.5rem)] font-normal leading-tight text-text-primary">
          {t("title")}
        </h1>
        <span aria-hidden="true" className="block h-px w-10 bg-brand-gold/60" />
        <p className="text-[0.75rem] uppercase tracking-[0.22em] text-text-secondary rtl:text-[0.875rem] rtl:normal-case rtl:tracking-normal">
          {t("subtitle")}
        </p>
      </header>

      {/* Desktop: the form card (~65%) beside the order summary (~35%); one column below `lg`. */}
      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-5 px-5 sm:px-6 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:gap-6">
        <CheckoutForm
          locale={locale}
          regions={regionOptions}
          prefill={prefill}
          prefillLocation={prefillLocation}
          locationsByRegionForDialog={locationsByRegionForDialog}
        />
        <CheckoutSummary summary={summary} locale={locale} />
      </div>
    </main>
  );
}
