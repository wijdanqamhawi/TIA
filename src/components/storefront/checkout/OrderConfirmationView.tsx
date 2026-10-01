import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Check,
  House,
  MapPin,
  ShoppingBag,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { Badge } from "@/components/ui/Badge";
import { DirectionalIcon } from "@/components/ui/DirectionalIcon";
import { OfferPrice, Price } from "@/components/ui/Price";
import { resolveLocalizedString } from "@/types/localizedString";
import type { Order } from "@/types/order";
import { cn } from "@/lib/utils/cn";
import { ORDER_STATUS_TONE } from "@/lib/ui/orderStatusTone";
import { CHECKOUT_CARD, CHECKOUT_ICON_DISC } from "./checkoutStyles";
import { ProductThumb } from "./ProductThumb";

/**
 * The Order Confirmed page body: a compact centred header, an Order Summary
 * card and an Order Details card, then Continue Shopping. It lays out the
 * STORED order and nothing else:
 *
 *  - every price comes from the order's own snapshot (`unitPrice` — what was
 *    actually charged — `subtotal`, `total`), never from the product's current
 *    price, so an order placed during a Special Offer keeps the price it paid
 *    even after that offer ends or is stopped;
 *  - the crossed-out price and Sale badge appear only when the snapshot itself
 *    says the line was bought on sale (`wasOnSale` with `originalPrice` above
 *    `unitPrice`);
 *  - the delivery region, city and address are the order's delivery snapshot;
 *  - the only live read is each product's photo (orders store no image), passed
 *    in by the page — a deleted product just shows the TIA mark.
 */
