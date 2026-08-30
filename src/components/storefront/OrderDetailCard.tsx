import { getTranslations } from "next-intl/server";
import { resolveLocalizedString } from "@/types/localizedString";
import { Price } from "@/components/ui/Price";
import type { Order } from "@/types/order";

/**
 * The order-detail card (order number, items, total, payment method,
 * current localized status, delivery region/city) shared by the guest/
 * registered order-confirmation page (T126) and the account order-detail
 * page (T138) — one rendering, reused, so the two can never drift apart
 * (this task's explicit "current localized order status" and "purchase-
 * time prices from OrderItem snapshots" requirements apply identically to
 * both).
 */
export async function OrderDetailCard({ order, locale }: { order: Order; locale: string }) {
  const t = await getTranslations({ locale, namespace: "OrderConfirmation" });
  const tStatus = await getTranslations({ locale, namespace: "OrderStatus" });

  return (
    <div className="rounded-lg border border-border-luxury bg-brand-ivory p-6">
      <div className="flex items-center justify-between border-b border-border-luxury pb-4">
        <span className="text-sm text-text-primary/70">{t("orderNumber")}</span>
        <span className="font-semibold text-text-primary" dir="ltr">
          {order.orderNumber}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <h2 className="font-medium text-text-primary">{t("items")}</h2>
        {order.items.map((item, index) => (
          <div
            key={`${item.productId}:${item.selectedOption?.optionKey ?? ""}:${index}`}
            className="flex items-center justify-between gap-2 text-sm text-text-primary"
          >
            <span className="flex-1">
              {resolveLocalizedString(item.productName, locale)}
              {item.selectedOption ? ` — ${resolveLocalizedString(item.selectedOption.label, locale)}` : ""} ×{" "}
              {item.quantity}
            </span>
            {/* `unitPrice` is the immutable purchase-time price from the OrderItem snapshot — never a live product re-lookup. */}
            <Price minorUnits={item.unitPrice * item.quantity} locale={locale} className="text-sm" />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border-luxury pt-4 text-base font-semibold text-text-primary">
        <span>{t("total")}</span>
        <Price minorUnits={order.total} locale={locale} className="text-lg" />
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-border-luxury pt-4 text-sm text-text-primary">
        <div className="flex justify-between">
          <span>{t("paymentMethod")}</span>
          <span>{t("cashOnDelivery")}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("status")}</span>
          <span>{tStatus(order.status)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>{t("deliverTo")}</span>
          <span className="text-end">
            {resolveLocalizedString(order.deliverySnapshot.regionName, locale)} —{" "}
            {resolveLocalizedString(order.deliverySnapshot.locationName, locale)}
          </span>
        </div>
      </div>
    </div>
  );
}
