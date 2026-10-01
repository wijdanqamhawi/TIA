import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider, createTranslator, useLocale } from "next-intl";
import { Timestamp } from "firebase-admin/firestore";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

/**
 * The homepage Special Offers row and the standalone /[locale]/offers page.
 * Both read the ONE shared selection, `getSpecialOffers` (ACTIVE offers only;
 * the real function runs here over an in-memory store). The row renders
 * nothing when there are no active offers; the page shows its empty state.
 */

// ── fakes ─────────────────────────────────────────────────────────────────
type Doc = Record<string, unknown>;
const store = new Map<string, Doc>();

type FakeQuery = {
  where(field: string, op: string, value: unknown): FakeQuery;
  orderBy(): FakeQuery;
  limit(n: number): FakeQuery;
  get(): Promise<{ docs: Array<{ data: () => Doc }> }>;
};
function query(filters: Array<[string, unknown]> = [], max = Infinity): FakeQuery {
  return {
    where: (field, _op, value) => query([...filters, [field, value]], max),
    orderBy: () => query(filters, max),
    limit: (n) => query(filters, n),
    get: async () => ({
      docs: [...store.values()]
        .filter((doc) => filters.every(([field, value]) => doc[field] === value))
        .slice(0, max)
        .map((doc) => ({ data: () => doc })),
    }),
  };
}
vi.mock("@/lib/firebase/firestore", () => ({ productsCollection: () => query() }));

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({
      locale,
      messages: (locale === "ar" ? ar : en) as never,
      namespace: namespace as never,
    }),
}));
// Stand-in for the next-intl `Link` (which cannot load under Vitest): with `localePrefix: "always"`
// (pinned by a test below) it prefixes the current locale to every internal href.
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => {
    const locale = useLocale();
    return (
      <a href={`/${locale}${href === "/" ? "" : href}`} {...rest}>
        {children}
      </a>
    );
  },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
// The shared card carries wishlist / cart / Quick View behaviour and is tested on its own; here it is a marker.
vi.mock("@/components/storefront/ProductCard", () => ({
  ProductCard: ({ product, variant }: { product: { name: { en: string } }; variant?: string }) => (
    <article data-testid="product-card" data-variant={variant ?? "grid"}>
      {product.name.en}
    </article>
  ),
}));
vi.mock("@/lib/domain/wishlist/wishlist.service", () => ({
  getWishlistedProductIds: async () => new Set<string>(),
}));
vi.mock("@/lib/seo/metadata", () => ({ buildLocalizedMetadata: (x: unknown) => x }));

const { getSpecialOffers } = await import("@/lib/domain/catalog/product.service");
const { SpecialOffersStrip } = await import("@/components/storefront/home/SpecialOffersStrip");
const { default: OffersPage } = await import("@/app/[locale]/(storefront)/offers/page");

