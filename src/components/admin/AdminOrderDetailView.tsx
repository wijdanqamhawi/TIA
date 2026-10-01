import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Clock,
  FileText,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingCart,
  StickyNote,
  Truck,
  User,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import { resolveLocalizedString } from "@/types/localizedString";
import type { Order } from "@/types/order";
import { Badge } from "@/components/ui/Badge";
import { DirectionalIcon } from "@/components/ui/DirectionalIcon";
import { StatCard } from "@/components/admin/StatCard";
import {
  OrderStatusBadge,
  OrderStatusControl,
  OrderStatusProvider,
  OrderTimeline,
} from "@/components/admin/AdminOrderStatus";
import { ProductThumb } from "@/components/storefront/checkout/ProductThumb";

export type OrderDetailTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

const SURFACE =
  "overflow-hidden rounded-[10px] border border-brand-gold/[0.16] bg-white shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)]";
const ICON_DISC =
  "grid size-8 shrink-0 place-items-center rounded-full bg-brand-cream text-brand-gold-ink";
const SMALL_CAPS =
  "text-[11.5px] font-semibold uppercase tracking-[0.12em] text-text-secondary rtl:text-[12.5px] rtl:normal-case rtl:tracking-normal";
/** The items table's columns (from `md`): thumbnail | product | option | qty | unit price | total. */
const COLUMNS =
  "md:grid-cols-[64px_minmax(0,2.2fr)_minmax(0,1fr)_48px_minmax(0,1.2fr)_minmax(0,1fr)]";

