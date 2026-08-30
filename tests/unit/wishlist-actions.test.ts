import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit-tests `addWishlistItemAction`/`removeWishlistItemAction`/
 * `moveWishlistItemToCartAction` (T110–T112, spec FR-032/FR-033a): auth
 * required, live product/option re-validation, and — critically —
 * `moveWishlistItemToCartAction` never removes an item it couldn't
 * actually move (Sold Out / unavailable / insufficient stock leaves the
 * wishlist entry untouched).
 */

class FakeUnauthenticatedError extends Error {}

const requireUserMock = vi.fn();
vi.mock("@/lib/firebase/guards", () => ({
  requireUser: () => requireUserMock(),
  UnauthenticatedError: FakeUnauthenticatedError,
}));

const getProductByIdMock = vi.fn();
const isSelectedOptionValidMock = vi.fn();
const validateCartLineAvailabilityMock = vi.fn();
vi.mock("@/lib/domain/catalog/product.service", () => ({
  getProductById: (...args: unknown[]) => getProductByIdMock(...args),
  isSelectedOptionValid: (...args: unknown[]) => isSelectedOptionValidMock(...args),
  validateCartLineAvailability: (...args: unknown[]) => validateCartLineAvailabilityMock(...args),
}));

const getOrCreateCartMock = vi.fn();
const saveCartItemsMock = vi.fn();
function sameCartLine(a: { productId: string; selectedOption: unknown }, b: { productId: string; selectedOption: unknown }) {
  return a.productId === b.productId && JSON.stringify(a.selectedOption) === JSON.stringify(b.selectedOption);
}
vi.mock("@/lib/domain/cart/cart.service", () => ({
  getOrCreateCart: (...args: unknown[]) => getOrCreateCartMock(...args),
  saveCartItems: (...args: unknown[]) => saveCartItemsMock(...args),
  sameCartLine,
}));

const addItemToWishlistMock = vi.fn();
const removeItemFromWishlistMock = vi.fn();
vi.mock("@/lib/domain/wishlist/wishlist.service", () => ({
  addItemToWishlist: (...args: unknown[]) => addItemToWishlistMock(...args),
  removeItemFromWishlist: (...args: unknown[]) => removeItemFromWishlistMock(...args),
}));

const { addWishlistItemAction, removeWishlistItemAction, moveWishlistItemToCartAction } = await import(
  "@/actions/wishlist.actions"
);

const PRODUCT = { id: "p1", options: [], stock: 5, availability: true };