// ── fixtures: the same product in every offer state ───────────────────────
const NOW = new Date("2026-09-30T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => Timestamp.fromMillis(NOW.getTime() + hours * HOUR);

function product(id: string, name: string, overrides: Doc = {}): Doc {
  return {
    id,
    name: { en: name, ar: null },
    slug: id,
    images: [],
    options: [],
    price: 24000,
    stock: 5,
    availability: true,
    isNewArrival: false,
    isBestSeller: false,
    isOnSale: false,
    salePrice: null,
    saleStartAt: null,
    saleEndAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  store.clear();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const seed = (...products: Doc[]) => products.forEach((p) => store.set(p["id"] as string, p));
const ids = async (limit?: number) => (await getSpecialOffers(limit)).map((p) => p.id);

describe("getSpecialOffers — the shared selection behind the homepage row and /offers", () => {
  it("includes a product whose offer is ACTIVE right now", async () => {
    seed(
      product("active", "Active Watch", {
        isOnSale: true,
        salePrice: 12000,
        saleStartAt: at(-2),
        saleEndAt: at(5),
      }),
    );
    expect(await ids()).toEqual(["active"]);
  });

  it("includes an undated offer (active until an admin stops it)", async () => {
    seed(product("open", "Open Offer", { isOnSale: true, salePrice: 12000 }));
    expect(await ids()).toEqual(["open"]);
  });

  it("does NOT include a SCHEDULED offer — the future sale price is not exposed", async () => {
    seed(
      product("scheduled", "Scheduled Watch", {
        isOnSale: true,
        salePrice: 12000,
        saleStartAt: at(3),
      }),
    );
    expect(await ids()).toEqual([]);
  });

  it("does NOT include an EXPIRED offer", async () => {
    seed(
      product("expired", "Expired Watch", { isOnSale: true, salePrice: 12000, saleEndAt: at(-1) }),
    );
    expect(await ids()).toEqual([]);
  });

  it("does NOT include a DISABLED offer (stopped by an admin, stored details kept)", async () => {
    seed(
      product("disabled", "Stopped Watch", {
        isOnSale: false,
        salePrice: 12000,
        saleStartAt: at(-2),
        saleEndAt: at(5),
      }),
      product("flagOnly", "Flag Without Price", { isOnSale: true, salePrice: null }),
    );
    expect(await ids()).toEqual([]);
  });

  it("does not include Sold Out or hidden products, even with an active offer", async () => {
    seed(
      product("soldOut", "Sold Out Watch", { isOnSale: true, salePrice: 12000, stock: 0 }),
      product("hidden", "Hidden Watch", { isOnSale: true, salePrice: 12000, availability: false }),
    );
    expect(await ids()).toEqual([]);
  });

  it("follows the clock: the same product appears once it becomes Active and leaves when it expires", async () => {
    seed(
      product("timed", "Timed Watch", {
        isOnSale: true,
        salePrice: 12000,
        saleStartAt: at(1),
        saleEndAt: at(3),
      }),
    );
    expect(await ids()).toEqual([]); // scheduled
    vi.setSystemTime(new Date(NOW.getTime() + 2 * HOUR));
    expect(await ids()).toEqual(["timed"]); // active
    vi.setSystemTime(new Date(NOW.getTime() + 4 * HOUR));
    expect(await ids()).toEqual([]); // expired
  });

  it("follows an admin: stopping the offer removes it at once, starting it again brings it back", async () => {
    seed(product("p", "Toggled Watch", { isOnSale: true, salePrice: 12000 }));
    expect(await ids()).toEqual(["p"]);
    store.set("p", { ...store.get("p"), isOnSale: false }); // what the status pill writes
    expect(await ids()).toEqual([]);
    store.set("p", { ...store.get("p"), isOnSale: true });
    expect(await ids()).toEqual(["p"]);
  });

  it("only lists the active ones among a mixed catalog, and respects the limit", async () => {
    seed(
      product("a1", "A1", { isOnSale: true, salePrice: 12000 }),
      product("a2", "A2", { isOnSale: true, salePrice: 12000 }),
      product("a3", "A3", { isOnSale: true, salePrice: 12000 }),
      product("s", "Scheduled", { isOnSale: true, salePrice: 12000, saleStartAt: at(3) }),
      product("e", "Expired", { isOnSale: true, salePrice: 12000, saleEndAt: at(-1) }),
      product("d", "Disabled", { isOnSale: false, salePrice: 12000 }),
      product("n", "No offer"),
    );
    expect((await ids()).sort()).toEqual(["a1", "a2", "a3"]);
    expect(await ids(2)).toHaveLength(2);
  });
});

// ── the homepage row ───────────────────────────────────────────────────────
function cardsOf(names: string[]) {
  return names.map((name, i) => ({
    id: `p${i}`,
    slug: `p${i}`,
    name: { en: name, ar: null },
  })) as never[];
}

async function renderStrip(products: never[], locale: "en" | "ar" = "en") {
  const element = await SpecialOffersStrip({ products, locale });
  const messages = (locale === "en" ? en : ar) as never;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("homepage Special Offers row", () => {
  it("shows the active offers as shared product cards in the editorial presentation", async () => {
    await renderStrip(cardsOf(["Luna Mesh Watch", "Amour Band Ring"]));
    const section = screen.getByRole("region", { name: "Special Offers" });
    const cards = within(section).getAllByTestId("product-card");
    expect(cards.map((c) => c.textContent)).toEqual(["Luna Mesh Watch", "Amour Band Ring"]);
    expect(cards.every((c) => c.getAttribute("data-variant") === "editorial")).toBe(true);
  });

  it("renders NOTHING when there are no active offers — no empty section, heading or link", async () => {
    const { container } = await renderStrip([]);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText("Special Offers")).toBeNull();
    expect(screen.queryByRole("link", { name: /View All Offers/ })).toBeNull();
  });

  it("shows a limited number: at most five cards", async () => {
    await renderStrip(cardsOf(["A", "B", "C", "D", "E", "F", "G"]));
    expect(screen.getAllByTestId("product-card")).toHaveLength(5);
  });

  it("has the Shop by Category heading pattern: eyebrow, title, and View All linking to /en/offers — no subtitle", async () => {
    await renderStrip(cardsOf(["A"]));
    const section = screen.getByRole("region", { name: "Special Offers" });
    // Eyebrow (shown uppercase by CSS: SPECIAL OFFERS) + the serif title.
    expect(within(section).getAllByText("Special Offers")).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 2, name: "Special Offers" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View All" }).getAttribute("href")).toBe("/en/offers");
    // Compact: the eyebrow is the only paragraph — no subtitle line, no promotional copy.
    expect(section.querySelectorAll("p")).toHaveLength(1);
  });

  it("in Arabic: عروض خاصة eyebrow, العروض الخاصة title, and عرض الكل linking to /ar/offers", async () => {
    const { container } = await renderStrip(cardsOf(["A"]), "ar");
    const section = screen.getByRole("region", { name: "العروض الخاصة" });
    expect(within(section).getByText("عروض خاصة")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "العروض الخاصة" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "عرض الكل" }).getAttribute("href")).toBe("/ar/offers");
    expect(container.textContent).not.toMatch(/Home\.|specialOffers|viewAll/);
  });

  it("uses direction-neutral (logical / rtl-aware) styling only — it mirrors under RTL by itself", () => {
    const physical = /(?<![\w-])(?:ml|mr|pl|pr|left|right|text-left|text-right)-/;
    for (const file of [
      "src/components/storefront/home/SpecialOffersStrip.tsx",
      "src/components/storefront/home/EditorialRowHeading.tsx",
      "src/app/[locale]/(storefront)/offers/page.tsx",
    ]) {
      const classNames = [
        ...readFileSync(resolve(process.cwd(), file), "utf8").matchAll(/className="([^"]*)"/g),
      ]
        .map((m) => m[1])
        .join(" ");
      expect(classNames, file).not.toMatch(physical);
    }
  });
});

