import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { method: string; args: unknown[] };

/** A minimal chainable Firestore Query fake that records every call made on it. */
function createFakeQuery(calls: Call[]) {
  const query: Record<string, unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return query;
  };
  query.where = chain("where");
  query.orderBy = chain("orderBy");
  query.limit = chain("limit");
  query.startAfter = chain("startAfter");
  query.get = vi.fn().mockResolvedValue({ docs: [] });
  return query;
}

const calls: Call[] = [];
const fakeCollection = vi.fn();

vi.mock("@/lib/firebase/firestore", () => ({
  productsCollection: () => fakeCollection(),
}));

const { listProducts, getSpecialOffers } = await import("@/lib/domain/catalog/product.service");
const { getFeaturedProductsForCategory } = await import("@/lib/domain/catalog/categoryShowcase.service");

function makeOfferProduct(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: { en: `Product ${id}`, ar: null },
    slug: id,
    description: { en: "d", ar: null },
    price: 10000,
    categoryId: "rings",
    images: [],
    material: { en: "Gold", ar: null },
    options: [],
    stock: 5,
    availability: true,
    isNewArrival: false,
    isBestSeller: false,
    salesCount: 0,
    searchTerms: [],
    isOnSale: true,
    salePrice: 8000,
    saleStartAt: null,
    saleEndAt: null,
    ...overrides,
  };
}

describe("listProducts query builder", () => {
  beforeEach(() => {
    calls.length = 0;
    fakeCollection.mockImplementation(() => createFakeQuery(calls));
  });

  it("filters by availability and sorts by newest (default)", async () => {
    await listProducts({});
    const methods = calls.map((c) => c.method);
    expect(methods).toContain("where");
    expect(calls.some((c) => c.method === "where" && c.args[0] === "availability")).toBe(true);
    expect(calls.some((c) => c.method === "orderBy" && c.args[0] === "createdAt" && c.args[1] === "desc")).toBe(
      true,
    );
  });

  it("sorts by price ascending", async () => {
    await listProducts({ sort: "price" });
    expect(calls.some((c) => c.method === "orderBy" && c.args[0] === "price" && c.args[1] === "asc")).toBe(true);
  });

  it("sorts by popularity (salesCount) descending", async () => {
    await listProducts({ sort: "popularity" });
    expect(calls.some((c) => c.method === "orderBy" && c.args[0] === "salesCount" && c.args[1] === "desc")).toBe(
      true,
    );
  });

  it("filters by categoryId for every category", async () => {
    for (const categoryId of ["bracelets", "rings", "earrings", "watches"]) {
      calls.length = 0;
      await listProducts({ categoryId });
      expect(calls.some((c) => c.method === "where" && c.args[0] === "categoryId" && c.args[2] === categoryId)).toBe(
        true,
      );
    }
  });

  it("combines categoryId with every sort option", async () => {
    for (const sort of ["newest", "price", "popularity"] as const) {
      calls.length = 0;
      await listProducts({ categoryId: "bracelets", sort });
      expect(calls.some((c) => c.method === "where" && c.args[0] === "categoryId")).toBe(true);
      expect(calls.some((c) => c.method === "where" && c.args[0] === "availability")).toBe(true);
      expect(calls.some((c) => c.method === "orderBy")).toBe(true);
    }
  });

  it("uses array-contains-any on searchTerms for a search query, tokenizing both languages", async () => {
    await listProducts({ search: "Gold ذهبي" });
    const searchCall = calls.find((c) => c.method === "where" && c.args[0] === "searchTerms");
    expect(searchCall).toBeDefined();
    expect(searchCall?.args[1]).toBe("array-contains-any");
    expect(searchCall?.args[2]).toEqual(expect.arrayContaining(["gold", "ذهبي"]));
  });

  it("does not apply orderBy when searching (avoids a per-sort search index)", async () => {
    await listProducts({ search: "gold", sort: "price" });
    expect(calls.some((c) => c.method === "orderBy")).toBe(false);
  });

  it("applies a price range filter and forces price as the effective sort", async () => {
    await listProducts({ minPrice: 1000, maxPrice: 5000, sort: "newest" });
    expect(calls.some((c) => c.method === "where" && c.args[0] === "price" && c.args[1] === ">=")).toBe(true);
    expect(calls.some((c) => c.method === "where" && c.args[0] === "price" && c.args[1] === "<=")).toBe(true);
    expect(calls.some((c) => c.method === "orderBy" && c.args[0] === "price")).toBe(true);
  });

  it("ignores a price range when searching", async () => {
    await listProducts({ search: "gold", minPrice: 1000 });
    expect(calls.some((c) => c.method === "where" && c.args[0] === "price")).toBe(false);
  });

  it("T086: never filters on `stock` — a Sold Out product must stay browsable in every listing", async () => {
    for (const params of [{}, { categoryId: "bracelets" }, { search: "gold" }, { sort: "price" as const }]) {
      calls.length = 0;
      await listProducts(params);
      expect(calls.some((c) => c.method === "where" && c.args[0] === "stock")).toBe(false);
    }
  });
});

describe("getFeaturedProductsForCategory (homepage Featured strip)", () => {
  beforeEach(() => {
    calls.length = 0;
    fakeCollection.mockImplementation(() => createFakeQuery(calls));
  });

  it("T086: filters only on categoryId + availability, never on stock — a Sold Out product stays in its showcase strip", async () => {
    await getFeaturedProductsForCategory("bracelets");
    expect(calls.some((c) => c.method === "where" && c.args[0] === "categoryId" && c.args[2] === "bracelets")).toBe(
      true,
    );
    expect(calls.some((c) => c.method === "where" && c.args[0] === "availability" && c.args[2] === true)).toBe(true);
    expect(calls.some((c) => c.method === "where" && c.args[0] === "stock")).toBe(false);
  });
});

describe("getSpecialOffers (T320, spec FR-117)", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("filters on isOnSale + availability, never on stock", async () => {
    fakeCollection.mockImplementation(() => createFakeQuery(calls));
    await getSpecialOffers();
    expect(calls.some((c) => c.method === "where" && c.args[0] === "isOnSale" && c.args[2] === true)).toBe(true);
    expect(calls.some((c) => c.method === "where" && c.args[0] === "availability" && c.args[2] === true)).toBe(true);
    expect(calls.some((c) => c.method === "where" && c.args[0] === "stock")).toBe(false);
  });

  it("filters the candidate set down to only ACTIVE offers (research.md §48)", async () => {
    const past = { toMillis: () => Date.now() - 1000 };
    const future = { toMillis: () => Date.now() + 1000 };
    const docs = [
      { data: () => makeOfferProduct("active", {}) },
      { data: () => makeOfferProduct("scheduled", { saleStartAt: future }) },
      { data: () => makeOfferProduct("expired", { saleEndAt: past }) },
      { data: () => makeOfferProduct("disabled", { isOnSale: false, salePrice: null }) },
    ];
    fakeCollection.mockImplementation(() => {
      const query = createFakeQuery(calls);
      query.get = vi.fn().mockResolvedValue({ docs });
      return query;
    });

    const results = await getSpecialOffers();
    expect(results.map((p) => p.id)).toEqual(["active"]);
  });

  it("limits results to the requested count after ACTIVE-filtering", async () => {
    const docs = [1, 2, 3].map((n) => ({ data: () => makeOfferProduct(`p${n}`) }));
    fakeCollection.mockImplementation(() => {
      const query = createFakeQuery(calls);
      query.get = vi.fn().mockResolvedValue({ docs });
      return query;
    });

    const results = await getSpecialOffers(2);
    expect(results).toHaveLength(2);
  });
});
