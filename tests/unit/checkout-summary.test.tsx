import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { formatCurrency } from "@/lib/utils/currency";
import type { CartSummary, EnrichedCartLine } from "@/lib/domain/cart/cart.service";

/**
 * The Checkout Order Summary column. It only RENDERS the summary that
 * `buildCartSummary` already computed — so an ACTIVE Special Offer's sale price
 * is whatever `lineTotal` says; nothing here prices anything.
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

const { CheckoutSummary } = await import("@/components/storefront/checkout/CheckoutSummary");

type LineProduct = NonNullable<EnrichedCartLine["product"]>;

function line(
  overrides: Partial<Omit<EnrichedCartLine, "product">> & {
    product?: Partial<LineProduct> | null;
  } = {},
): EnrichedCartLine {
  const { product: productOverrides, ...rest } = overrides;
  return {
    productId: "p1",
    selectedOption: null,
    quantity: 2,
    issue: null,
    product:
      productOverrides === null
        ? null
        : {
            slug: "luna",
            name: { en: "Luna Mesh Watch", ar: "ساعة لونا بسوار شبكي" },
            image: {
              url: "https://example.com/luna.jpg",
              storagePath: "x",
              position: 0,
              alt: "",
            } as never,
            price: 12000,
            originalPrice: 24000,
            offerStatus: "DISABLED",
            stock: 8,
            optionLabel: null,
            ...productOverrides,
          },
    lineTotal: 24000,
    ...rest,
  };
}

const summaryOf = (lines: EnrichedCartLine[]): CartSummary => {
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return { lines, subtotal, total: subtotal, hasIssues: false, isEmpty: lines.length === 0 };
};

async function renderSummary(lines: EnrichedCartLine[], locale: "en" | "ar" = "en") {
  return render(await CheckoutSummary({ summary: summaryOf(lines), locale }));
}

afterEach(cleanup);

describe("Checkout Order Summary", () => {
  it("shows each line's thumbnail, name, quantity and line total", async () => {
    await renderSummary([
      line({ quantity: 4, lineTotal: 96000, product: { price: 24000, originalPrice: 24000 } }),
    ]);
    const row = screen.getByTestId("checkout-line");
    expect(within(row).getByText("Luna Mesh Watch")).toBeTruthy();
    expect(within(row).getByText("Quantity: 4")).toBeTruthy();
    expect(within(row).getByText(formatCurrency(96000, "en"))).toBeTruthy();
    expect(row.querySelector("img")!.getAttribute("src")).toBe("https://example.com/luna.jpg");
    expect(within(row).queryByText("Sale")).toBeNull();
  });

  it("uses the shared line total, so an ACTIVE offer is shown at its sale price with a small Sale badge", async () => {
    // ₪240 regular, ₪120 sale, quantity 2 — `buildCartSummary` already made lineTotal ₪240.00 (not ₪480.00).
    await renderSummary([
      line({
        quantity: 2,
        lineTotal: 24000,
        product: { price: 12000, originalPrice: 24000, offerStatus: "ACTIVE" },
      }),
    ]);
    const row = screen.getByTestId("checkout-line");
    expect(within(row).getByText(formatCurrency(24000, "en"))).toBeTruthy();
    expect(within(row).queryByText(formatCurrency(48000, "en"))).toBeNull();
    expect(within(row).getByText("Sale")).toBeTruthy();
  });

  it("shows no sale badge for Scheduled, Expired or Disabled offers", async () => {
    for (const offerStatus of ["SCHEDULED", "EXPIRED", "DISABLED"] as const) {
      const { unmount } = await renderSummary([line({ product: { offerStatus } })]);
      expect(screen.queryByText("Sale"), offerStatus).toBeNull();
      unmount();
    }
  });

  it("subtotal and total are the summary's own numbers, with no invented shipping, tax or discount row", async () => {
    await renderSummary([
      line({ productId: "a", lineTotal: 24000 }),
      line({
        productId: "b",
        quantity: 1,
        lineTotal: 18500,
        product: { name: { en: "Aurelia Cuff", ar: null } },
      }),
    ]);
    const money = formatCurrency(42500, "en");
    const subtotalRow = screen.getByText("Subtotal").closest("div")!;
    const totalRow = screen.getByText("Total").closest("div")!;
    expect(within(subtotalRow).getByText(money)).toBeTruthy();
    expect(within(totalRow).getByText(money)).toBeTruthy();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/shipping|delivery fee|tax|discount|coupon/i);
  });

  it("counts units in the header, is a real heading, and shows an option label when there is one", async () => {
    await renderSummary([
      line({ quantity: 2 }),
      line({
        productId: "b",
        quantity: 1,
        selectedOption: { optionKey: "color", valueKey: "gold" },
        product: { optionLabel: { en: "Gold", ar: "ذهبي" } },
      }),
    ]);
    expect(screen.getByRole("heading", { name: "Order Summary" })).toBeTruthy();
    expect(screen.getByText("3 items")).toBeTruthy();
    expect(screen.getByText("Option: Gold")).toBeTruthy();
  });

  it("falls back to the TIA mark when a product has no real photo", async () => {
    await renderSummary([line({ product: { image: null } })]);
    expect(screen.getByTestId("checkout-line").querySelector("img")!.getAttribute("src")).toBe(
      "/brand/logo.svg",
    );
  });

  it("the reassurance card reuses the storefront's existing trust copy — no new promises", async () => {
    await renderSummary([line()]);
    const card = screen.getByRole("heading", { name: "Why Shop with TIA?" }).closest("section")!;
    for (const key of [
      "benefitQualityTitle",
      "benefitQualityBody",
      "benefitSecureTitle",
      "benefitSecureBody",
      "benefitReturnsTitle",
      "benefitReturnsBody",
    ] as const) {
      expect(within(card).getByText(en.Home[key]), key).toBeTruthy();
    }
    expect(card.textContent).not.toMatch(/fast|guarantee|free|days|24|48|hour/i);
  });

  it("is fully translated in Arabic, with Arabic quantity, totals and trust copy", async () => {
    const { container } = await renderSummary([line({ quantity: 4, lineTotal: 96000 })], "ar");
    expect(screen.getByRole("heading", { name: "ملخص الطلب" })).toBeTruthy();
    expect(screen.getByText("ساعة لونا بسوار شبكي")).toBeTruthy();
    expect(screen.getByText("الكمية: 4")).toBeTruthy();
    expect(screen.getByText("المجموع الفرعي")).toBeTruthy();
    expect(screen.getByText("الإجمالي")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "لماذا تتسوقين من تيا؟" })).toBeTruthy();
    expect(screen.getByText(ar.Home.benefitSecureBody)).toBeTruthy();
    expect(container.textContent).not.toMatch(/Checkout\.|Home\.|itemCount|whyTitle/);
  });

  it("does no pricing of its own: no offer or price calculation in the component", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/storefront/checkout/CheckoutSummary.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(
      /resolveOfferPricing|getOfferStatus|getEffectivePrice|originalPrice|salePrice/,
    );
    expect(source).not.toMatch(/\*\s*line\.quantity|line\.quantity\s*\*/);
  });
});
