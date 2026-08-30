import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit-tests the Special Offers slice of `updateProductAction` (T144,
 * folding in the previously-standalone `updateProductOfferAction`,
 * T328–T329, spec FR-123): admin-only server authorization, server-side
 * re-validation of `salePrice < price` against the currently-stored price
 * (never a client-submitted price) when a partial update omits `price`.
 */

const requireAdminMock = vi.fn();

class FakeForbiddenError extends Error {}
class FakeUnauthenticatedError extends Error {}

vi.mock("@/lib/firebase/guards", () => ({
  requireAdmin: () => requireAdminMock(),
  ForbiddenError: FakeForbiddenError,
  UnauthenticatedError: FakeUnauthenticatedError,
}));

type FakeProduct = {
  price: number;
  name: { en: string; ar: string | null };
  material: { en: string; ar: string | null };
  slug: string;
  categoryId: string;
  options: unknown[];
  stock: number;
  availability: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isOnSale: boolean;
  salePrice: number | null;
  saleStartAt: null;
  saleEndAt: null;
  description: { en: string; ar: string | null };
};

const docs = new Map<string, FakeProduct>();
const updateMock = vi.fn();

vi.mock("@/lib/firebase/firestore", () => ({
  productsCollection: () => ({
    doc: (id: string) => ({
      get: async () => {
        const data = docs.get(id);
        return { exists: Boolean(data), data: () => data };
      },
      update: (patch: unknown) => updateMock(id, patch),
    }),
  }),
}));

vi.mock("@/lib/domain/catalog/category.service", () => ({
  categoryExists: async () => true,
}));

vi.mock("@/lib/domain/catalog/product.service", () => ({
  deriveProductSlug: (nameEn: string) => nameEn.toLowerCase().replace(/\s+/g, "-"),
  assertUniqueProductSlug: async () => {},
}));

const { updateProductAction } = await import("@/actions/admin/product.actions");

function baseProduct(overrides: Partial<FakeProduct> = {}): FakeProduct {
  return {
    price: 10000,
    name: { en: "Gold Ring", ar: null },
    material: { en: "Gold", ar: null },
    slug: "gold-ring",
    categoryId: "rings",
    options: [],
    stock: 5,
    availability: true,
    isNewArrival: false,
    isBestSeller: false,
    isOnSale: false,
    salePrice: null,
    saleStartAt: null,
    saleEndAt: null,
    description: { en: "A ring", ar: null },
    ...overrides,
  };
}

describe("updateProductAction — Special Offers fields", () => {
  beforeEach(() => {
    docs.clear();
    updateMock.mockReset();
    requireAdminMock.mockReset().mockResolvedValue({ uid: "admin-1", role: "ADMIN" });
  });

  it("rejects a non-admin/unauthenticated caller without touching Firestore", async () => {
    requireAdminMock.mockRejectedValue(new FakeForbiddenError());
    docs.set("p1", baseProduct());

    const result = await updateProductAction({ productId: "p1", isOnSale: true, salePrice: 8000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a product that no longer exists", async () => {
    const result = await updateProductAction({ productId: "missing", isOnSale: true, salePrice: 8000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("rejects a salePrice >= the product's currently-stored price when price is omitted from the update (never trusts a client-submitted price)", async () => {
    docs.set("p1", baseProduct({ price: 10000 }));

    const result = await updateProductAction({ productId: "p1", isOnSale: true, salePrice: 10000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects isOnSale: true with no salePrice (falls back to the stored salePrice, which is null)", async () => {
    docs.set("p1", baseProduct({ price: 10000, salePrice: null }));

    const result = await updateProductAction({ productId: "p1", isOnSale: true });

    expect(result.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("persists a valid offer update", async () => {
    docs.set("p1", baseProduct({ price: 10000 }));

    const result = await updateProductAction({ productId: "p1", isOnSale: true, salePrice: 8000 });

    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
    const [id, patch] = updateMock.mock.calls[0];
    expect(id).toBe("p1");
    expect(patch).toMatchObject({ isOnSale: true, salePrice: 8000 });
  });

  it("disables an offer (isOnSale: false) even with a stale stored salePrice", async () => {
    docs.set("p1", baseProduct({ price: 10000, isOnSale: true, salePrice: 8000 }));

    const result = await updateProductAction({ productId: "p1", isOnSale: false });

    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("re-validates a submitted price against a submitted salePrice in the same update", async () => {
    docs.set("p1", baseProduct({ price: 10000 }));

    const result = await updateProductAction({ productId: "p1", price: 5000, isOnSale: true, salePrice: 6000 });

    expect(result.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
