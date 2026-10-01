import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Box,
  ChartNoAxesColumnIncreasing,
  Download,
  Ellipsis,
  ShoppingBag,
  SquareArrowOutUpRight,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import { DirectionalIcon } from "@/components/ui/DirectionalIcon";
import { StatCard } from "@/components/admin/StatCard";
import type { DashboardStats, BestSellerRow } from "@/lib/domain/admin/dashboard.service";
import type { Order, OrderStatus } from "@/types/order";

/** The dashboard's message lookup (`AdminDashboard` namespace). */
export type DashboardTranslate = (key: string, values?: Record<string, string | number>) => string;

export type AdminDashboardViewProps = {
  t: DashboardTranslate;
  locale: "en" | "ar";
  /** First name of the signed-in staff member for the greeting, if known. */
  firstName: string | null;
  stats: DashboardStats;
  bestSellers: BestSellerRow[];
  recentOrders: Order[];
  /** Product id → first image URL (display only). */
  thumbnails: Record<string, string>;
};

const RECENT_ORDERS_SHOWN = 5;

/** Muted, luxury status tints — never saturated. */
const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: "bg-brand-gold/[0.16] text-brand-gold-ink",
  CONFIRMED: "bg-brand-gold/[0.16] text-brand-gold-ink",
  PREPARING: "bg-brand-gold/[0.16] text-brand-gold-ink",
  SHIPPED: "bg-brand-cream text-brand-burgundy",
  DELIVERED: "bg-[#e6f0e9] text-[#2f6844]",
  CANCELLED: "bg-[#f7e8e6] text-[#963a33]",
};

const SURFACE =
  "rounded-[10px] border border-brand-gold/[0.16] bg-white shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)]";

/**
 * Admin Dashboard (T170) — the approved TIA dashboard composition: editorial
 * hero, four headline figures, Recent Orders and Best Sellers panels, and a
 * row of shortcuts. Purely presentational: every figure, order and product
 * shown is passed in from the real dashboard queries, and each empty list
 * renders its own empty state rather than sample content.
 */
