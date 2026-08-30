"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Price } from "@/components/ui/Price";
import { loadMoreOrdersAction } from "@/actions/account.actions";
import type { OrderSummary } from "@/lib/domain/orders/order.service";

/**
 * The order-history list (T137), paginated via `loadMoreOrdersAction`
 * (mirrors `ProductGridWithLoadMore`/`loadMoreProductsAction`). Every
 * order shown is already scoped to the signed-in customer's own `uid` by
 * the server component that fetched the initial page — this component
 * never accepts or requests another customer's orders.
 */
export function OrderHistoryList({
  locale,
  initialOrders,
  initialCursorId,
}: {
  locale: string;
  initialOrders: OrderSummary[];
  initialCursorId: string | null;
}) {
  const t = useTranslations("AccountOrders");
  const tStatus = useTranslations("OrderStatus");
  const [orders, setOrders] = useState(initialOrders);
  const [cursorId, setCursorId] = useState(initialCursorId);
  const [isPending, startTransition] = useTransition();

  function handleLoadMore() {
    startTransition(async () => {
      const result = await loadMoreOrdersAction(cursorId);
      setOrders((prev) => [...prev, ...result.orders]);
      setCursorId(result.nextCursorId);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {orders.map((order) => (
        <Link
          key={order.id}
          href={`/account/orders/${order.orderNumber}`}
          className="flex flex-col gap-2 rounded-lg border border-border-luxury bg-brand-ivory p-4 hover:bg-brand-beige sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <span className="font-medium text-text-primary" dir="ltr">
              {order.orderNumber}
            </span>
            <span className="text-sm text-text-primary/70">
              {new Date(order.createdAtISO).toLocaleDateString(locale)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <span className="text-sm text-text-primary/70">{tStatus(order.status)}</span>
            <Price minorUnits={order.total} locale={locale} className="text-sm" />
            <span className="text-sm font-medium text-brand-burgundy">{t("viewDetails")}</span>
          </div>
        </Link>
      ))}

      {cursorId ? (
        <Button type="button" variant="outline" onClick={handleLoadMore} disabled={isPending} className="self-center">
          {t("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
