import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { isOrderEditable } from "@/lib/domain/orders/order-edit-rules";
import type { Order } from "@/types/order";
import type { DeliveryRegionId } from "@/types/deliveryRegion";
import type { LocalizedString } from "@/types/localizedString";
import { CHECKOUT_CARD } from "./checkoutStyles";
import { OrderEditForm, type OrderEditLine, type OrderEditLocation } from "./OrderEditForm";

/**
 * The Edit Order page body: a compact header (title + the real order number) and the edit form — or,
 * when the order's status no longer allows editing, a short explanation instead of the form. The
 * server action re-checks the status regardless; this is only what the customer sees.
 *
 * `stockByProduct` is the current stock per product (a hint for the quantity limit); prices are the
 * order's stored ones.
 */
export async function OrderEditView({
  order,
  locale,
  thumbnails,
  stockByProduct,
  regions,
  locationsByRegion,
}: {
  order: Order;
  locale: string;
  thumbnails: Record<string, string | null>;
  /** productId → units in stock right now; a missing/unavailable product has no entry. */
  stockByProduct: Record<string, number>;
  regions: Array<{ id: DeliveryRegionId; name: LocalizedString }>;
  locationsByRegion: Record<string, OrderEditLocation[]>;
}) {
  const [t, tConfirmation] = await Promise.all([
    getTranslations({ locale, namespace: "OrderEdit" }),
    getTranslations({ locale, namespace: "OrderConfirmation" }),
  ]);

  const lines: OrderEditLine[] = order.items.map((item) => ({
    productId: item.productId,
    optionKey: item.selectedOption?.optionKey ?? null,
    valueKey: item.selectedOption?.valueKey ?? null,
    name: item.productName,
    optionLabel: item.selectedOption?.label ?? null,
    thumbnail: thumbnails[item.productId] ?? null,
    unitPrice: item.unitPrice,
    originalPrice: item.originalPrice,
    wasOnSale: item.wasOnSale,
    quantity: item.quantity,
    maxQuantity: item.quantity + (stockByProduct[item.productId] ?? 0),
  }));

  return (
    <div className="flex flex-col gap-5">
      <header className="mx-auto flex max-w-xl flex-col items-center gap-2 px-5 pt-8 text-center sm:pt-10">
        <h1 className="font-display text-[clamp(1.75rem,3.2vw,2.375rem)] font-normal leading-tight text-text-primary">
          {t("title")}
        </h1>
        <span aria-hidden="true" className="block h-px w-10 bg-brand-gold/60" />
        <p
          data-testid="order-number-pill"
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-cream px-4 py-1.5 text-[0.8125rem] text-text-primary"
        >
          {tConfirmation("orderRef")}{" "}
          <bdi dir="ltr" className="font-medium lining-nums">
            #{order.orderNumber}
          </bdi>
        </p>
      </header>

      {isOrderEditable(order.status) ? (
        <OrderEditForm
          locale={locale}
          orderNumber={order.orderNumber}
          lines={lines}
          phone={order.customerSnapshot.phone}
          regionId={order.deliverySnapshot.regionId}
          locationId={order.deliverySnapshot.locationId}
          fullAddress={order.deliverySnapshot.fullAddress}
          notes={order.notes ?? ""}
          regions={regions}
          locationsByRegion={locationsByRegion}
        />
      ) : (
        <div className="mx-auto w-full max-w-[720px] px-5 pb-14">
          <section data-testid="not-editable" className={`${CHECKOUT_CARD} text-center`}>
            <h2 className="font-display text-[1.25rem] text-text-primary">
              {t("notEditableTitle")}
            </h2>
            <p className="mt-2 text-[0.875rem] text-text-secondary">{t("errors.notEditable")}</p>
            <Link
              href={`/order-confirmation/${order.orderNumber}`}
              className="mt-5 inline-flex h-[46px] items-center justify-center rounded-lg bg-brand-burgundy px-8 text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-text-on-dark hover:bg-brand-burgundy-light rtl:text-[0.875rem] rtl:normal-case rtl:tracking-normal"
            >
              {t("backToOrder")}
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}