export function AdminDashboardView({
  t,
  locale,
  firstName,
  stats,
  bestSellers,
  recentOrders,
  thumbnails,
}: AdminDashboardViewProps) {
  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", {
    dateStyle: "medium",
    timeZone: "Asia/Hebron",
  });
  const timeFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", {
    timeStyle: "short",
    timeZone: "Asia/Hebron",
  });
  const welcome = firstName ? t("welcome", { name: firstName }) : t("welcomeNoName");
  const orders = recentOrders.slice(0, RECENT_ORDERS_SHOWN);

  const statCards: {
    key: "totalSales" | "totalOrders" | "totalCustomers" | "totalProducts";
    value: string;
    icon: LucideIcon;
    href: string;
    note: string;
  }[] = [
    {
      key: "totalSales",
      value: formatCurrency(stats.totalSales, locale === "ar" ? "ar" : "en-US"),
      icon: ChartNoAxesColumnIncreasing,
      href: "/admin/orders",
      note: t("statNotes.totalSales"),
    },
    {
      key: "totalOrders",
      value: String(stats.totalOrders),
      icon: ShoppingBag,
      href: "/admin/orders?status=PENDING",
      note: `${stats.pendingOrders} ${t("statNotes.totalOrders")}`,
    },
    {
      key: "totalCustomers",
      value: String(stats.totalCustomers),
      icon: Users,
      href: "/admin/customers",
      note: t("statNotes.totalCustomers"),
    },
    {
      key: "totalProducts",
      value: String(stats.totalProducts),
      icon: Box,
      href: "/admin/products",
      note: `${stats.soldOutProducts} ${t("statNotes.totalProducts")}`,
    },
  ];

  const actions: {
    key: "products" | "store" | "exports";
    href: string;
    icon: LucideIcon;
    external?: boolean;
  }[] = [
    { key: "products", href: "/admin/products", icon: Box },
    { key: "store", href: `/${locale}`, icon: SquareArrowOutUpRight, external: true },
    { key: "exports", href: "/admin/exports", icon: Download },
  ];

  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative -mx-4 -mt-5 overflow-hidden sm:-mx-6 lg:-mx-6 lg:-mt-4">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(196,164,107,0.07),rgba(252,251,248,0)_92%)]"
        />
        {/* Editorial still: rings on stone, dissolving into the ground on every side. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 end-0 hidden w-[58%] md:block min-[90rem]:end-[14%] min-[90rem]:w-[36%]"
        >
          <div className="absolute inset-0 [mask-image:linear-gradient(90deg,transparent,#000_30%,#000_72%,transparent),linear-gradient(180deg,#000_55%,transparent)] [mask-composite:intersect]">
            <Image
              src="/images/about/about-rings.jpg"
              alt=""
              fill
              priority
              sizes="(min-width: 1440px) 40vw, 58vw"
              className="object-cover object-[92%_55%] opacity-90 [filter:saturate(0.82)_brightness(1.13)_contrast(0.94)]"
            />
          </div>
          <div className="absolute -end-[14%] -top-3 h-[125%] w-[44%] opacity-45 mix-blend-multiply [mask-image:linear-gradient(90deg,transparent,#000_35%,#000_60%,transparent)]">
            <Image
              src="/images/about/about-floral.jpg"
              alt=""
              fill
              sizes="20vw"
              className="object-cover object-left"
            />
          </div>
        </div>

        <div className="relative flex min-h-[150px] items-center px-4 pb-6 pt-5 sm:px-6 md:min-h-[140px] md:py-4 lg:px-9">
          <div className="max-w-[560px] md:max-w-[46%] min-[90rem]:max-w-[560px]">
            <p className="text-[11px] uppercase leading-none tracking-[0.14em] text-brand-burgundy/80 rtl:text-[12px] rtl:normal-case rtl:tracking-normal">
              {welcome}
            </p>
            <h1 className="mt-2.5 font-display text-[28px] font-normal leading-[1.12] text-brand-burgundy sm:text-[32px] lg:text-[35px] rtl:mt-3 rtl:text-[24px] rtl:leading-[1.45] rtl:sm:text-[27px] rtl:lg:text-[29px]">
              {t("title")}
            </h1>
            <p className="mt-2 font-display text-[15px] leading-snug text-text-secondary lg:text-[16px] rtl:font-body rtl:text-[14px] rtl:lg:text-[15px]">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div aria-hidden="true" className="absolute end-[3.5%] top-[40px] hidden min-[90rem]:block">
          <p className="font-display text-[18px] leading-[1.28] text-brand-burgundy rtl:text-[16px] rtl:leading-[1.6]">
            {t("tagline1")}
            <br />
            {t("tagline2")}
          </p>
          <span className="ms-auto mt-2 block h-[1.5px] w-12 bg-brand-gold" />
        </div>
      </section>

      {/* ── Headline figures ─────────────────────────────────────────── */}
      <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-[13px] xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard
            key={card.key}
            label={t(`stats.${card.key}`)}
            value={card.value}
            icon={card.icon}
            note={card.note}
            href={card.href}
            linkLabel={t(`statLinks.${card.key}`)}
          />
        ))}
      </div>

      {/* ── Recent Orders / Best Sellers ─────────────────────────────── */}
      <div className="relative mt-4 grid grid-cols-1 gap-[13px] min-[90rem]:grid-cols-[777fr_458fr]">
        <section
          aria-labelledby="dashboard-recent-orders"
          className={cn(SURFACE, "flex min-w-0 flex-col overflow-hidden")}
        >
          <PanelHeader
            id="dashboard-recent-orders"
            icon={ShoppingBag}
            title={t("recentOrders.title")}
            href="/admin/orders"
            viewAll={t("viewAll")}
            viewAllLabel={t("viewAllOrders")}
          />
          {orders.length === 0 ? (
            <PanelEmpty
              icon={ShoppingBag}
              title={t("recentOrders.emptyTitle")}
              body={t("recentOrders.emptyBody")}
            />
          ) : (
            <div className="flex-1">
              <div
                aria-hidden="true"
                className="hidden h-8 items-center gap-4 bg-brand-cream/60 px-4 text-[11px] uppercase tracking-[0.08em] text-text-secondary md:grid md:grid-cols-[136px_minmax(0,1.5fr)_minmax(0,0.95fr)_minmax(0,0.75fr)_minmax(0,0.85fr)_28px] rtl:text-[12px] rtl:normal-case rtl:tracking-normal"
              >
                <span>{t("recentOrders.columns.number")}</span>
                <span className="ps-[56px]">{t("recentOrders.columns.customer")}</span>
                <span>{t("recentOrders.columns.date")}</span>
                <span>{t("recentOrders.columns.total")}</span>
                <span>{t("recentOrders.columns.status")}</span>
                <span />
              </div>
              <ul className="divide-y divide-brand-burgundy/[0.06] px-4">
                {orders.map((order) => {
                  const createdAt = order.createdAt.toDate();
                  const thumbnail = order.items[0]
                    ? thumbnails[order.items[0].productId]
                    : undefined;
                  return (
                    <li
                      key={order.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 md:min-h-[58px] md:grid-cols-[136px_minmax(0,1.5fr)_minmax(0,0.95fr)_minmax(0,0.75fr)_minmax(0,0.85fr)_28px] md:py-2"
                    >
                      <Link
                        href={`/admin/orders/${order.id}`}
                        dir="ltr"
                        className="order-1 truncate text-[14px] text-brand-burgundy underline-offset-4 hover:underline rtl:text-right md:order-none md:text-[14.5px]"
                        title={order.orderNumber}
                      >
                        {order.orderNumber}
                      </Link>
                      <div className="order-3 col-span-2 flex min-w-0 items-center gap-3 md:order-none md:col-span-1">
                        <Thumbnail src={thumbnail} size="size-11" />
                        <div className="min-w-0">
                          <p className="truncate text-[14px] text-brand-burgundy">
                            {order.customerSnapshot.fullName}
                          </p>
                          <p
                            dir="ltr"
                            className="truncate text-[13px] text-text-secondary rtl:text-right"
                          >
                            {order.customerSnapshot.email}
                          </p>
                        </div>
                      </div>
                      <div className="order-4 text-[14px] text-brand-burgundy md:order-none">
                        <p>{dateFormat.format(createdAt)}</p>
                        <p className="text-[13px] text-text-secondary">
                          {timeFormat.format(createdAt)}
                        </p>
                      </div>
                      <p
                        dir="ltr"
                        className="order-5 self-end text-end font-display text-[16px] lining-nums tabular-nums text-brand-burgundy md:order-none md:self-auto md:text-start rtl:md:text-right [font-family:var(--font-playfair),serif]"
                      >
                        {formatCurrency(order.total, locale === "ar" ? "ar" : "en-US")}
                      </p>
                      <span className="order-2 justify-self-end md:order-none md:justify-self-start">
                        <span
                          className={cn(
                            "inline-flex rounded-md px-3 py-[5px] text-[13px] leading-tight",
                            STATUS_TONE[order.status],
                          )}
                        >
                          {t(`status.${order.status}`)}
                        </span>
                      </span>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        aria-label={`${t("recentOrders.open")} ${order.orderNumber}`}
                        className="hidden size-8 place-items-center rounded-full text-text-secondary hover:bg-brand-cream hover:text-brand-burgundy md:grid"
                      >
                        <Ellipsis aria-hidden="true" className="size-[18px]" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <section
          aria-labelledby="dashboard-best-sellers"
          className={cn(SURFACE, "flex min-w-0 flex-col overflow-hidden")}
        >
          <PanelHeader
            id="dashboard-best-sellers"
            icon={ChartNoAxesColumnIncreasing}
            title={t("bestSellers.title")}
            href="/admin/products"
            viewAll={t("viewAll")}
            viewAllLabel={t("viewAllProducts")}
          />
          {bestSellers.length === 0 ? (
            <PanelEmpty
              icon={ChartNoAxesColumnIncreasing}
              title={t("bestSellers.emptyTitle")}
              body={t("bestSellers.emptyBody")}
            />
          ) : (
            <ol className="flex-1 divide-y divide-brand-burgundy/[0.06] px-4">
              {bestSellers.map((row, index) => (
                <li key={row.productId} className="flex min-h-[62px] items-center gap-3 py-2.5">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-gold/[0.12] text-[14px] lining-nums text-brand-burgundy [font-family:var(--font-playfair),serif]"
                  >
                    {index + 1}
                  </span>
                  <Thumbnail src={thumbnails[row.productId]} size="size-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-brand-burgundy">{row.nameEn}</p>
                    <p className="mt-1 text-[13px] text-text-secondary">
                      <span className="lining-nums tabular-nums">{row.quantitySold}</span>{" "}
                      {t("bestSellers.sold")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* ── Collection + shortcuts ───────────────────────────────────── */}
      <div className="relative mt-4 grid grid-cols-1 gap-[13px] md:grid-cols-3 min-[90rem]:grid-cols-[570fr_225fr_202fr_200fr]">
        <section className="relative min-h-[160px] overflow-hidden rounded-[10px] border border-brand-gold/[0.16] bg-[#f6f1e9] md:col-span-3 min-[90rem]:col-span-1">
          <div
            aria-hidden="true"
            className="absolute inset-y-0 start-0 w-[48%] sm:w-[70%] [mask-image:linear-gradient(90deg,#000_52%,transparent)] rtl:[mask-image:linear-gradient(270deg,#000_52%,transparent)]"
          >
            <Image
              src="/images/demo/editorial-ring.jpg"
              alt=""
              fill
              sizes="(min-width: 1440px) 400px, 70vw"
              className="object-cover object-[40%_60%] [filter:saturate(0.92)]"
            />
          </div>
          <div className="relative ms-auto flex min-h-[160px] w-[62%] max-w-[300px] flex-col justify-center py-5 pe-5 ps-2 sm:w-[46%] min-[90rem]:w-[42%]">
            <h2 className="font-display text-[22px] leading-tight text-brand-burgundy">
              {t("collection.title")}
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
              {t("collection.body")}
            </p>
            <Link
              href="/admin/products/new"
              className="mt-3 inline-flex min-h-9 w-fit items-center gap-2 rounded-full bg-brand-gold px-4 text-[13.5px] text-brand-burgundy shadow-[0_6px_16px_-10px_rgba(127,100,44,0.6)] transition-colors duration-200 hover:bg-brand-gold-muted"
            >
              {t("collection.cta")}
              <DirectionalIcon
                icon={ArrowRight}
                aria-hidden="true"
                className="size-4 stroke-[1.7]"
              />
            </Link>
          </div>
        </section>

        {actions.map((action) => (
          <Link
            key={action.key}
            href={action.href}
            {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={cn(
              SURFACE,
              "group relative flex min-h-[170px] flex-col p-5 transition-shadow duration-200 hover:shadow-elev-2 min-[90rem]:min-h-[201px]",
            )}
          >
            <span
              aria-hidden="true"
              className="grid size-[42px] place-items-center rounded-full bg-brand-gold/[0.12]"
            >
              {action.external ? (
                <DirectionalIcon
                  icon={action.icon}
                  className="size-5 stroke-[1.8] text-brand-gold"
                />
              ) : (
                <action.icon className="size-5 stroke-[1.8] text-brand-gold" />
              )}
            </span>
            <h2 className="mt-3 font-display text-[17px] leading-tight text-brand-burgundy">
              {t(`actions.${action.key}.title`)}
            </h2>
            <p className="mt-1.5 pe-8 text-[12.5px] leading-relaxed text-text-secondary">
              {t(`actions.${action.key}.body`)}
            </p>
            <span
              aria-hidden="true"
              className="absolute bottom-[14px] end-[14px] grid size-[30px] place-items-center rounded-full bg-brand-gold/[0.14] text-brand-gold-ink transition-colors duration-200 group-hover:bg-brand-gold/30"
            >
              <DirectionalIcon icon={ArrowRight} className="size-4 stroke-[1.7]" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PanelHeader({
  id,
  icon: Icon,
  title,
  href,
  viewAll,
  viewAllLabel,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  href: string;
  viewAll: string;
  viewAllLabel: string;
}) {
  return (
    <div className="flex min-h-[54px] items-center gap-3 px-4">
      <span
        aria-hidden="true"
        className="grid size-[35px] shrink-0 place-items-center rounded-full bg-brand-gold/[0.12]"
      >
        <Icon className="size-[18px] stroke-[1.85] text-brand-gold" />
      </span>
      <h2
        id={id}
        className="min-w-0 flex-1 truncate font-display text-[20px] leading-tight text-brand-burgundy"
      >
        {title}
      </h2>
      <Link
        href={href}
        aria-label={viewAllLabel}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-brand-gold/[0.1] px-3.5 text-[13px] text-brand-gold-ink transition-colors hover:bg-brand-gold/20 max-md:h-11"
      >
        {viewAll}
        <DirectionalIcon
          icon={ArrowRight}
          aria-hidden="true"
          className="size-[15px] stroke-[1.7]"
        />
      </Link>
    </div>
  );
}

function PanelEmpty({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center border-t border-brand-burgundy/[0.06] px-6 py-7 text-center lg:min-h-[192px]">
      <span
        aria-hidden="true"
        className="grid size-[58px] place-items-center rounded-full bg-brand-gold/[0.1]"
      >
        <Icon className="size-6 stroke-[1.6] text-brand-gold" />
      </span>
      <p className="mt-3.5 font-display text-[17px] text-brand-burgundy">{title}</p>
      <p className="mt-1.5 max-w-[340px] text-[13px] leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
}

function Thumbnail({ src, size }: { src: string | undefined; size: string }) {
  return (
    <span className={cn("relative shrink-0 overflow-hidden rounded-lg bg-brand-cream", size)}>
      {src ? <Image src={src} alt="" fill sizes="56px" className="object-cover" /> : null}
    </span>
  );
}
