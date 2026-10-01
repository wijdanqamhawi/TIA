import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { formatCurrency } from "@/lib/utils/currency";
import type { Order } from "@/types/order";

/**
 * The customer Order Confirmed body. It lays out the STORED order only: every
 * price is the purchase-time snapshot, never the product's current price.
 */

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({
      locale,
      messages: (locale === "ar" ? ar : en) as never,
      namespace: namespace as never,
    }),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={`/en${href}`} {...rest}>
      {children}
    </a>
  ),
}));

const { OrderConfirmationView } = await import(
  "@/components/storefront/checkout/OrderConfirmationView"
);

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    orderNumber: "ELR-20260930-0007",
    userId: null,
    customerSnapshot: { fullName: "Sara", email: "s@example.com", phone: "0599" },
    deliverySnapshot: {
      regionId: "wb",
      regionName: { en: "West Bank", ar: "الضفة الغربية" },
      locationId: "r",
      locationName: { en: "Ramallah", ar: "رام الله" },
      fullAddress: "Al-Masyoun, Building 12",
    },
    items: [
      {
        productId: "a",
        productName: { en: "Luna Mesh Watch", ar: "ساعة لونا بسوار شبكي" },
        selectedOption: null,
        unitPrice: 12000,
        originalPrice: 24000,
        wasOnSale: true,
        quantity: 4,
      },
      {
        productId: "b",
        productName: { en: "Aurelia Cuff", ar: "سوار أوريليا" },
        selectedOption: {
          optionKey: "color",
          valueKey: "gold",
          label: { en: "Gold", ar: "ذهبي" },
        },
        unitPrice: 18500,
        originalPrice: 18500,
        wasOnSale: false,
        quantity: 1,
      },
    ],
    notes: null,
    paymentMethod: "CASH_ON_DELIVERY",
    status: "PENDING",
    subtotal: 66500,
    total: 66500,
    ...overrides,
  } as Order;
}

async function show(order: Order, locale = "en") {
  const ui = await OrderConfirmationView({
    order,
    locale,
    thumbnails: { a: "https://example.com/luna.jpg", b: null },
  });
  return render(ui);
}

afterEach(cleanup);

describe("OrderConfirmationView", () => {
  it("shows the real order number, title and thank-you", async () => {
    await show(makeOrder());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(en.OrderConfirmation.title);
    expect(screen.getByText(en.OrderConfirmation.thankYou)).toBeTruthy();
    expect(screen.getByTestId("order-number-pill").textContent).toContain("#ELR-20260930-0007");
  });

  it("lists stored items with options and quantities, and the item/unit count", async () => {
    await show(makeOrder());
    const lines = screen.getAllByTestId("confirmation-line");
    expect(lines).toHaveLength(2);
    expect(within(lines[0]).getByText("Luna Mesh Watch")).toBeTruthy();
    expect(within(lines[0]).getByText(/Quantity: 4/)).toBeTruthy();
    expect(within(lines[1]).getByText(/Option: Gold/)).toBeTruthy();
    expect(screen.getByText("2 items • 5 units")).toBeTruthy();
  });

  it("uses the stored prices: line totals, subtotal and total", async () => {
    await show(makeOrder());
    const lines = screen.getAllByTestId("confirmation-line");
    expect(within(lines[0]).getByText(formatCurrency(48000, "en"))).toBeTruthy();
    expect(within(lines[1]).getByText(formatCurrency(18500, "en"))).toBeTruthy();
    expect(screen.getAllByText(formatCurrency(66500, "en"))).toHaveLength(2);
  });

  it("shows the sale display only for lines the snapshot says were bought on sale", async () => {
    await show(makeOrder());
    const [sale, regular] = screen.getAllByTestId("confirmation-line");
    const prices = within(sale).getByTestId("confirmation-unit-price");
    expect(prices.textContent).toContain(formatCurrency(24000, "en"));
    expect(prices.textContent).toContain(formatCurrency(12000, "en"));
    expect(within(sale).getByText(en.Common.onSale)).toBeTruthy();
    expect(within(regular).queryByTestId("confirmation-unit-price")).toBeNull();
    expect(within(regular).queryByText(en.Common.onSale)).toBeNull();
  });

  it("does not invent a sale when wasOnSale is false or originalPrice is not higher", async () => {
    const base = makeOrder();
    await show({ ...base, items: base.items.map((i) => ({ ...i, wasOnSale: false })) });
    expect(screen.queryAllByTestId("confirmation-unit-price")).toHaveLength(0);
    cleanup();
    await show({
      ...base,
      items: base.items.map((i) => ({ ...i, wasOnSale: true, originalPrice: i.unitPrice })),
    });
    expect(screen.queryAllByTestId("confirmation-unit-price")).toHaveLength(0);
  });

  it("shows payment method once, the status pill, region — city and the address", async () => {
    await show(makeOrder({ status: "SHIPPED" }));
    expect(screen.getAllByText(en.OrderConfirmation.cashOnDelivery)).toHaveLength(1);
    const pill = screen.getByTestId("order-status");
    expect(pill.dataset.status).toBe("SHIPPED");
    expect(pill.textContent).toBe(en.OrderStatus.SHIPPED);
    expect(screen.getByText("West Bank — Ramallah")).toBeTruthy();
    expect(screen.getByText("Al-Masyoun, Building 12")).toBeTruthy();
  });

  it("omits the Address row when the order has no address", async () => {
    const base = makeOrder();
    await show({ ...base, deliverySnapshot: { ...base.deliverySnapshot, fullAddress: "" } });
    expect(screen.queryByText(en.OrderConfirmation.address)).toBeNull();
    expect(screen.getByText("West Bank — Ramallah")).toBeTruthy();
  });

  it("links Continue Shopping to the shop", async () => {
    await show(makeOrder());
    const link = screen.getByRole("link", {
      name: new RegExp(en.OrderConfirmation.continueShopping, "i"),
    });
    expect(link.getAttribute("href")).toBe("/en/shop");
  });

  it("renders Arabic with no raw keys or English chrome", async () => {
    await show(makeOrder(), "ar");
    const text = document.body.textContent ?? "";
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(ar.OrderConfirmation.title);
    expect(text).toContain(ar.OrderConfirmation.thankYou);
    expect(text).toContain("ساعة لونا بسوار شبكي");
    expect(text).toContain("الضفة الغربية — رام الله");
    expect(screen.getByTestId("order-status").textContent).toBe(ar.OrderStatus.PENDING);
    expect(text).toContain("#ELR-20260930-0007");
    expect(text).not.toMatch(/OrderConfirmation\.|OrderStatus\.|Common\./);
    expect(text).not.toContain(en.OrderConfirmation.orderSummary);
  });

  it("pins the responsive structure: compact width, 2 cols from md, logical edges, 28–38px title", async () => {
    const { container } = await show(makeOrder());
    const html = container.innerHTML;
    expect(html).toContain("max-w-[720px]");
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("md:grid-cols-2");
    expect(html).toContain("md:border-s");
    expect(html).toContain("md:ps-8");
    expect(html).not.toMatch(/\b(?:ml|mr|pl|pr)-\d/);
    const h1 = screen.getByRole("heading", { level: 1 }).className;
    expect(h1).toContain("2.375rem");
    expect(h1).toContain("1.75rem");
  });

  it("does no pricing of its own — no product/offer lookups in the source", () => {
    const src = readFileSync(
      resolve(__dirname, "../../src/components/storefront/checkout/OrderConfirmationView.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(
      /resolveOfferPricing|getOfferStatus|buildCartSummary|product\.service|firebase/,
    );
  });
});
