import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { formatCurrency } from "@/lib/utils/currency";
import type { Order, OrderStatus } from "@/types/order";

/**
 * The redesigned Admin Order Details page: stored (historical) data only, the shared status pill and its
 * protected flow, EN/AR and the compact responsive structure. The server action is mocked — nothing
 * touches Firebase and no order is changed.
 */

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock, push: vi.fn() }) }));
const statusMock = vi.fn();
vi.mock("@/actions/admin/order.actions", () => ({
  updateOrderStatusAction: (input: unknown) => statusMock(input),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

const { AdminOrderDetailView } = await import("@/components/admin/AdminOrderDetailView");

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  refreshMock.mockReset();
  statusMock.mockReset();
  statusMock.mockResolvedValue({ ok: true, data: null });
});
afterEach(cleanup);

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    orderNumber: "ELR-20260930-0007",
    userId: "u1",
    customerSnapshot: {
      fullName: "Sara Khalil",
      email: "sara@example.com",
      phone: "+970599000000",
    },
    deliverySnapshot: {
      regionId: "west-bank",
      regionName: { en: "West Bank", ar: "الضفة الغربية" },
      locationId: "ramallah",
      locationName: { en: "Ramallah", ar: "رام الله" },
      fullAddress: "Al-Masyoun, Building 12",
    },
    items: [
      {
        productId: "watch",
        productName: { en: "Luna Mesh Watch", ar: "ساعة لونا" },
        selectedOption: null,
        // Bought on sale: 120 paid, regular 240 (the product may be back at 240, or deleted, today).
        unitPrice: 12000,
        originalPrice: 24000,
        wasOnSale: true,
        quantity: 4,
      },
      {
        productId: "cuff",
        productName: { en: "Aurelia Cuff", ar: "سوار أوريليا" },
        selectedOption: { optionKey: "color", valueKey: "gold", label: { en: "Gold", ar: "ذهبي" } },
        unitPrice: 18500,
        originalPrice: 18500,
        wasOnSale: false,
        quantity: 1,
      },
    ],
    notes: "Please call before delivery",
    paymentMethod: "CASH_ON_DELIVERY",
    status: "PENDING",
    subtotal: 66500,
    total: 66500,
    createdAt: { toDate: () => new Date("2026-09-30T10:30:00Z") },
    ...overrides,
  } as unknown as Order;
}

function renderPage(
  order: Order = makeOrder(),
  locale: "en" | "ar" = "en",
  thumbnails: Record<string, string | null> = { watch: "https://example.com/watch.jpg" },
) {
  const messages = locale === "en" ? en : ar;
  const t = createTranslator({
    locale,
    messages: { AdminOrders: messages.AdminOrders } as never,
    namespace: "AdminOrders" as never,
  }) as unknown as (key: string, values?: Record<string, string | number>) => string;
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ AdminOrders: messages.AdminOrders } as never}
    >
      <AdminOrderDetailView t={t} locale={locale} order={order} thumbnails={thumbnails} />
    </NextIntlClientProvider>,
  );
}

const money = (minor: number) => formatCurrency(minor, "en-US");
const lines = () => screen.getAllByTestId("admin-order-line");
const toggle = () => screen.getByTestId("order-status-toggle") as HTMLButtonElement;
const openMenu = () => fireEvent.click(toggle());
const option = (status: string) =>
  document.querySelector(`[data-status-option="${status}"]`) as HTMLButtonElement | null;
const badges = () => screen.getAllByTestId("order-status-badge");

