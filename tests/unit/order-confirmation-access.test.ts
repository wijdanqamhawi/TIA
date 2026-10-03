import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@/types/order";

/**
 * Reproduces the production case ELR-20261003-0001: a signed-in customer's
 * order, opened at /{en,ar}/order-confirmation/ELR-20261003-0001. The page may
 * only render for the order's owner (or a guest holding the guest cookie) —
 * everyone else, admins included, gets the same 404.
 */

const ORDER_NUMBER = "ELR-20261003-0001";
const OWNER_UID = "owner-uid-example";

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
const notFoundMock = vi.fn(() => {
  throw NOT_FOUND;
});
const getOrderByNumberMock = vi.fn();
const getSessionClaimsMock = vi.fn();
const hasGuestOrderAccessMock = vi.fn();
const warnMock = vi.fn();

vi.mock("next/navigation", () => ({ notFound: () => notFoundMock() }));
vi.mock("@/lib/domain/orders/order.service", () => ({ getOrderByNumber: (n: string) => getOrderByNumberMock(n) }));
vi.mock("@/lib/firebase/guards", () => ({ getSessionClaims: () => getSessionClaimsMock() }));
vi.mock("@/lib/domain/orders/guest-order-access", () => ({
  hasGuestOrderAccess: (n: string) => hasGuestOrderAccessMock(n),
}));
vi.mock("@/lib/domain/catalog/product.service", () => ({ getProductsByIds: async () => new Map() }));
vi.mock("@/components/storefront/checkout/OrderConfirmationView", () => ({
  OrderConfirmationView: () => null,
}));
vi.mock("@/lib/utils/logger", () => ({
  logger: { warn: (...a: unknown[]) => warnMock(...a), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { default: OrderConfirmationPage } = await import(
  "@/app/[locale]/(storefront)/order-confirmation/[orderNumber]/page"
);
const { decideOrderAccess } = await import("@/lib/domain/orders/order-access");

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "EKm22JTbQZoOkfnHVDq9",
    orderNumber: ORDER_NUMBER,
    userId: OWNER_UID,
    customerSnapshot: { fullName: "Customer", email: "customer@example.com", phone: "0599" },
    deliverySnapshot: {
      regionId: "wb",
      regionName: { en: "West Bank", ar: "الضفة الغربية" },
      locationId: "r",
      locationName: { en: "Ramallah", ar: "رام الله" },
      fullAddress: "Somewhere",
    },
    items: [],
    notes: null,
    paymentMethod: "CASH_ON_DELIVERY",
    status: "CONFIRMED",
    subtotal: 100,
    total: 100,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  } as unknown as Order;
}

async function render(locale: string) {
  return OrderConfirmationPage({
    params: Promise.resolve({ locale, orderNumber: ORDER_NUMBER }),
    searchParams: Promise.resolve({}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getOrderByNumberMock.mockResolvedValue(makeOrder());
  getSessionClaimsMock.mockResolvedValue(null);
  hasGuestOrderAccessMock.mockResolvedValue(false);
});

describe("order confirmation access", () => {
  it.each(["en", "ar"])("lets the signed-in owner view it on /%s, on first load and on refresh", async (locale) => {
    getSessionClaimsMock.mockResolvedValue({ uid: OWNER_UID, email: "customer@example.com", role: "CUSTOMER" });

    const first = (await render(locale)) as { props: { children: { props: Record<string, unknown> } } };
    const refreshed = (await render(locale)) as typeof first;

    for (const result of [first, refreshed]) {
      expect(result.props.children.props).toMatchObject({ locale, editable: false });
    }
    expect(getOrderByNumberMock).toHaveBeenCalledWith(ORDER_NUMBER);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("offers Edit only to the owner while the order is still editable", async () => {
    getOrderByNumberMock.mockResolvedValue(makeOrder({ status: "PENDING" }));
    getSessionClaimsMock.mockResolvedValue({ uid: OWNER_UID, email: null, role: "CUSTOMER" });
    const result = (await render("en")) as { props: { children: { props: { editable: boolean } } } };
    expect(result.props.children.props.editable).toBe(true);
  });

  it.each(["en", "ar"])("404s another signed-in customer on /%s", async (locale) => {
    getSessionClaimsMock.mockResolvedValue({ uid: "someone-else", email: null, role: "CUSTOMER" });
    await expect(render(locale)).rejects.toBe(NOT_FOUND);
    expect(warnMock).toHaveBeenCalledWith(
      "order-confirmation: 404",
      expect.objectContaining({ reason: "not_owner", orderNumber: ORDER_NUMBER }),
    );
  });

  it("404s a signed-in admin (no admin bypass)", async () => {
    getSessionClaimsMock.mockResolvedValue({ uid: "admin-uid", email: null, role: "ADMIN" });
    await expect(render("en")).rejects.toBe(NOT_FOUND);
  });

  it("404s a signed-out visitor, and a guest cookie does not unlock a customer's order", async () => {
    hasGuestOrderAccessMock.mockResolvedValue(true);
    await expect(render("en")).rejects.toBe(NOT_FOUND);
    expect(warnMock).toHaveBeenCalledWith("order-confirmation: 404", expect.objectContaining({ reason: "no_session" }));
  });

  it("404s a missing order", async () => {
    getOrderByNumberMock.mockResolvedValue(null);
    await expect(render("en")).rejects.toBe(NOT_FOUND);
  });

  it("never logs identity: no uid, cookie or token in the denial log", async () => {
    getSessionClaimsMock.mockResolvedValue({ uid: "someone-else", email: "x@y.z", role: "CUSTOMER" });
    await expect(render("en")).rejects.toBe(NOT_FOUND);
    const logged = JSON.stringify(warnMock.mock.calls);
    expect(logged).not.toContain("someone-else");
    expect(logged).not.toContain("x@y.z");
    expect(logged).not.toContain(OWNER_UID);
  });

  describe("guest orders", () => {
    beforeEach(() => getOrderByNumberMock.mockResolvedValue(makeOrder({ userId: null })));

    it.each(["en", "ar"])("still works with the guest access cookie on /%s", async (locale) => {
      hasGuestOrderAccessMock.mockResolvedValue(true);
      const result = (await render(locale)) as { props: { children: { props: Record<string, unknown> } } };
      expect(result.props.children.props).toMatchObject({ locale, editable: false });
    });

    it("404s without the cookie", async () => {
      await expect(render("en")).rejects.toBe(NOT_FOUND);
    });

    it("never lets a signed-in stranger in via a session", async () => {
      getSessionClaimsMock.mockResolvedValue({ uid: "someone-else", email: null, role: "CUSTOMER" });
      await expect(render("en")).rejects.toBe(NOT_FOUND);
    });
  });
});

describe("decideOrderAccess", () => {
  it("never treats a null uid on both sides as ownership", () => {
    expect(decideOrderAccess({ userId: null }, { uid: "" }, false)).toEqual({
      allowed: false,
      reason: "guest_order_no_access",
    });
  });
});
