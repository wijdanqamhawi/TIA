import { describe, expect, it } from "vitest";
import { filterAdminProducts, type AdminProductFilters } from "@/lib/domain/admin/product-filters";
import type { OfferStatus } from "@/lib/domain/catalog/offer";

function product(
  id: string,
  overrides: Partial<{
    nameEn: string;
    nameAr: string | null;
    categoryId: string;
    isSoldOut: boolean;
    availability: boolean;
    isNewArrival: boolean;
    isBestSeller: boolean;
    offerStatus: OfferStatus;
  }> = {},
) {
  return {
    id,
    nameEn: `Product ${id}`,
    nameAr: null,
    categoryId: "rings",
    isSoldOut: false,
    availability: true,
    isNewArrival: false,
    isBestSeller: false,
    offerStatus: "DISABLED" as OfferStatus,
    ...overrides,
  };
}

const ALL: AdminProductFilters = { query: "", categoryId: "all", stock: "all", status: "all" };

const products = [
  product("a", {
    nameEn: "Luna Mesh Watch",
    nameAr: "ساعة لونا",
    categoryId: "watches",
    isNewArrival: true,
  }),
  product("b", { nameEn: "Celeste Hoop Earrings", categoryId: "earrings", isBestSeller: true }),
  product("c", { nameEn: "Pearl Ring Set", isSoldOut: true, offerStatus: "ACTIVE" }),
  product("d", {
    nameEn: "Hidden Cuff",
    categoryId: "bracelets",
    availability: false,
    offerStatus: "SCHEDULED",
  }),
];

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

describe("filterAdminProducts", () => {
  it("returns every product when no filter is set", () => {
    expect(ids(filterAdminProducts(products, ALL))).toEqual(["a", "b", "c", "d"]);
  });

  it("searches English and Arabic names, case-insensitively and trimmed", () => {
    expect(ids(filterAdminProducts(products, { ...ALL, query: "  luna " }))).toEqual(["a"]);
    expect(ids(filterAdminProducts(products, { ...ALL, query: "ساعة" }))).toEqual(["a"]);
    expect(ids(filterAdminProducts(products, { ...ALL, query: "ring" }))).toEqual(["b", "c"]);
  });

  it("filters by category", () => {
    expect(ids(filterAdminProducts(products, { ...ALL, categoryId: "rings" }))).toEqual(["c"]);
  });

  it("filters by stock", () => {
    expect(ids(filterAdminProducts(products, { ...ALL, stock: "soldOut" }))).toEqual(["c"]);
    expect(ids(filterAdminProducts(products, { ...ALL, stock: "inStock" }))).toEqual([
      "a",
      "b",
      "d",
    ]);
  });

  it("filters by status; On Sale means an active offer only", () => {
    expect(ids(filterAdminProducts(products, { ...ALL, status: "visible" }))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(ids(filterAdminProducts(products, { ...ALL, status: "hidden" }))).toEqual(["d"]);
    expect(ids(filterAdminProducts(products, { ...ALL, status: "newArrival" }))).toEqual(["a"]);
    expect(ids(filterAdminProducts(products, { ...ALL, status: "bestSeller" }))).toEqual(["b"]);
    expect(ids(filterAdminProducts(products, { ...ALL, status: "onSale" }))).toEqual(["c"]);
  });

  it("combines filters", () => {
    expect(ids(filterAdminProducts(products, { ...ALL, query: "ring", stock: "inStock" }))).toEqual(
      ["b"],
    );
  });
});