describe("header and summary cards", () => {
  it("shows the real order number, the placed date/time and a way back to the orders list", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("ELR-20260930-0007");
    expect(screen.getByText(/Placed on Sep 30, 2026/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to orders" }).getAttribute("href")).toBe(
      "/admin/orders",
    );
  });

  it("has the four cards: total, items (with units), payment method and current status", () => {
    renderPage();
    expect(screen.getByText("Order Total")).toBeTruthy();
    expect(screen.getAllByText(money(66500)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Items")).toBeTruthy();
    expect(screen.getByText("5 units")).toBeTruthy(); // 4 + 1
    expect(screen.getByText("Payment Method", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("Current Status")).toBeTruthy();
  });
});

describe("historical order data", () => {
  it("shows each line's stored name, option, quantity, unit price and line total", () => {
    renderPage();
    expect(lines()).toHaveLength(2);
    const [watch, cuff] = lines();
    expect(within(watch).getByText("Luna Mesh Watch")).toBeTruthy();
    expect(watch.textContent).toContain("Qty: 4");
    expect(within(watch).getByTestId("admin-line-total").textContent).toBe(money(12000 * 4));
    expect(within(cuff).getByTestId("admin-option").textContent).toBe("Option: Gold");
    expect(within(cuff).getByTestId("admin-line-total").textContent).toBe(money(18500));
  });

  it("shows the Sale badge with the crossed-out original and paid price only for a stored sale line", () => {
    renderPage();
    const [watch, cuff] = lines();
    const prices = within(watch).getByTestId("admin-unit-price");
    expect(prices.querySelector("s")?.textContent).toBe(money(24000));
    expect(prices.textContent).toContain(money(12000));
    expect(within(watch).getByText("Sale")).toBeTruthy();
    expect(within(cuff).queryByText("Sale")).toBeNull();
    expect(within(cuff).getByTestId("admin-unit-price").querySelector("s")).toBeNull();
  });

  it("does not invent a sale when wasOnSale is false or the stored original is not higher", () => {
    const base = makeOrder();
    renderPage({ ...base, items: base.items.map((i) => ({ ...i, wasOnSale: false })) } as Order);
    expect(screen.queryByText("Sale")).toBeNull();
    cleanup();
    renderPage({
      ...base,
      items: base.items.map((i) => ({ ...i, wasOnSale: true, originalPrice: i.unitPrice })),
    } as Order);
    expect(screen.queryByText("Sale")).toBeNull();
  });

  it("displays the STORED subtotal and total (not a recomputation from anything else)", () => {
    // Deliberately different from the sum of the lines: the page must show what the order recorded.
    renderPage(makeOrder({ subtotal: 11111, total: 22222 }));
    expect(screen.getByTestId("admin-subtotal").textContent).toBe(money(11111));
    expect(screen.getByTestId("admin-total").textContent).toBe(money(22222));
  });

  it("still renders a historical order whose products were deleted, using the fallback image", () => {
    renderPage(makeOrder(), "en", {}); // no product photos at all
    expect(lines()).toHaveLength(2);
    const images = lines().map((line) => line.querySelector("img")!.getAttribute("src"));
    expect(images.every((src) => src === "/brand/logo.svg")).toBe(true);
    // Names and prices come from the order, so nothing is lost.
    expect(within(lines()[0]).getByText("Luna Mesh Watch")).toBeTruthy();
    expect(within(lines()[0]).getByTestId("admin-line-total").textContent).toBe(money(48000));
  });

  it("uses the real photo when the product still has one", () => {
    renderPage();
    expect(lines()[0].querySelector("img")!.getAttribute("src")).toBe(
      "https://example.com/watch.jpg",
    );
  });

  it("the view does no pricing of its own — no product, offer or cart lookups", () => {
    const src = readFileSync(
      resolve(__dirname, "../../src/components/admin/AdminOrderDetailView.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(
      /resolveOfferPricing|getOfferStatus|buildCartSummary|product\.service|firebase/,
    );
  });
});

describe("customer, delivery and order information", () => {
  it("lists the customer's name, email and phone with Registered / Guest", () => {
    renderPage();
    const card = screen.getByRole("region", { name: "Customer & Delivery" });
    expect(within(card).getByText("Sara Khalil")).toBeTruthy();
    expect(within(card).getByText("sara@example.com")).toBeTruthy();
    expect(within(card).getByText("+970599000000")).toBeTruthy();
    expect(screen.getByTestId("customer-type").textContent).toBe("Registered customer");
    cleanup();
    renderPage(makeOrder({ userId: null }));
    expect(screen.getByTestId("customer-type").textContent).toBe("Guest checkout");
  });

  it("lists region, city, full address and notes only when present", () => {
    renderPage();
    const card = screen.getByRole("region", { name: "Customer & Delivery" });
    expect(within(card).getByTestId("delivery-destination").textContent).toBe(
      "West Bank — Ramallah",
    );
    expect(within(card).getByText("Al-Masyoun, Building 12")).toBeTruthy();
    expect(within(card).getByText("Please call before delivery")).toBeTruthy();
    cleanup();
    renderPage(makeOrder({ notes: null }));
    expect(screen.queryByText("Notes")).toBeNull();
  });

  it("Order Information shows number, placed date, payment, status and where it is delivering to", () => {
    renderPage();
    const info = screen.getByRole("region", { name: "Order Information" });
    expect(within(info).getByText("Order Number")).toBeTruthy();
    expect(within(info).getByText("ELR-20260930-0007")).toBeTruthy();
    expect(within(info).getByText("Placed Date")).toBeTruthy();
    expect(within(info).getByText(/Sep 30, 2026/)).toBeTruthy();
    expect(within(info).getByText("Cash on Delivery")).toBeTruthy();
    expect(within(info).getByTestId("order-status-badge").textContent).toBe("Pending");
    expect(within(info).getByTestId("delivering-to").textContent).toBe("West Bank — Ramallah");
  });

  it("the Order Items card carries the stored subtotal and total", () => {
    renderPage();
    const items = screen.getByRole("region", { name: "Order Items" });
    expect(within(items).getByTestId("admin-subtotal").textContent).toBe(money(66500));
    expect(within(items).getByTestId("admin-total").textContent).toBe(money(66500));
  });

  it("has no Edit Customer button — that functionality does not exist", () => {
    renderPage();
    expect(screen.queryByText(/Edit Customer/i)).toBeNull();
  });
});

describe("the status control (Admin > Orders flow, one order)", () => {
  it("is a clickable pill offering ONLY the valid next statuses", () => {
    renderPage();
    expect(toggle().textContent).toContain("Pending");
    openMenu();
    expect(option("CONFIRMED")).toBeTruthy();
    expect(option("CANCELLED")).toBeTruthy();
    for (const hidden of ["PREPARING", "SHIPPED", "DELIVERED", "PENDING"])
      expect(option(hidden)).toBeNull();
  });

  it("follows the existing transition table for every status", () => {
    const expected: Record<OrderStatus, string[]> = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["PREPARING", "CANCELLED"],
      PREPARING: ["SHIPPED", "CANCELLED"],
      SHIPPED: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: [],
    };
    for (const [status, next] of Object.entries(expected)) {
      renderPage(makeOrder({ status: status as OrderStatus }));
      if (next.length === 0) {
        expect(screen.queryByTestId("order-status-toggle")).toBeNull();
      } else {
        openMenu();
        const offered = Array.from(document.querySelectorAll("[data-status-option]")).map((el) =>
          el.getAttribute("data-status-option"),
        );
        expect(offered).toEqual(next);
      }
      cleanup();
    }
  });

  it("a final status is a plain badge, not a control", () => {
    renderPage(makeOrder({ status: "DELIVERED" }));
    expect(screen.queryByTestId("order-status-toggle")).toBeNull();
    expect(badges().every((b) => b.textContent === "Delivered")).toBe(true);
  });

  it("choosing a status calls the protected action and updates the pill, the card and the info row at once", async () => {
    let release!: (value: unknown) => void;
    statusMock.mockReturnValue(new Promise((resolveAction) => (release = resolveAction)));
    renderPage();
    openMenu();
    fireEvent.click(option("CONFIRMED")!);
    expect(statusMock).toHaveBeenCalledWith({ orderId: "o1", status: "CONFIRMED" });
    // Optimistic everywhere, while saving.
    await waitFor(() => expect(toggle().textContent).toContain("Confirmed"));
    expect(badges().length).toBe(2);
    expect(badges().every((b) => b.textContent === "Confirmed")).toBe(true);
    release({ ok: true, data: null });
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("ignores a second change while one is saving", async () => {
    let release!: (value: unknown) => void;
    statusMock.mockReturnValue(new Promise((resolveAction) => (release = resolveAction)));
    renderPage();
    openMenu();
    fireEvent.click(option("CONFIRMED")!);
    await waitFor(() => expect(toggle().getAttribute("aria-disabled")).toBe("true"));
    fireEvent.click(toggle());
    expect(document.querySelector("[role=menu]")).toBeNull();
    expect(statusMock).toHaveBeenCalledTimes(1);
    release({ ok: true, data: null });
  });

  it("rolls back and explains when the server refuses the change", async () => {
    statusMock.mockResolvedValue({
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message: "Cannot change status from PENDING to CONFIRMED.",
      },
    });
    renderPage();
    openMenu();
    fireEvent.click(option("CONFIRMED")!);
    expect((await screen.findByTestId("status-notice")).textContent).toContain(
      "Cannot change status",
    );
    expect(badges().every((b) => b.textContent === "Pending")).toBe(true);
    expect(refreshMock).toHaveBeenCalledTimes(1); // shows the order's real state
  });

  it("rolls back with the generic message when the request itself fails", async () => {
    statusMock.mockRejectedValue(new Error("offline"));
    renderPage();
    openMenu();
    fireEvent.click(option("CONFIRMED")!);
    expect((await screen.findByTestId("status-notice")).textContent).toBe(
      en.AdminOrders.statusMenu.failed,
    );
    expect(badges().every((b) => b.textContent === "Pending")).toBe(true);
  });

  it("Cancelling asks for confirmation first; backing out changes nothing", async () => {
    renderPage();
    openMenu();
    fireEvent.click(option("CANCELLED")!);
    expect(statusMock).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog", { hidden: true });
    expect(dialog.textContent).toContain("Cancel this order?");
    fireEvent.click(within(dialog).getByText(en.AdminOrders.statusMenu.back));
    expect(screen.queryByRole("alertdialog", { hidden: true })).toBeNull();
    expect(statusMock).not.toHaveBeenCalled();
    expect(badges().every((b) => b.textContent === "Pending")).toBe(true);
  });

  it("confirming the cancellation runs the protected action", async () => {
    renderPage();
    openMenu();
    fireEvent.click(option("CANCELLED")!);
    fireEvent.click(
      within(screen.getByRole("alertdialog", { hidden: true })).getByText("Cancel Order"),
    );
    await waitFor(() =>
      expect(statusMock).toHaveBeenCalledWith({ orderId: "o1", status: "CANCELLED" }),
    );
  });

  it("reuses the existing status pill and transition code — no second status system", () => {
    const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
    const status = read("src/components/admin/AdminOrderStatus.tsx");
    expect(status).toContain("OrderStatusMenu");
    expect(status).toContain("getAllowedNextStatuses");
    expect(status).toContain("updateOrderStatusAction");
    expect(status).toContain("ORDER_STATUS_TONE");
    expect(read("src/app/admin/orders/[id]/page.tsx")).not.toContain("OrderStatusSelect");
  });
});

describe("Arabic / RTL", () => {
  it("translates the page, uses Arabic data and leaves no raw keys", () => {
    const { container } = renderPage(makeOrder(), "ar");
    const text = container.textContent ?? "";
    expect(text).toContain("العودة إلى الطلبات");
    expect(text).toContain("منتجات الطلب");
    expect(text).toContain("العميل والتوصيل");
    expect(text).toContain("معلومات الطلب");
    expect(text).toContain("ساعة لونا");
    expect(text).toContain("الضفة الغربية");
    expect(text).toContain("رام الله");
    expect(text).toContain("الدفع عند الاستلام");
    expect(text).toContain("تخفيض");
    expect(text).not.toMatch(/AdminOrders\.|detail\./);
  });

  it("status labels and units are Arabic, and email/phone/order number stay left-to-right", () => {
    renderPage(makeOrder(), "ar");
    expect(toggle().textContent).toContain(ar.AdminOrders.status.PENDING);
    expect(badges().every((b) => b.textContent === ar.AdminOrders.status.PENDING)).toBe(true);
    expect(screen.getByText("sara@example.com").closest("bdi")?.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText("+970599000000").closest("bdi")?.getAttribute("dir")).toBe("ltr");
    expect(
      screen.getByRole("heading", { level: 1 }).querySelector('bdi[dir="ltr"]')?.textContent,
    ).toBe("ELR-20260930-0007");
  });

  it("uses only logical (mirroring) spacing", () => {
    const { container } = renderPage(makeOrder(), "ar");
    expect(container.innerHTML).not.toMatch(/\b(?:ml|mr|pl|pr)-\d/);
  });
});

describe("compact responsive structure", () => {
  it("stacks on small screens; 2 columns from xl; cards 1 → 2 → 4 columns", () => {
    const { container } = renderPage();
    const html = container.innerHTML;
    expect(html).toContain("grid-cols-1 gap-3 sm:grid-cols-2");
    expect(html).toContain("xl:grid-cols-4");
    expect(html).toContain("xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]");
    expect(html).toContain("contents xl:flex"); // the two columns only exist from xl
    expect(html).toContain("md:grid-cols-2"); // tablets: two columns
    expect(html).toContain("items-start"); // columns are not stretched to the tallest card
  });
});

describe("the items table", () => {
  it("has the reference's columns, and an empty Option shows a dash", () => {
    const { container } = renderPage();
    const header = container.querySelector('[aria-hidden="true"].hidden');
    expect(header?.textContent).toBe("ProductOptionQtyUnit PriceTotal");
    const [watch, cuff] = lines();
    expect(within(watch).getByTestId("admin-option").textContent).toBe("—");
    expect(within(cuff).getByTestId("admin-option").textContent).toBe("Option: Gold");
  });
});

describe("the Order Timeline — real data only", () => {
  const steps = () => screen.getAllByTestId("timeline-step");
  const summary = () =>
    steps().map((el) => `${el.getAttribute("data-status")}:${el.getAttribute("data-state")}`);

  it("shows Pending → Confirmed → Preparing → Shipped → Delivered with the current step marked", () => {
    renderPage(makeOrder({ status: "CONFIRMED" }));
    expect(summary()).toEqual([
      "PENDING:done",
      "CONFIRMED:current",
      "PREPARING:upcoming",
      "SHIPPED:upcoming",
      "DELIVERED:upcoming",
    ]);
    expect(steps()[1].getAttribute("aria-current")).toBe("step");
    expect(steps()[1].textContent).toContain("Current");
    expect(steps()[2].textContent).toContain("Processing"); // the admin's own name for PREPARING
  });

  it("a Pending order has only the first step current; a Delivered one has every earlier step done", () => {
    renderPage(makeOrder({ status: "PENDING" }));
    expect(summary()[0]).toBe("PENDING:current");
    expect(
      summary()
        .slice(1)
        .every((entry) => entry.endsWith(":upcoming")),
    ).toBe(true);
    cleanup();
    renderPage(makeOrder({ status: "DELIVERED" }));
    expect(summary()).toEqual([
      "PENDING:done",
      "CONFIRMED:done",
      "PREPARING:done",
      "SHIPPED:done",
      "DELIVERED:current",
    ]);
  });

  it("shows the placed time on the first step ONLY — no times are invented for later steps", () => {
    renderPage(makeOrder({ status: "SHIPPED" }));
    const timeline = screen.getByTestId("order-timeline");
    expect(timeline.textContent!.match(/Sep 30, 2026/g)).toHaveLength(1);
    expect(steps()[0].textContent).toContain("Sep 30, 2026");
    for (const step of steps().slice(1)) expect(step.textContent).not.toMatch(/2026|AM|PM/);
    expect(timeline.textContent).toContain(en.AdminOrders.detail.timeline.note);
  });

  it("a Cancelled order shows only its placement and the cancellation — it does not guess the steps between", () => {
    renderPage(makeOrder({ status: "CANCELLED" }));
    expect(summary()).toEqual(["PENDING:done", "CANCELLED:current"]);
    expect(steps()[1].textContent).toContain("Cancelled");
  });

  it("follows an optimistic status change", async () => {
    let release!: (value: unknown) => void;
    statusMock.mockReturnValue(new Promise((resolveAction) => (release = resolveAction)));
    renderPage();
    openMenu();
    fireEvent.click(option("CONFIRMED")!);
    await waitFor(() => expect(summary()[1]).toBe("CONFIRMED:current"));
    release({ ok: true, data: null });
  });

  it("is in Arabic with the same structure", () => {
    renderPage(makeOrder({ status: "CONFIRMED" }), "ar");
    expect(screen.getByRole("region", { name: "مسار الطلب" })).toBeTruthy();
    expect(steps()[1].textContent).toContain(ar.AdminOrders.status.CONFIRMED);
    expect(steps()[1].textContent).toContain("الحالية");
    expect(screen.getByTestId("order-timeline").textContent).toContain(
      ar.AdminOrders.detail.timeline.note,
    );
  });
});