export async function OrderConfirmationView({
  order,
  locale,
  thumbnails,
  editable = false,
  justUpdated = false,
}: {
  order: Order;
  locale: string;
  /** Show the Edit Order button (the signed-in owner of a Pending order). */
  editable?: boolean;
  /** Show the "order updated" notice after a successful edit. */
  justUpdated?: boolean;
  /** productId → photo URL (orders store no image); missing entries show the TIA mark. */
  thumbnails: Record<string, string | null>;
}) {
  const [t, tStatus, tCommon, tCart] = await Promise.all([
    getTranslations({ locale, namespace: "OrderConfirmation" }),
    getTranslations({ locale, namespace: "OrderStatus" }),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Cart" }),
  ]);
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const tone = ORDER_STATUS_TONE[order.status];
  const { deliverySnapshot } = order;
  const destination = `${resolveLocalizedString(deliverySnapshot.regionName, locale)} — ${resolveLocalizedString(deliverySnapshot.locationName, locale)}`;

  const details: Array<{ Icon: LucideIcon; label: string; value: React.ReactNode }> = [
    { Icon: Wallet, label: t("paymentMethod"), value: t("cashOnDelivery") },
    {
      Icon: Truck,
      label: t("status"),
      value: (
        <span
          data-testid="order-status"
          data-status={order.status}
          className={cn(
            "inline-flex h-[26px] items-center gap-1.5 rounded-full px-3 text-[0.75rem] leading-none",
            tone.pill,
          )}
        >
          <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
          {tStatus(order.status)}
        </span>
      ),
    },
    { Icon: MapPin, label: t("deliverTo"), value: destination },
    ...(deliverySnapshot.fullAddress
      ? [{ Icon: House, label: t("address"), value: deliverySnapshot.fullAddress }]
      : []),
  ];
  const left = details.slice(0, 2);
  const right = details.slice(2);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-5 pb-14 pt-8 sm:pt-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <span
          aria-hidden="true"
          className="grid size-14 place-items-center rounded-full border border-brand-gold/50 bg-brand-cream text-text-primary"
        >
          <Check className="size-6 stroke-[1.8]" />
        </span>
        <h1 className="mt-1 font-display text-[clamp(1.75rem,3.2vw,2.375rem)] font-normal leading-tight text-text-primary">
          {t("title")}
        </h1>
        <p className="text-[0.9375rem] text-text-secondary">{t("thankYou")}</p>
        <p
          data-testid="order-number-pill"
          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-cream px-4 py-1.5 text-[0.8125rem] text-text-primary"
        >
          {t("orderRef")}{" "}
          <bdi dir="ltr" className="font-medium lining-nums">
            #{order.orderNumber}
          </bdi>
        </p>
      </header>

      {justUpdated ? (
        <p
          role="status"
          data-testid="order-updated-notice"
          className="rounded-lg border border-brand-gold/40 bg-brand-cream px-4 py-2.5 text-center text-[0.875rem] text-text-primary"
        >
          {t("orderUpdated")}
        </p>
      ) : null}

      <section aria-labelledby="confirmation-summary-title" className={CHECKOUT_CARD}>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className={CHECKOUT_ICON_DISC}>
            <ShoppingBag className="size-[17px] stroke-[1.6]" />
          </span>
          <div className="min-w-0">
            <h2
              id="confirmation-summary-title"
              className="font-display text-[1.25rem] leading-tight text-text-primary"
            >
              {t("orderSummary")}
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-text-secondary lining-nums">
              {t("itemsUnits", { items: order.items.length, units })}
            </p>
          </div>
        </div>

        <ul className="mt-4 flex flex-col divide-y divide-hairline border-y border-hairline">
          {order.items.map((item, index) => {
            // The snapshot itself says whether this line was bought on sale.
            const boughtOnSale = item.wasOnSale && item.originalPrice > item.unitPrice;
            const option = item.selectedOption
              ? resolveLocalizedString(item.selectedOption.label, locale)
              : null;
            return (
              <li
                key={`${item.productId}:${item.selectedOption?.optionKey ?? ""}:${index}`}
                data-testid="confirmation-line"
                className="flex items-center gap-3.5 py-3.5"
              >
                <ProductThumb src={thumbnails[item.productId]} />

                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] leading-snug text-text-primary">
                    {resolveLocalizedString(item.productName, locale)}
                  </p>
                  {option ? (
                    <p className="mt-0.5 text-[0.75rem] text-text-secondary">
                      {tCart("option")}: {option}
                    </p>
                  ) : null}
                  {boughtOnSale ? (
                    <p
                      className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"
                      data-testid="confirmation-unit-price"
                    >
                      {/* The prices AT PURCHASE: regular struck through, the price paid, and a Sale badge. */}
                      <OfferPrice
                        price={item.originalPrice}
                        effectivePrice={item.unitPrice}
                        offerStatus="ACTIVE"
                        locale={locale}
                        className="text-[0.8125rem]"
                        originalPriceLabel={tCommon("originalPrice")}
                        salePriceLabel={tCommon("salePrice")}
                      />
                      <Badge variant="gold">{tCommon("onSale")}</Badge>
                    </p>
                  ) : null}
                  <p className="mt-1 text-[0.75rem] text-text-secondary lining-nums">
                    {tCommon("quantity")}: {item.quantity}
                  </p>
                </div>

                {/* `unitPrice` × quantity: the stored, purchase-time line total. */}
                <Price
                  minorUnits={item.unitPrice * item.quantity}
                  locale={locale}
                  className="shrink-0 text-[0.9375rem]"
                />
              </li>
            );
          })}
        </ul>

        <dl className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-[0.875rem]">
            <dt className="text-text-secondary">{t("subtotal")}</dt>
            <dd>
              <Price
                minorUnits={order.subtotal}
                locale={locale}
                className="text-[0.875rem] font-normal"
              />
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-hairline pt-3.5">
            <dt className="font-display text-[1.25rem] leading-none text-text-primary">
              {t("total")}
            </dt>
            <dd>
              <Price minorUnits={order.total} locale={locale} className="text-[1.25rem]" />
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="confirmation-details-title" className={CHECKOUT_CARD}>
        <div className="flex items-center gap-3 border-b border-hairline pb-4">
          <span aria-hidden="true" className={CHECKOUT_ICON_DISC}>
            <MapPin className="size-[17px] stroke-[1.6]" />
          </span>
          <div className="min-w-0">
            <h2
              id="confirmation-details-title"
              className="font-display text-[1.25rem] leading-tight text-text-primary"
            >
              {t("orderDetails")}
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-text-secondary">{t("orderDetailsHint")}</p>
          </div>
        </div>

        {/* Two columns from `md`, one below — and the divider is on the logical start edge, so it mirrors. */}
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
          <DetailColumn items={left} />
          <DetailColumn items={right} className="md:border-s md:border-hairline md:ps-8" />
        </div>
      </section>

      <div className="mt-1 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        {editable ? (
          <Link
            href={`/account/orders/${order.orderNumber}/edit`}
            data-testid="edit-order-link"
            className="inline-flex h-[46px] items-center justify-center rounded-lg border border-brand-burgundy bg-white px-8 text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-brand-burgundy outline-none transition-colors hover:bg-brand-cream focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 rtl:text-[0.875rem] rtl:normal-case rtl:tracking-normal"
          >
            {t("editOrder")}
          </Link>
        ) : null}
        <Link
          href="/shop"
          className="group inline-flex h-[46px] items-center justify-center gap-2.5 rounded-lg bg-brand-burgundy px-8 text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-text-on-dark shadow-[0_10px_22px_-14px_rgba(16,28,54,0.75)] outline-none transition-colors hover:bg-brand-burgundy-light focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 rtl:text-[0.875rem] rtl:normal-case rtl:tracking-normal"
        >
          {t("continueShopping")}
          <DirectionalIcon
            icon={ArrowRight}
            aria-hidden="true"
            className="size-4 stroke-[1.8] transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </div>
  );
}

function DetailColumn({
  items,
  className,
}: {
  items: Array<{ Icon: LucideIcon; label: string; value: React.ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn("flex min-w-0 flex-col gap-4", className)}>
      {items.map(({ Icon, label, value }) => (
        <div key={label} className="flex items-start gap-3">
          <span aria-hidden="true" className={CHECKOUT_ICON_DISC}>
            <Icon className="size-[17px] stroke-[1.6]" />
          </span>
          <div className="min-w-0">
            <dt className="text-[0.8125rem] text-text-secondary">{label}</dt>
            <dd className="mt-0.5 break-words text-[0.875rem] leading-snug text-text-primary">
              {value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
