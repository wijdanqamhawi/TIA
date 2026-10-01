import { ShoppingBag, UserPlus, Users, UserX } from "lucide-react";
import { getCustomerDirectory } from "@/lib/domain/admin/customer.service";
import {
  CUSTOMER_PAGE_SIZE,
  filterCustomers,
  paginate,
  parseJoinedFilter,
  parseOrdersFilter,
  parsePage,
  startOfMonthInZone,
} from "@/lib/domain/admin/customer-directory";
import { getAdminTranslator } from "@/lib/i18n/admin";
import { StatCard } from "@/components/admin/StatCard";
import { AdminCustomersList, type CustomersTranslate } from "@/components/admin/AdminCustomersList";

export const dynamic = "force-dynamic";

/**
 * Admin — Customers (T167): registered CUSTOMER accounts only (never staff,
 * never guests), with search, an orders filter, a joined filter and server-side
 * paging over the loaded list. The summary figures come from the same
 * CUSTOMER-only data.
 */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; orders?: string; joined?: string; page?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const [{ customers, stats, truncated }, { t, locale }] = await Promise.all([
    getCustomerDirectory(now),
    getAdminTranslator("AdminCustomers"),
  ]);
  const translate = t as unknown as CustomersTranslate;

  const query = params.q?.trim() ?? "";
  const orders = parseOrdersFilter(params.orders);
  const joined = parseJoinedFilter(params.joined);
  const filtered = filterCustomers(
    customers,
    { query, orders, joined },
    { now, monthStartMs: startOfMonthInZone(now) },
  );
  const paged = paginate(filtered, parsePage(params.page), CUSTOMER_PAGE_SIZE);

  const stat = (value: number | null) => (value === null ? "—" : value);
  const cards = [
    { key: "total", value: stat(stats.total), icon: Users, tone: "gold" },
    { key: "newThisMonth", value: stat(stats.newThisMonth), icon: UserPlus, tone: "gold" },
    { key: "withOrders", value: stat(stats.withOrders), icon: ShoppingBag, tone: "blue" },
    { key: "noOrders", value: stat(stats.noOrders), icon: UserX, tone: "blue" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0 pt-1">
        <h1 className="font-display text-[32px] font-normal leading-[1.1] text-brand-burgundy lg:text-[38px] rtl:text-[28px] rtl:leading-[1.4] rtl:lg:text-[32px]">
          {translate("title")}
        </h1>
        <p className="mt-1.5 font-display text-[15px] leading-snug text-text-secondary lg:text-[16px] rtl:font-body rtl:text-[14.5px]">
          {translate("subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-[13px] xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard
            key={card.key}
            label={translate(`stats.${card.key}`)}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            note={card.value === "—" ? translate("stats.unavailable") : undefined}
          />
        ))}
      </div>

      <AdminCustomersList
        t={translate}
        locale={locale}
        paged={paged}
        query={query}
        orders={orders}
        joined={joined}
        truncatedTotal={truncated ? stats.total : null}
        loadedCount={customers.length}
      />
    </div>
  );
}
