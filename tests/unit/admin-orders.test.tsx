import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { ORDER_STATUSES, type OrderStatus } from "@/types/order";
import {
  filterAdminOrders,
  parseOrderStatus,
  IN_PROGRESS_STATUSES,
} from "@/lib/domain/admin/order-filters";
// The list is a client component: it needs a router, and it saves through a protected server action
// (stubbed — nothing here touches Firebase).
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/actions/admin/order.actions", () => ({ updateOrderStatusAction: vi.fn() }));

import { AdminOrdersList, type AdminOrderRow } from "@/components/admin/AdminOrdersList";

/**
 * Admin Orders page: the (unchanged) search + status filtering, the summary
 * counts (Firestore aggregation, mocked — nothing is read or written), and the
 * redesigned list with its two empty states, in English and Arabic.
 */

function makeOrder(orderNumber: string, fullName: string, status: OrderStatus) {
  return { orderNumber, customerSnapshot: { fullName }, status };
}

const ORDERS = [
  makeOrder("ELR-20260928-0003", "Sara Ahmed", "PENDING"),
  makeOrder("ELR-20260927-0002", "Lina Khalil", "DELIVERED"),
  makeOrder("ELR-20260927-0001", "سارة أحمد", "CANCELLED"),
];

describe("filterAdminOrders", () => {
  it("returns everything with no filters", () => {
    expect(filterAdminOrders(ORDERS, { query: "  ", status: null })).toHaveLength(3);
  });

  it("matches the order number or the customer name, case-insensitively", () => {
    expect(
      filterAdminOrders(ORDERS, { query: "0002", status: null }).map((o) => o.orderNumber),
    ).toEqual(["ELR-20260927-0002"]);
    expect(filterAdminOrders(ORDERS, { query: "SARA", status: null })).toHaveLength(1);
    expect(filterAdminOrders(ORDERS, { query: "سارة", status: null })).toHaveLength(1);
  });

  it("does not search by email (only order number and customer name are supported)", () => {
    const withEmail = ORDERS.map((o) => ({
      ...o,
      customerSnapshot: { ...o.customerSnapshot, email: "hidden@example.com" },
    }));
    expect(
      filterAdminOrders(withEmail, { query: "hidden@example.com", status: null }),
    ).toHaveLength(0);
  });

  it("filters by exact status and combines with the search", () => {
    expect(filterAdminOrders(ORDERS, { query: "", status: "DELIVERED" })).toHaveLength(1);
    expect(filterAdminOrders(ORDERS, { query: "sara", status: "DELIVERED" })).toHaveLength(0);
  });
});

describe("parseOrderStatus", () => {
  it("accepts only the real order statuses", () => {
    for (const status of ORDER_STATUSES) expect(parseOrderStatus(status)).toBe(status);
    expect(parseOrderStatus("SHIPPING")).toBeNull();
    expect(parseOrderStatus("pending")).toBeNull();
    expect(parseOrderStatus("")).toBeNull();
    expect(parseOrderStatus(undefined)).toBeNull();
  });

  it("only groups real statuses as in progress", () => {
    for (const status of IN_PROGRESS_STATUSES) expect(ORDER_STATUSES).toContain(status);
    expect(IN_PROGRESS_STATUSES).not.toContain("PENDING");
    expect(IN_PROGRESS_STATUSES).not.toContain("DELIVERED");
    expect(IN_PROGRESS_STATUSES).not.toContain("CANCELLED");
  });
});

describe("getOrderSummaryCounts", () => {
  const counts: Record<string, number> = {};
  const calls: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
    Object.assign(counts, { all: 42, PENDING: 5, IN_PROGRESS: 11, DELIVERED: 20 });
    const query = (key: string) => ({
      where: (_field: string, op: string, value: unknown) =>
        query(op === "in" ? "IN_PROGRESS" : String(value)),
      count: () => ({
        get: async () => {
          calls.push(key);
          return { data: () => ({ count: counts[key] }) };
        },
      }),
    });
    vi.doMock("@/lib/firebase/firestore", () => ({ ordersCollection: () => query("all") }));
  });

  it("counts every order and each group with aggregation queries — no documents are read", async () => {
    const { getOrderSummaryCounts } = await import("@/lib/domain/admin/order-summary.service");
    await expect(getOrderSummaryCounts()).resolves.toEqual({
      total: 42,
      pending: 5,
      inProgress: 11,
      delivered: 20,
    });
    expect(calls.sort()).toEqual(["DELIVERED", "IN_PROGRESS", "PENDING", "all"]);
  });
});

const ROWS: AdminOrderRow[] = [
  {
    id: "o1",
    orderNumber: "ELR-20260928-0003",
    customerName: "Sara Ahmed",
    customerEmail: "sara@example.com",
    isGuest: false,
    createdAt: Date.UTC(2026, 8, 28, 7, 24),
    total: 24000,
    status: "PENDING",
  },
  {
    id: "o2",
    orderNumber: "ELR-20260927-0002",
    customerName: "Lina Khalil",
    customerEmail: "lina@example.com",
    isGuest: true,
    createdAt: Date.UTC(2026, 8, 27, 15, 11),
    total: 13050,
    status: "DELIVERED",
  },
];

