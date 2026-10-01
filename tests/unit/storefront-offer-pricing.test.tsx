import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { OfferPrice } from "@/components/ui/Price";
import { getOfferStatus, resolveOfferPricing } from "@/lib/domain/catalog/offer";
import { formatCurrency } from "@/lib/utils/currency";
import type { Product } from "@/types/product";

/**
 * Storefront Special Offers display: an ACTIVE offer shows the crossed-out
 * regular price + the sale price; Scheduled / Expired / Disabled show only the
 * regular price. The data mirrors the real "Luna Mesh Watch" (regular ₪240.00,
 * sale ₪50.00, 17:55–18:55 UTC on 2026-09-30) at three frozen instants.
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
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { FeaturePiece } = await import("@/components/storefront/home/FeaturePiece");

const at = (iso: string) => new Date(iso);
const START = at("2026-09-30T17:55:00Z");
const END = at("2026-09-30T18:55:00Z");
const ts = (date: Date) => ({ toMillis: () => date.getTime(), toDate: () => date });

const LUNA = {
  id: "luna-mesh-watch",
  slug: "luna-mesh-watch",
  name: { en: "Luna Mesh Watch", ar: "ساعة لونا" },
  material: { en: "Steel", ar: "فولاذ" },
  images: [],
  price: 24000,
  isOnSale: true,
  salePrice: 5000,
  saleStartAt: ts(START),
  saleEndAt: ts(END),
} as unknown as Product;

const BEFORE = at("2026-09-30T16:14:00Z"); // what production looked like when reported
const DURING = at("2026-09-30T18:00:00Z");
const AFTER = at("2026-09-30T19:00:00Z");

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("Luna Mesh Watch across its offer window (existing offer fields, no new data)", () => {
  it("is SCHEDULED before the start — the customer keeps seeing the regular price", () => {
    vi.setSystemTime(BEFORE);
    expect(getOfferStatus(LUNA, { toMillis: () => Date.now() })).toBe("SCHEDULED");
    expect(resolveOfferPricing(LUNA)).toEqual({ offerStatus: "SCHEDULED", effectivePrice: 24000 });
  });

  it("is ACTIVE inside the window at the sale price, and EXPIRED after it at the regular price", () => {
    vi.setSystemTime(DURING);
    expect(resolveOfferPricing(LUNA)).toEqual({ offerStatus: "ACTIVE", effectivePrice: 5000 });
    vi.setSystemTime(AFTER);
    expect(resolveOfferPricing(LUNA)).toEqual({ offerStatus: "EXPIRED", effectivePrice: 24000 });
  });
});

describe("OfferPrice", () => {
  function renderPrice(status: "ACTIVE" | "SCHEDULED" | "EXPIRED" | "DISABLED", locale = "en") {
    return render(
      <OfferPrice
        price={24000}
        effectivePrice={status === "ACTIVE" ? 5000 : 24000}
        offerStatus={status}
        locale={locale}
        originalPriceLabel="Original price"
        salePriceLabel="Sale price"
      />,
    );
  }

  it("ACTIVE: the regular price crossed out and the sale price prominent", () => {
    const { container } = renderPrice("ACTIVE");
    const original = container.querySelector(".line-through");
    expect(original?.textContent).toBe(formatCurrency(24000, "en"));
    expect(original?.textContent).toContain("240.00");
    const sale = container.querySelector(".text-brand-burgundy");
    expect(sale?.textContent).toBe(formatCurrency(5000, "en"));
    expect(sale?.textContent).toContain("50.00");
    // Screen readers get both, with labels.
    expect(container.querySelector(".sr-only")?.textContent).toContain("Original price");
    expect(container.querySelector(".sr-only")?.textContent).toContain("Sale price");
  });

  it.each(["SCHEDULED", "EXPIRED", "DISABLED"] as const)(
    "%s: only the regular price — never the sale price, never a strikethrough",
    (status) => {
      const { container } = renderPrice(status);
      expect(container.textContent).toBe(formatCurrency(24000, "en"));
      expect(container.textContent).not.toContain("50.00");
      expect(container.querySelector(".line-through")).toBeNull();
    },
  );

  it("works in Arabic with the same shape (RTL flow comes from the document direction)", () => {
    const { container } = renderPrice("ACTIVE", "ar");
    expect(container.querySelector(".line-through")?.textContent).toBe(formatCurrency(24000, "ar"));
    expect(container.querySelector(".text-brand-burgundy")?.textContent).toBe(
      formatCurrency(5000, "ar"),
    );
  });
});

describe("homepage FeaturePiece price", () => {
  async function renderFeature(now: Date, locale: "en" | "ar" = "en") {
    vi.setSystemTime(now);
    render(await FeaturePiece({ product: LUNA, categoryName: null, locale }));
  }

  it("ACTIVE offer: crossed-out regular price and the sale price (it used to show only the sale price)", async () => {
    await renderFeature(DURING);
    const price = screen.getByText(en.Home.piecePrice).closest("div")!;
    expect(price.querySelector(".line-through")?.textContent).toBe(formatCurrency(24000, "en"));
    expect(price.textContent).toContain(formatCurrency(5000, "en"));
  });

  it("SCHEDULED offer: only the regular price, the future sale price is not exposed", async () => {
    await renderFeature(BEFORE);
    const price = screen.getByText(en.Home.piecePrice).closest("div")!;
    expect(price.querySelector(".line-through")).toBeNull();
    expect(price.textContent).toContain(formatCurrency(24000, "en"));
    expect(price.textContent).not.toContain("50.00");
  });

  it("EXPIRED offer: only the regular price", async () => {
    await renderFeature(AFTER);
    const price = screen.getByText(en.Home.piecePrice).closest("div")!;
    expect(price.querySelector(".line-through")).toBeNull();
    expect(price.textContent).toContain(formatCurrency(24000, "en"));
  });

  it("renders in Arabic", async () => {
    await renderFeature(DURING, "ar");
    const price = screen.getByText(ar.Home.piecePrice).closest("div")!;
    expect(price.querySelector(".line-through")?.textContent).toBe(formatCurrency(24000, "ar"));
  });
});

describe("one pricing rule everywhere", () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

  it("cart, checkout, order creation and wishlist all price through resolveOfferPricing", () => {
    for (const file of [
      "src/lib/domain/cart/cart.service.ts",
      "src/lib/domain/checkout/checkout.service.ts",
      "src/lib/domain/orders/order.service.ts",
      "src/lib/domain/wishlist/wishlist.service.ts",
    ]) {
      expect(read(file), file).toMatch(
        /import \{[^}]*resolveOfferPricing[^}]*\} from "@\/lib\/domain\/catalog\/offer"/,
      );
    }
  });

  it("every 'Sale' badge on the storefront uses the Champagne Gold variant", () => {
    const files = [
      "src/components/storefront/ProductCard.tsx",
      "src/components/storefront/QuickView.tsx",
      "src/components/storefront/WishlistItemCard.tsx",
      "src/components/storefront/ProductPurchasePanel.tsx",
    ];
    let seen = 0;
    for (const file of files) {
      for (const [, variant] of read(file).matchAll(
        /<Badge variant="(\w+)"[^>]*>\s*\{t(?:Common)?\("onSale"\)\}/g,
      )) {
        seen += 1;
        expect(variant, file).toBe("gold");
      }
    }
    expect(seen).toBeGreaterThanOrEqual(5);
  });
});