/** A card with the reference's tinted title strip: a thin gold icon, a serif title, a hairline beneath. */
function Card({
  id,
  icon: Icon,
  title,
  className,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn(SURFACE, className)}>
      <div className="flex items-center gap-3 border-b border-brand-burgundy/[0.07] bg-[#fbf8f1] px-5 py-3.5">
        <Icon aria-hidden="true" className="size-5 shrink-0 stroke-[1.5] text-brand-gold-ink" />
        <h2 id={id} className="font-display text-[19px] leading-tight text-brand-burgundy">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/**
 * Admin — Order Details. Header (back link, order number, placed time, the clickable status pill), four
 * summary cards, then two columns: Order Items + Order Information beside Customer & Delivery + Order
 * Timeline.
 *
 * Everything shown is the STORED order — each line's `unitPrice`, `originalPrice`, `wasOnSale`, name and
 * option label, plus `subtotal`, `total` and the customer / delivery snapshots — so an old order never
 * changes when a product's price changes or the product is deleted. The only live read is each
 * product's photo (orders store no image), handed in by the page; a deleted product shows the TIA mark.
 * The status pill reuses the Admin > Orders control and its protected transition flow.
 *
 * The Order Timeline is progress derived from the current status plus the one time an order records
 * (its placement) — see `order-timeline.ts`. There is no status history to show, so none is invented.
 */
export function AdminOrderDetailView({
  t,
  locale,
  order,
  thumbnails,
}: {
  t: OrderDetailTranslate;
  locale: "en" | "ar";
  order: Order;
  /** productId → photo URL; a missing entry (deleted product) shows the fallback mark. */
  thumbnails: Record<string, string | null>;
}) {
  const money = (minor: number) => formatCurrency(minor, locale === "ar" ? "ar" : "en-US");
  const placed = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hebron",
  }).format(order.createdAt.toDate());
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const { customerSnapshot: customer, deliverySnapshot: delivery } = order;
  const destination = `${resolveLocalizedString(delivery.regionName, locale)} — ${resolveLocalizedString(delivery.locationName, locale)}`;

  return (
    <OrderStatusProvider orderId={order.id} status={order.status}>
      <div className="flex flex-col gap-4">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pt-1">
          <div className="min-w-0">
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary outline-none transition-colors hover:text-brand-burgundy focus-visible:ring-2 focus-visible:ring-brand-gold/50"
            >
              <DirectionalIcon
                icon={ArrowLeft}
                aria-hidden="true"
                className="size-3.5 stroke-[1.8]"
              />
              {t("detail.back")}
            </Link>
            <h1 className="mt-1.5 font-display text-[30px] font-normal leading-[1.1] text-brand-burgundy lg:text-[34px] rtl:text-[26px] rtl:leading-[1.4] rtl:lg:text-[30px]">
              {t("detail.orderLabel")}{" "}
              <bdi dir="ltr" className="lining-nums">
                {order.orderNumber}
              </bdi>
            </h1>
            <p className="mt-1 text-[13px] text-text-secondary lining-nums">
              {t("detail.placed", { date: placed })}
            </p>
          </div>
          <OrderStatusControl />
        </div>

        {/* ── Summary cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-[13px] xl:grid-cols-4">
          <StatCard
            label={t("detail.cards.total")}
            value={money(order.total)}
            icon={Wallet}
            tone="gold"
          />
          <StatCard
            label={t("detail.cards.items")}
            value={order.items.length}
            note={t("detail.cards.itemsNote", { count: units })}
            icon={Package}
            tone="gold"
          />
          <StatCard
            compact
            label={t("detail.cards.payment")}
            value={t("detail.cashOnDelivery")}
            icon={Banknote}
            tone="gold"
          />
          <StatCard
            compact
            label={t("detail.cards.status")}
            value={<OrderStatusBadge variant="plain" />}
            icon={Truck}
            tone="gold"
          />
        </div>

        {/* Below `xl` the four cards flow in one grid (two columns from `md`); at `xl` the two wrappers become the columns. */}
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-4">
            {/* ── Order Items ──────────────────────────────────────────── */}
            <Card
              id="order-items-title"
              icon={ShoppingCart}
              title={t("detail.itemsCard.title")}
              className="md:col-span-2"
            >
              <div
                aria-hidden="true"
                className={cn(
                  "hidden gap-x-3.5 border-b border-brand-burgundy/[0.07] px-5 py-2.5 md:grid",
                  COLUMNS,
                  SMALL_CAPS,
                )}
              >
                <span className="col-span-2">{t("detail.itemsCard.product")}</span>
                <span>{t("detail.itemsCard.option")}</span>
                <span className="text-center">{t("detail.itemsCard.quantity")}</span>
                <span>{t("detail.itemsCard.unitPrice")}</span>
                <span className="text-end">{t("detail.itemsCard.lineTotal")}</span>
              </div>

              <ul className="divide-y divide-brand-burgundy/[0.07] px-5">
                {order.items.map((item, index) => {
                  // The stored line says whether it was bought on sale — never today's product price.
                  const boughtOnSale = item.wasOnSale && item.originalPrice > item.unitPrice;
                  const option = item.selectedOption
                    ? resolveLocalizedString(item.selectedOption.label, locale)
                    : null;
                  return (
                    <li
                      key={`${item.productId}:${item.selectedOption?.optionKey ?? ""}:${index}`}
                      data-testid="admin-order-line"
                      className={cn(
                        "grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-0.5 py-3.5",
                        COLUMNS,
                      )}
                    >
                      <span className="col-start-1 row-span-4 row-start-1 flex md:row-span-1">
                        <ProductThumb src={thumbnails[item.productId]} />
                      </span>
                      <p className="col-start-2 row-start-1 text-[14.5px] leading-snug text-brand-burgundy">
                        {resolveLocalizedString(item.productName, locale)}
                      </p>
                      <p
                        data-testid="admin-option"
                        className={cn(
                          "col-start-2 row-start-2 text-[12.5px] text-text-secondary md:col-start-3 md:row-start-1 md:text-[13.5px] md:text-brand-burgundy",
                          !option && "max-md:hidden",
                        )}
                      >
                        {option ? (
                          <span className="md:hidden">{t("detail.itemsCard.option")}: </span>
                        ) : null}
                        {option ?? <span aria-label={t("detail.itemsCard.noOption")}>—</span>}
                      </p>
                      <p className="col-start-2 row-start-3 text-[12.5px] text-text-secondary lining-nums md:col-start-4 md:row-start-1 md:text-center md:text-[13.5px] md:text-brand-burgundy">
                        <span className="md:hidden">{t("detail.itemsCard.quantity")}: </span>
                        {item.quantity}
                      </p>
                      <p
                        data-testid="admin-unit-price"
                        className="col-start-2 row-start-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-text-secondary lining-nums md:col-start-5 md:row-start-1 md:text-[13.5px]"
                      >
                        {boughtOnSale ? (
                          <>
                            <s className="text-text-secondary/80">{money(item.originalPrice)}</s>
                            <span className="font-medium text-brand-burgundy">
                              {money(item.unitPrice)}
                            </span>
                            <Badge variant="gold">{t("detail.itemsCard.sale")}</Badge>
                          </>
                        ) : (
                          <span className="md:text-brand-burgundy">{money(item.unitPrice)}</span>
                        )}
                      </p>
                      <span
                        data-testid="admin-line-total"
                        className="col-start-3 row-start-1 shrink-0 text-end text-[14.5px] font-medium tabular-nums text-brand-burgundy lining-nums md:col-start-6"
                      >
                        {money(item.unitPrice * item.quantity)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {/* The stored totals, as recorded when the order was placed. */}
              <dl className="ms-auto flex w-full max-w-[300px] flex-col gap-2.5 border-t border-brand-burgundy/[0.07] px-5 py-4">
                <div className="flex items-center justify-between gap-4 text-[13.5px]">
                  <dt className="text-text-secondary">{t("detail.itemsCard.subtotal")}</dt>
                  <dd
                    data-testid="admin-subtotal"
                    className="tabular-nums text-brand-burgundy lining-nums"
                  >
                    {money(order.subtotal)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-display text-[18px] leading-none text-brand-burgundy">
                    {t("detail.itemsCard.total")}
                  </dt>
                  <dd
                    data-testid="admin-total"
                    className="text-[18px] font-medium tabular-nums text-brand-burgundy lining-nums"
                  >
                    {money(order.total)}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* ── Order Information ────────────────────────────────────── */}
            <Card
              id="order-info-title"
              icon={FileText}
              title={t("detail.infoCard.title")}
              className="md:col-start-1"
            >
              <dl className="flex flex-col divide-y divide-brand-burgundy/[0.07] px-5 text-[13.5px]">
                <Row label={t("detail.infoCard.orderNumber")}>
                  <bdi dir="ltr" className="font-medium text-brand-burgundy lining-nums">
                    {order.orderNumber}
                  </bdi>
                </Row>
                <Row label={t("detail.infoCard.placed")}>
                  <span className="text-brand-burgundy lining-nums">{placed}</span>
                </Row>
                <Row label={t("detail.infoCard.payment")}>
                  <span className="text-brand-burgundy">{t("detail.cashOnDelivery")}</span>
                </Row>
                <Row label={t("detail.infoCard.status")}>
                  <OrderStatusBadge variant="plain" className="text-brand-burgundy" />
                </Row>
                <Row label={t("detail.infoCard.deliveringTo")}>
                  <span data-testid="delivering-to" className="text-brand-burgundy">
                    {destination}
                  </span>
                </Row>
              </dl>
            </Card>
          </div>

          <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-4">
            {/* ── Customer & Delivery ──────────────────────────────────── */}
            <Card
              id="order-customer-title"
              icon={UserRound}
              title={t("detail.customerCard.title")}
              className="md:col-start-2 md:row-span-2 md:row-start-2"
            >
              <div className="px-5 py-4">
                <h3 className="text-[14px] font-semibold text-brand-burgundy">
                  {t("detail.customerCard.customer")}
                </h3>
                <dl className="mt-2.5 flex flex-col gap-2.5">
                  <InfoRow
                    icon={User}
                    label={t("detail.customerCard.name")}
                    value={customer.fullName}
                  />
                  <InfoRow
                    icon={Mail}
                    label={t("detail.customerCard.email")}
                    value={customer.email}
                    ltr
                  />
                  <InfoRow
                    icon={Phone}
                    label={t("detail.customerCard.phone")}
                    value={customer.phone}
                    ltr
                  />
                </dl>
                <span
                  data-testid="customer-type"
                  className="mt-3 inline-block rounded-full bg-brand-cream px-3 py-1.5 text-[12.5px] leading-none text-text-secondary"
                >
                  {order.userId
                    ? t("detail.customerCard.registered")
                    : t("detail.customerCard.guest")}
                </span>

                <div aria-hidden="true" className="my-4 h-px bg-brand-burgundy/[0.07]" />

                <dl className="flex flex-col gap-2.5">
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className={ICON_DISC}>
                      <MapPin className="size-[15px] stroke-[1.6]" />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-[14px] font-semibold text-brand-burgundy">
                        {t("detail.customerCard.deliveryAddress")}
                      </dt>
                      <dd className="mt-1 break-words text-[13.5px] leading-snug text-brand-burgundy">
                        <span data-testid="delivery-destination">{destination}</span>
                        <span className="mt-0.5 block text-text-secondary">
                          {delivery.fullAddress}
                        </span>
                      </dd>
                    </div>
                  </div>
                  {order.notes ? (
                    <InfoRow
                      icon={StickyNote}
                      label={t("detail.customerCard.notes")}
                      value={order.notes}
                    />
                  ) : null}
                </dl>
              </div>
            </Card>

            {/* ── Order Timeline ───────────────────────────────────────── */}
            <Card
              id="order-timeline-title"
              icon={Clock}
              title={t("detail.timeline.title")}
              className="md:col-start-1"
            >
              <OrderTimeline placed={placed} />
            </Card>
          </div>
        </div>
      </div>
    </OrderStatusProvider>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-end">{children}</dd>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  ltr = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Emails and phone numbers read left-to-right even inside Arabic text. */
  ltr?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className={ICON_DISC}>
        <Icon className="size-[15px] stroke-[1.6]" />
      </span>
      <div className="min-w-0">
        <dt className="text-[12px] text-text-secondary">{label}</dt>
        <dd className="mt-0.5 break-words text-[13.5px] leading-snug text-brand-burgundy">
          {ltr ? <bdi dir="ltr">{value}</bdi> : value}
        </dd>
      </div>
    </div>
  );
}