function renderList(
  props: Partial<Parameters<typeof AdminOrdersList>[0]> = {},
  locale: "en" | "ar" = "en",
) {
  const messages = locale === "en" ? en : ar;
  return render(
    <NextIntlClientProvider locale={locale} messages={{ AdminOrders: messages.AdminOrders }}>
      <AdminOrdersList
        counts={{ total: ROWS.length, pending: 1, inProgress: 0, delivered: 1 }}
        orders={ROWS}
        fetchedCount={ROWS.length}
        totalCount={ROWS.length}
        query=""
        status={null}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("AdminOrdersList", () => {
  it("renders each real order with customer, guest tag, ILS total, date and status", () => {
    renderList();
    const rows = screen.getAllByTestId("admin-row");
    // The table (xl+) and the card list (below xl) both render; CSS shows one.
    expect(rows).toHaveLength(ROWS.length * 2);
    const first = rows[0];
    expect(within(first).getByText("Sara Ahmed")).toBeTruthy();
    expect(within(first).getByText("sara@example.com")).toBeTruthy();
    expect(within(first).getByText(/₪240\.00/)).toBeTruthy();
    expect(within(first).getByText("Sep 28, 2026")).toBeTruthy();
    expect(within(first).getByText("Pending")).toBeTruthy();
    expect(within(rows[1]).getByText("Guest")).toBeTruthy();
    expect(within(rows[1]).getByText("Delivered")).toBeTruthy();
    expect(within(first).queryByText("Guest")).toBeNull();
  });

  it("keeps the order number a link to the order detail, with a separate View control", () => {
    renderList();
    const numberLinks = screen.getAllByRole("link", { name: "ELR-20260928-0003" });
    expect(numberLinks.length).toBeGreaterThan(0);
    for (const link of numberLinks) expect(link.getAttribute("href")).toBe("/admin/orders/o1");
    const views = screen.getAllByRole("link", { name: "View" });
    expect(views.map((v) => v.getAttribute("href"))).toContain("/admin/orders/o2");
  });

  it("offers only the real statuses in the filter, and keeps q/status form fields", () => {
    renderList({ query: "sara", status: "PENDING" });
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.name).toBe("status");
    expect(select.value).toBe("PENDING");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["", ...ORDER_STATUSES]);
    expect((screen.getByRole("searchbox") as HTMLInputElement).name).toBe("q");
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("sara");
    // Filters are active → Clear filters is offered.
    expect(screen.getByRole("link", { name: "Clear filters" }).getAttribute("href")).toBe(
      "/admin/orders",
    );
  });

  it("shows the filtered empty state with Clear filters when a search matches nothing", () => {
    renderList({ orders: [], query: "zzz" });
    const empty = screen.getByTestId("orders-empty");
    expect(within(empty).getByRole("heading", { name: "No orders found" })).toBeTruthy();
    expect(within(empty).getByText("There are no orders matching your search.")).toBeTruthy();
    expect(within(empty).getByRole("link", { name: "Clear filters" })).toBeTruthy();
  });

  it("shows a neutral empty state — without Clear filters — when there are no orders at all", () => {
    renderList({ orders: [], fetchedCount: 0, totalCount: 0 });
    const empty = screen.getByTestId("orders-empty");
    expect(within(empty).getByRole("heading", { name: "No orders found" })).toBeTruthy();
    expect(within(empty).getByText(/No orders have been placed yet/)).toBeTruthy();
    expect(within(empty).queryByRole("link", { name: "Clear filters" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Clear filters" })).toBeNull();
  });

  it("does not invent pagination: it says when only the latest orders are listed", () => {
    renderList({ totalCount: 250 });
    expect(screen.getByText("Showing the latest 2 of 250 orders")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("renders Arabic labels, statuses and dates without raw translation keys", () => {
    const { container } = renderList({}, "ar");
    expect(screen.getByRole("searchbox").getAttribute("placeholder")).toBe(
      "ابحث برقم الطلب أو اسم العميل…",
    );
    expect(within(screen.getAllByTestId("admin-row")[0]).getByText("قيد الانتظار")).toBeTruthy();
    expect(within(screen.getAllByTestId("admin-row")[1]).getByText("ضيف")).toBeTruthy();
    expect(container.textContent).not.toMatch(/AdminOrders|columns\.|status\.|filters\.|empty\./);
  });

  it("has an Arabic and English string for every AdminOrders key", () => {
    const keys = (o: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" && v !== null
          ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`],
      );
    expect(keys(ar.AdminOrders).sort()).toEqual(keys(en.AdminOrders).sort());
  });
});