describe("addWishlistItemAction", () => {
  beforeEach(() => {
    requireUserMock.mockReset().mockResolvedValue({ uid: "u1", role: "CUSTOMER" });
    getProductByIdMock.mockReset().mockResolvedValue(PRODUCT);
    isSelectedOptionValidMock.mockReset().mockReturnValue(true);
    addItemToWishlistMock.mockReset();
  });

  it("rejects an unauthenticated caller", async () => {
    requireUserMock.mockRejectedValue(new FakeUnauthenticatedError());
    const result = await addWishlistItemAction({ productId: "p1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHENTICATED");
    expect(addItemToWishlistMock).not.toHaveBeenCalled();
  });

  it("rejects a product that no longer exists", async () => {
    getProductByIdMock.mockResolvedValue(null);
    const result = await addWishlistItemAction({ productId: "gone" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("rejects an invalid selected option", async () => {
    isSelectedOptionValidMock.mockReturnValue(false);
    const result = await addWishlistItemAction({ productId: "p1", selectedOption: { optionKey: "x", valueKey: "y" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_OPTION");
  });

  it("adds a valid item", async () => {
    const result = await addWishlistItemAction({ productId: "p1" });
    expect(result.ok).toBe(true);
    expect(addItemToWishlistMock).toHaveBeenCalledWith("u1", "p1", null);
  });
});

describe("removeWishlistItemAction", () => {
  beforeEach(() => {
    requireUserMock.mockReset().mockResolvedValue({ uid: "u1", role: "CUSTOMER" });
    removeItemFromWishlistMock.mockReset();
  });

  it("rejects an unauthenticated caller", async () => {
    requireUserMock.mockRejectedValue(new FakeUnauthenticatedError());
    const result = await removeWishlistItemAction({ productId: "p1" });
    expect(result.ok).toBe(false);
    expect(removeItemFromWishlistMock).not.toHaveBeenCalled();
  });

  it("removes the item regardless of its current validity", async () => {
    const result = await removeWishlistItemAction({ productId: "p1" });
    expect(result.ok).toBe(true);
    expect(removeItemFromWishlistMock).toHaveBeenCalledWith("u1", "p1", null);
  });
});

describe("moveWishlistItemToCartAction — never removes an item it couldn't move (spec: SOLD OUT stays in wishlist)", () => {
  beforeEach(() => {
    requireUserMock.mockReset().mockResolvedValue({ uid: "u1", role: "CUSTOMER" });
    getProductByIdMock.mockReset().mockResolvedValue(PRODUCT);
    isSelectedOptionValidMock.mockReset().mockReturnValue(true);
    validateCartLineAvailabilityMock.mockReset().mockReturnValue({ ok: true });
    getOrCreateCartMock.mockReset().mockResolvedValue({
      ref: "cart-ref",
      cart: { id: "u1", items: [] },
      isGuest: false,
    });
    saveCartItemsMock.mockReset();
    removeItemFromWishlistMock.mockReset();
  });

  it("rejects an unauthenticated caller", async () => {
    requireUserMock.mockRejectedValue(new FakeUnauthenticatedError());
    const result = await moveWishlistItemToCartAction({ productId: "p1" });
    expect(result.ok).toBe(false);
    expect(saveCartItemsMock).not.toHaveBeenCalled();
  });

  it("rejects a product that no longer exists, leaving the wishlist untouched", async () => {
    getProductByIdMock.mockResolvedValue(null);
    const result = await moveWishlistItemToCartAction({ productId: "gone" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(removeItemFromWishlistMock).not.toHaveBeenCalled();
  });

  it("rejects a Sold Out product and leaves it in the wishlist", async () => {
    validateCartLineAvailabilityMock.mockReturnValue({ ok: false, reason: "SOLD_OUT" });
    const result = await moveWishlistItemToCartAction({ productId: "p1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("SOLD_OUT");
    expect(saveCartItemsMock).not.toHaveBeenCalled();
    expect(removeItemFromWishlistMock).not.toHaveBeenCalled();
  });

  it("rejects insufficient stock and leaves the item in the wishlist", async () => {
    validateCartLineAvailabilityMock.mockReturnValue({ ok: false, reason: "INSUFFICIENT_STOCK" });
    const result = await moveWishlistItemToCartAction({ productId: "p1" });
    expect(result.ok).toBe(false);
    expect(removeItemFromWishlistMock).not.toHaveBeenCalled();
  });

  it("moves a valid item to the cart and removes it from the wishlist", async () => {
    const result = await moveWishlistItemToCartAction({ productId: "p1" });
    expect(result.ok).toBe(true);
    expect(saveCartItemsMock).toHaveBeenCalledWith("cart-ref", [{ productId: "p1", selectedOption: null, quantity: 1 }], false);
    expect(removeItemFromWishlistMock).toHaveBeenCalledWith("u1", "p1", null);
  });

  it("sums into an existing matching cart line rather than duplicating it", async () => {
    getOrCreateCartMock.mockResolvedValue({
      ref: "cart-ref",
      cart: { id: "u1", items: [{ productId: "p1", selectedOption: null, quantity: 2 }] },
      isGuest: false,
    });
    const result = await moveWishlistItemToCartAction({ productId: "p1" });
    expect(result.ok).toBe(true);
    expect(saveCartItemsMock).toHaveBeenCalledWith("cart-ref", [{ productId: "p1", selectedOption: null, quantity: 3 }], false);
  });
});
