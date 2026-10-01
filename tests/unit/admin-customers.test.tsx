import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import {
  computeCustomerStats,
  filterCustomers,
  pageWindow,
  paginate,
  parseJoinedFilter,
  parseOrdersFilter,
  parsePage,
  startOfMonthInZone,
  type CustomerRow,
} from "@/lib/domain/admin/customer-directory";
import { AdminCustomersList, type CustomersTranslate } from "@/components/admin/AdminCustomersList";

/**
 * Admin Customers: CUSTOMER-role accounts only (never OWNER/ADMIN, never
 * guests), the summary figures, search / orders / joined filters, paging, and
 * the redesigned list in English and Arabic. Firestore and Auth are faked in
 * memory — nothing is read from or written to any real project.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-30T12:00:00Z");
// 1 Sep 2026 00:00 in Asia/Hebron (UTC+3 in September) = 31 Aug 21:00 UTC.
const MONTH_START = Date.UTC(2026, 7, 31, 21, 0, 0);

function row(uid: string, name: string, overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    uid,
    name,
    email: `${uid}@example.com`,
    phone: null,
    createdAt: NOW.getTime() - 5 * DAY,
    orderCount: 0,
    ...overrides,
  };
}

describe("startOfMonthInZone", () => {
  it("is local midnight on the 1st in the store's time zone", () => {
    expect(startOfMonthInZone(NOW, "Asia/Hebron")).toBe(MONTH_START);
  });

  it("uses the store's calendar month, not UTC's, near a boundary", () => {
    // 31 Aug 22:00 UTC is already 1 Sep 01:00 in Hebron.
    expect(startOfMonthInZone(new Date("2026-08-31T22:00:00Z"), "Asia/Hebron")).toBe(MONTH_START);
    expect(startOfMonthInZone(new Date("2026-08-31T20:00:00Z"), "Asia/Hebron")).toBeLessThan(
      MONTH_START,
    );
  });
});

describe("computeCustomerStats", () => {
  it("counts total, new this month, and with / without orders from the rows it is given", () => {
    const rows = [
      row("a", "A", { orderCount: 2, createdAt: MONTH_START + DAY }),
      row("b", "B", { orderCount: 0, createdAt: MONTH_START + 2 * DAY }),
      row("c", "C", { orderCount: 1, createdAt: MONTH_START - DAY }),
    ];
    expect(computeCustomerStats(rows, MONTH_START)).toEqual({
      total: 3,
      newThisMonth: 2,
      withOrders: 2,
      noOrders: 1,
    });
    expect(computeCustomerStats([], MONTH_START)).toEqual({
      total: 0,
      newThisMonth: 0,
      withOrders: 0,
      noOrders: 0,
    });
  });
});

describe("filterCustomers", () => {
  const rows = [
    row("sara", "Sara Ahmed", { phone: "+970 59 123 4567", orderCount: 3 }),
    row("lina", "Lina Khalil", { phone: null, orderCount: 0, createdAt: NOW.getTime() - 60 * DAY }),
    row("dana", "دانا طارق", { phone: "0569876543", orderCount: 1, createdAt: MONTH_START + DAY }),
  ];
  const ctx = { now: NOW, monthStartMs: MONTH_START };
  const all = { query: "", orders: "all", joined: "all" } as const;
  const names = (found: CustomerRow[]) => found.map((r) => r.uid);

  it("searches name, email and phone, case-insensitively, including Arabic names", () => {
    expect(names(filterCustomers(rows, { ...all, query: "SARA" }, ctx))).toEqual(["sara"]);
    expect(names(filterCustomers(rows, { ...all, query: "lina@example" }, ctx))).toEqual(["lina"]);
    expect(names(filterCustomers(rows, { ...all, query: "دانا" }, ctx))).toEqual(["dana"]);
  });

  it("matches a phone by its digits regardless of spacing, and never crashes on a missing phone", () => {
    expect(names(filterCustomers(rows, { ...all, query: "059 123" }, ctx))).toEqual(["sara"]);
    expect(names(filterCustomers(rows, { ...all, query: "970591234567" }, ctx))).toEqual(["sara"]);
    expect(names(filterCustomers(rows, { ...all, query: "056987" }, ctx))).toEqual(["dana"]);
    expect(filterCustomers(rows, { ...all, query: "000111" }, ctx)).toEqual([]);
  });

  it("filters by orders", () => {
    expect(names(filterCustomers(rows, { ...all, orders: "withOrders" }, ctx))).toEqual([
      "sara",
      "dana",
    ]);
    expect(names(filterCustomers(rows, { ...all, orders: "noOrders" }, ctx))).toEqual(["lina"]);
  });

  it("filters by joined date and combines with the other filters", () => {
    expect(names(filterCustomers(rows, { ...all, joined: "thisMonth" }, ctx))).toEqual([
      "sara",
      "dana",
    ]);
    expect(names(filterCustomers(rows, { ...all, joined: "last30" }, ctx))).toEqual([
      "sara",
      "dana",
    ]);
    expect(
      names(filterCustomers(rows, { query: "", orders: "noOrders", joined: "thisMonth" }, ctx)),
    ).toEqual([]);
  });

  it("ignores unknown query-string values", () => {
    expect(parseOrdersFilter("x")).toBe("all");
    expect(parseOrdersFilter("withOrders")).toBe("withOrders");
    expect(parseJoinedFilter("last30")).toBe("last30");
    expect(parseJoinedFilter("forever")).toBe("all");
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });
});

describe("paginate / pageWindow", () => {
  const items = Array.from({ length: 45 }, (_, i) => i + 1);

  it("slices a page and reports the shown range", () => {
    const page2 = paginate(items, 2, 20);
    expect(page2.items[0]).toBe(21);
    expect(page2).toMatchObject({ page: 2, pageCount: 3, from: 21, to: 40, total: 45 });
    expect(paginate(items, 3, 20)).toMatchObject({ from: 41, to: 45 });
  });

  it("clamps an out-of-range page and handles an empty list", () => {
    expect(paginate(items, 99, 20).page).toBe(3);
    expect(paginate([], 1, 20)).toMatchObject({
      items: [],
      page: 1,
      pageCount: 1,
      from: 0,
      to: 0,
      total: 0,
    });
  });

  it("shows first, last and neighbours with gaps", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 24)).toEqual([1, "gap", 4, 5, 6, "gap", 24]);
    expect(pageWindow(1, 24)).toEqual([1, 2, "gap", 24]);
  });
});

// ── getCustomerDirectory: role filtering, staff exclusion, guests, counts ─────

type FakeUser = {
  uid: string;
  name: string;
  email: string;
  phone: string | null;
  role: "CUSTOMER" | "ADMIN" | "OWNER";
  createdAt: number;
};

describe("getCustomerDirectory", () => {
  const authClaims: Record<string, string | undefined> = {};
  let users: FakeUser[] = [];
  let orders: Array<{ userId: string | null }> = [];
  const userQueries: Array<[string, string, unknown]> = [];
  const orderQueries: Array<[string, string, unknown]> = [];
  let authCalls = 0;

  const fake = (
    uid: string,
    role: FakeUser["role"],
    overrides: Partial<FakeUser> = {},
  ): FakeUser => ({
    uid,
    name: `Name ${uid}`,
    email: `${uid}@example.com`,
    phone: null,
    role,
    createdAt: NOW.getTime() - DAY,
    ...overrides,
  });

  beforeEach(() => {
    vi.resetModules();
    users = [];
    orders = [];
    userQueries.length = 0;
    orderQueries.length = 0;
    authCalls = 0;
    for (const key of Object.keys(authClaims)) delete authClaims[key];

    const usersQuery = (filters: Array<[string, string, unknown]>): unknown => ({
      where: (field: string, op: string, value: unknown) => {
        userQueries.push([field, op, value]);
        return usersQuery([...filters, [field, op, value]]);
      },
      orderBy: () => usersQuery(filters),
      limit: (n: number) => usersQuery([...filters, ["__limit", "==", n]]),
      get: async () => {
        const limit = filters.find(([f]) => f === "__limit")?.[2] as number | undefined;
        const found = users
          .filter((u) => matches(u, filters))
          .sort((a, b) => b.createdAt - a.createdAt);
        return {
          docs: found.slice(0, limit ?? found.length).map((u) => ({
            data: () => ({ ...u, id: u.uid, createdAt: { toMillis: () => u.createdAt } }),
          })),
        };
      },
      count: () => ({
        get: async () => ({
          data: () => ({ count: users.filter((u) => matches(u, filters)).length }),
        }),
      }),
    });
    const matches = (u: FakeUser, filters: Array<[string, string, unknown]>) =>
      filters.every(([field, , value]) => {
        if (field === "__limit") return true;
        if (field === "role") return u.role === value;
        if (field === "createdAt")
          return u.createdAt >= (value as { toMillis(): number }).toMillis();
        return true;
      });

    vi.doMock("@/lib/firebase/firestore", () => ({
      usersCollection: () => usersQuery([]),
      ordersCollection: () => ({}),
    }));
    vi.doMock("@/lib/firebase/admin", () => ({
      getAdminAuth: () => ({
        getUsers: async (ids: Array<{ uid: string }>) => {
          authCalls += 1;
          return {
            users: ids.map(({ uid }) => ({ uid, customClaims: { role: authClaims[uid] } })),
          };
        },
      }),
      getAdminFirestore: () => ({
        collection: (name: string) => ({
          where: (field: string, op: string, value: unknown) => {
            orderQueries.push([`${name}.${field}`, op, value]);
            return {
              select: () => ({
                get: async () => ({
                  // `userId != null` is what the service asks for; the fake honours it.
                  docs: orders
                    .filter((o) => o.userId !== null)
                    .map((o) => ({ get: () => o.userId })),
                }),
              }),
            };
          },
        }),
      }),
    }));
  });

  async function load() {
    const { getCustomerDirectory } = await import("@/lib/domain/admin/customer.service");
    return getCustomerDirectory(NOW);
  }

  it("lists CUSTOMER accounts and never OWNER or ADMIN accounts", async () => {
    users = [
      fake("cust1", "CUSTOMER"),
      fake("boss", "OWNER"),
      fake("helper", "ADMIN"),
      fake("cust2", "CUSTOMER"),
    ];
    authClaims["boss"] = "OWNER";
    authClaims["helper"] = "ADMIN";

    const { customers, stats } = await load();

    expect(customers.map((c) => c.uid).sort()).toEqual(["cust1", "cust2"]);
    expect(userQueries).toContainEqual(["role", "==", "CUSTOMER"]);
    expect(stats.total).toBe(2);
  });

  it("also drops an account whose real Auth claim is staff even if its mirrored role still says CUSTOMER", async () => {
    users = [fake("cust1", "CUSTOMER"), fake("stale", "CUSTOMER")];
    authClaims["stale"] = "OWNER";

    const { customers, stats } = await load();

    expect(customers.map((c) => c.uid)).toEqual(["cust1"]);
    expect(stats.total).toBe(1);
    expect(authCalls).toBe(1);
  });

  it("fails closed when the role check cannot be made", async () => {
    users = [fake("cust1", "CUSTOMER")];
    vi.doMock("@/lib/firebase/admin", () => ({
      getAdminAuth: () => ({
        getUsers: async () => {
          throw new Error("auth unavailable");
        },
      }),
      getAdminFirestore: () => ({
        collection: () => ({
          where: () => ({ select: () => ({ get: async () => ({ docs: [] }) }) }),
        }),
      }),
    }));
    await expect(load()).rejects.toThrow("auth unavailable");
  });

  it("does not turn guest checkouts into customers, and counts orders per customer in a single read", async () => {
    users = [fake("cust1", "CUSTOMER"), fake("cust2", "CUSTOMER")];
    orders = [{ userId: "cust1" }, { userId: "cust1" }, { userId: null }, { userId: null }];

    const { customers, stats } = await load();

    expect(customers).toHaveLength(2); // guests have no users document, so none is created for them
    expect(customers.find((c) => c.uid === "cust1")?.orderCount).toBe(2);
    expect(customers.find((c) => c.uid === "cust2")?.orderCount).toBe(0);
    expect(orderQueries).toEqual([["orders.userId", "!=", null]]);
    expect(stats).toMatchObject({ withOrders: 1, noOrders: 1 });
  });

  it("ignores orders placed by staff accounts in the with/without-orders figures", async () => {
    users = [fake("cust1", "CUSTOMER"), fake("boss", "OWNER")];
    authClaims["boss"] = "OWNER";
    orders = [{ userId: "boss" }, { userId: "boss" }];

    const { customers, stats } = await load();

    expect(customers.map((c) => c.uid)).toEqual(["cust1"]);
    expect(stats).toEqual({ total: 1, newThisMonth: 1, withOrders: 0, noOrders: 1 });
  });

  it("counts new-this-month from joined dates and carries a missing phone as null", async () => {
    users = [
      fake("new", "CUSTOMER", { createdAt: MONTH_START + DAY, phone: "+970 59 111 2222" }),
      fake("old", "CUSTOMER", { createdAt: MONTH_START - 40 * DAY }),
    ];
    const { customers, stats } = await load();
    expect(stats.newThisMonth).toBe(1);
    expect(customers.find((c) => c.uid === "old")?.phone).toBeNull();
    expect(customers.find((c) => c.uid === "new")?.phone).toBe("+970 59 111 2222");
  });

  it("with more customers than the list loads, uses CUSTOMER-only aggregate counts and leaves order figures unavailable", async () => {
    users = [
      ...Array.from({ length: 205 }, (_, i) =>
        fake(`c${i}`, "CUSTOMER", { createdAt: MONTH_START + i * 1000 }),
      ),
      fake("boss", "OWNER"),
    ];
    authClaims["boss"] = "OWNER";

    const { customers, stats, truncated } = await load();

    expect(truncated).toBe(true);
    expect(customers).toHaveLength(200);
    expect(stats).toEqual({ total: 205, newThisMonth: 205, withOrders: null, noOrders: null });
  });
});

// ── The list component ────────────────────────────────────────────────────────

function renderList(
  props: Partial<Parameters<typeof AdminCustomersList>[0]> = {},
  locale: "en" | "ar" = "en",
  rows: CustomerRow[] = [
    row("c1", "Sara Ahmed", { phone: "+970 59 123 4567", orderCount: 3 }),
    row("c2", "Lina Khalil", { phone: null, orderCount: 0 }),
  ],
) {
  const messages = locale === "en" ? en : ar;
  const t = createTranslator({
    locale,
    messages: { AdminCustomers: messages.AdminCustomers },
    namespace: "AdminCustomers",
  }) as unknown as CustomersTranslate;
  return render(
    <AdminCustomersList
      t={t}
      locale={locale}
      paged={paginate(rows, 1)}
      query=""
      orders="all"
      joined="all"
      truncatedTotal={null}
      loadedCount={rows.length}
      {...props}
    />,
  );
}

afterEach(cleanup);

describe("AdminCustomersList", () => {
  it("renders real customers with email, phone, joined date, order count and a derived label", () => {
    renderList();
    const rows = screen.getAllByTestId("admin-row");
    expect(rows).toHaveLength(4); // table (xl+) + card list (below xl); CSS shows one
    const sara = rows[0]!;
    expect(within(sara).getByText("Sara Ahmed")).toBeTruthy();
    expect(within(sara).getByText("sara@example.com".replace("sara", "c1"))).toBeTruthy();
    expect(within(sara).getByText("+970 59 123 4567")).toBeTruthy();
    expect(within(sara).getByText("Sep 25, 2026")).toBeTruthy();
    expect(within(sara).getByText("3")).toBeTruthy();
    expect(within(sara).getByText("Has orders")).toBeTruthy();
    expect(within(rows[1]!).getByText("No orders")).toBeTruthy();
  });

  it("renders a missing phone as an em dash — never null or empty", () => {
    renderList();
    const lina = screen.getAllByTestId("admin-row")[1]!;
    expect(within(lina).getByText("—")).toBeTruthy();
    expect(lina.textContent).not.toMatch(/null|undefined/);
  });

  it("keeps the customer name a link to the existing detail page, with a separate View control", () => {
    renderList();
    const nameLinks = screen.getAllByRole("link", { name: "Sara Ahmed" });
    expect(nameLinks.length).toBeGreaterThan(0);
    for (const link of nameLinks) expect(link.getAttribute("href")).toBe("/admin/customers/c1");
    expect(
      screen.getAllByRole("link", { name: "View" }).map((l) => l.getAttribute("href")),
    ).toContain("/admin/customers/c2");
  });

  it("has responsive markup: a table from xl and a card list below it, each with the same rows", () => {
    const { container } = renderList();
    const table = container.querySelector("table")!;
    expect(table.parentElement!.className).toMatch(/hidden .*xl:block/);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(2);
    const cards = container.querySelector("ul")!;
    expect(cards.className).toMatch(/xl:hidden/);
    expect(cards.querySelectorAll("li")).toHaveLength(2);
    expect(table.querySelectorAll("th")).toHaveLength(8);
  });

  it("offers only real filters and keeps the current values in the form", () => {
    renderList({ query: "sara", orders: "withOrders", joined: "thisMonth" });
    expect((screen.getByRole("searchbox") as HTMLInputElement).name).toBe("q");
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("sara");
    const [ordersSelect, joinedSelect] = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect([ordersSelect!.name, ordersSelect!.value]).toEqual(["orders", "withOrders"]);
    expect([joinedSelect!.name, joinedSelect!.value]).toEqual(["joined", "thisMonth"]);
    expect(Array.from(joinedSelect!.options).map((o) => o.value)).toEqual([
      "all",
      "thisMonth",
      "last30",
    ]);
    expect(screen.getByRole("link", { name: "Clear filters" }).getAttribute("href")).toBe(
      "/admin/customers",
    );
  });

  it("shows the filtered empty state with Clear filters", () => {
    renderList({ paged: paginate([], 1), query: "zzz" }, "en", []);
    const empty = screen.getByTestId("customers-empty");
    expect(within(empty).getByRole("heading", { name: "No customers found" })).toBeTruthy();
    expect(within(empty).getByText("There are no customers matching your search.")).toBeTruthy();
    expect(within(empty).getByRole("link", { name: "Clear filters" })).toBeTruthy();
  });

  it("shows a neutral empty state — without Clear filters — when there are no customer accounts", () => {
    renderList({ paged: paginate([], 1) }, "en", []);
    const empty = screen.getByTestId("customers-empty");
    expect(within(empty).getByText(/No customers have registered yet/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Clear filters" })).toBeNull();
  });

  it("pages a long list with real links that keep the active filters", () => {
    const many = Array.from({ length: 45 }, (_, i) => row(`c${i}`, `Customer ${i}`));
    renderList({ paged: paginate(many, 2), query: "cust", orders: "noOrders" }, "en", many);
    expect(screen.getByText("Showing 21–40 of 45 customers")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Customers pages" });
    expect(within(nav).getByRole("link", { name: "Next page" }).getAttribute("href")).toBe(
      "/admin/customers?q=cust&orders=noOrders&page=3",
    );
    expect(within(nav).getByRole("link", { name: "Previous page" }).getAttribute("href")).toBe(
      "/admin/customers?q=cust&orders=noOrders",
    );
    expect(within(nav).getByText("2").getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByTestId("admin-row")).toHaveLength(40); // 20 × (table + cards)
  });

  it("shows no pager for a single page, and says when only the newest customers are loaded", () => {
    renderList({ truncatedTotal: 340, loadedCount: 200 });
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByText("Showing the newest 200 of 340 customers")).toBeTruthy();
  });

  it("renders Arabic without raw translation keys, with an em dash for a missing phone", () => {
    const { container } = renderList({}, "ar");
    expect(screen.getByRole("searchbox").getAttribute("placeholder")).toBe(
      "ابحث بالاسم أو البريد أو الهاتف…",
    );
    expect(within(screen.getAllByTestId("admin-row")[0]!).getByText("لديه طلبات")).toBeTruthy();
    expect(within(screen.getAllByTestId("admin-row")[1]!).getByText("—")).toBeTruthy();
    expect(container.textContent).not.toMatch(
      /AdminCustomers|columns\.|status\.|filters\.|empty\.|footer\./,
    );
  });

  it("has matching English and Arabic keys", () => {
    const keys = (o: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" && v !== null
          ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`],
      );
    expect(keys(ar.AdminCustomers).sort()).toEqual(keys(en.AdminCustomers).sort());
  });
});