// ── the standalone page ────────────────────────────────────────────────────
async function renderOffersPage(locale: "en" | "ar" = "en") {
  const element = await OffersPage({ params: Promise.resolve({ locale }) });
  const messages = (locale === "en" ? en : ar) as never;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

describe("/[locale]/offers", () => {
  it("lists exactly the active offers (same selection as the homepage), nothing else", async () => {
    seed(
      product("active", "Active Watch", { isOnSale: true, salePrice: 12000 }),
      product("scheduled", "Scheduled Watch", {
        isOnSale: true,
        salePrice: 12000,
        saleStartAt: at(3),
      }),
      product("expired", "Expired Watch", { isOnSale: true, salePrice: 12000, saleEndAt: at(-1) }),
      product("disabled", "Disabled Watch", { isOnSale: false, salePrice: 12000 }),
    );
    await renderOffersPage();
    expect(screen.getByRole("heading", { level: 1, name: "Special Offers" })).toBeTruthy();
    expect(screen.getAllByTestId("product-card").map((c) => c.textContent)).toEqual([
      "Active Watch",
    ]);
    expect(screen.queryByTestId("offers-empty")).toBeNull();
  });

  it("shows its elegant empty state — not a blank grid — when nothing is active", async () => {
    seed(
      product("scheduled", "Scheduled Watch", {
        isOnSale: true,
        salePrice: 12000,
        saleStartAt: at(3),
      }),
    );
    await renderOffersPage();
    const empty = screen.getByTestId("offers-empty");
    expect(within(empty).getByRole("heading", { name: "No offers right now" })).toBeTruthy();
    expect(within(empty).getByRole("link", { name: "Shop All" }).getAttribute("href")).toBe(
      "/en/shop",
    );
    expect(screen.queryByTestId("product-grid")).toBeNull();
  });

  it("is fully translated in Arabic (heading, empty state, locale-prefixed link)", async () => {
    const { container } = await renderOffersPage("ar");
    expect(screen.getByRole("heading", { level: 1, name: "العروض" })).toBeTruthy();
    const empty = screen.getByTestId("offers-empty");
    expect(within(empty).getByRole("heading", { name: "لا توجد عروض حاليًا" })).toBeTruthy();
    expect(within(empty).getByRole("link", { name: "تسوّقي الآن" }).getAttribute("href")).toBe(
      "/ar/shop",
    );
    expect(container.textContent).not.toMatch(/Offers\.|emptyTitle|shopCta/);
  });

  it("has English and Arabic strings for every new key", () => {
    for (const messages of [en, ar]) {
      for (const key of ["title", "subtitle", "emptyTitle", "emptyBody", "shopCta"]) {
        expect((messages.Offers as Record<string, string>)[key], key).toBeTruthy();
      }
      for (const key of ["specialOffers", "specialOffersEyebrow", "viewAll"]) {
        expect((messages.Home as Record<string, string>)[key], key).toBeTruthy();
      }
      // The extra copy from the first version is gone.
      expect(messages.Home).not.toHaveProperty("specialOffersSubtitle");
      expect(messages.Home).not.toHaveProperty("viewAllOffers");
      expect(messages.Seo.offersTitle).toBeTruthy();
      expect(messages.Seo.offersDescription).toBeTruthy();
    }
  });
});

// ── one selection, not two ─────────────────────────────────────────────────
describe("the homepage reuses the offer logic instead of duplicating it", () => {
  const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
  const home = read("src/app/[locale]/(storefront)/page.tsx");
  const offersPage = read("src/app/[locale]/(storefront)/offers/page.tsx");

  it("both read the same getSpecialOffers, and neither re-implements offer status", () => {
    for (const source of [home, offersPage]) {
      expect(source).toMatch(/getSpecialOffers/);
      expect(source).not.toMatch(
        /getOfferStatus|resolveOfferPricing|isOnSale|saleEndAt|saleStartAt/,
      );
    }
  });

  it("the row sits after Shop by Category and before the Less Ordinary banner", () => {
    const order = ["<FeaturedCategories", "<SpecialOffersStrip", "<LessOrdinary"].map((tag) =>
      home.indexOf(tag),
    );
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("the homepage row links to the page that exists", () => {
    const strip = read("src/components/storefront/home/SpecialOffersStrip.tsx");
    expect(strip).toContain('actionHref="/offers"');
  });
});

describe("localized links", () => {
  it("the stand-in Link matches the real routing: locales en/ar, prefix always", async () => {
    const { routing } = await import("@/lib/i18n/routing");
    expect([...routing.locales]).toEqual(["en", "ar"]);
    expect(routing.localePrefix).toBe("always");
  });
});

describe("visual parity with the existing homepage rows", () => {
  const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
  const strip = read("src/components/storefront/home/SpecialOffersStrip.tsx");
  const categories = read("src/components/storefront/FeaturedCategories.tsx");
  const newArrivals = read("src/components/storefront/home/NewArrivalsStrip.tsx");

  it("is built from the same heading component, container and section shell as Shop by Category", () => {
    for (const source of [strip, categories, newArrivals]) {
      expect(source).toContain("EditorialRowHeading");
      expect(source).toContain('className="container-rows"');
      expect(source).toMatch(/overflow-x-clip bg-brand-ivory/);
    }
  });

  it("uses the same row shell as Shop by Category: a plain list (no carousel arrows) in the same grid", () => {
    const shellOf = (source: string) =>
      source
        .match(/className="(scrollbar-none[^"]*)"/)?.[1]
        ?.replace(/lg:grid-cols-\[[^\]]*\]|lg:grid-cols-\d+/, "lg:COLS");
    expect(shellOf(strip)).toBe(shellOf(categories));
    expect(strip).not.toMatch(/CarouselRow/);
  });

  it("has a FIXED five-column grid, never sized to the product count (one offer must not stretch across the row)", () => {
    expect(strip).toContain("lg:grid-cols-5");
    expect(strip).not.toMatch(/grid-cols-\[repeat\(var|--na-cols|Math\.min\(products\.length/);
    expect(strip).toContain("products.slice(0, 5)");
  });

  it("is no roomier than New Arrivals (vertical padding) and adds no banner or card chrome of its own", () => {
    const pad = (source: string) => {
      const m = source.match(/<section[\s\S]*?pb-(\d+)[\s\S]*?pt-(\d+)/);
      return m ? Number(m[1]) + Number(m[2]) : NaN;
    };
    expect(pad(strip)).toBeLessThanOrEqual(pad(newArrivals));
    expect(strip).not.toMatch(/shadow-|bg-brand-burgundy|rounded|aspect-/);
  });

  it("reuses the existing ProductCard (editorial) — no offer-specific card or price markup", () => {
    expect(strip).toMatch(/import \{ ProductCard/);
    expect(strip).toContain('variant="editorial"');
    expect(strip).not.toMatch(
      /formatCurrency|line-through|OfferPrice|getOfferStatus|resolveOfferPricing/,
    );
  });
});
