import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORDER_STATUSES, type OrderStatus } from "@/types/order";
import { getAllowedNextStatuses } from "@/lib/domain/orders/order-status-transitions";

/**
 * The server side of the inline status change: the REAL `updateOrderStatusAction`
 * and the REAL `transitionOrderStatus` transaction over an in-memory store. The
 * UI only ever offers valid moves, but this is the authority — it re-reads the
 * order's current status inside the transaction and refuses anything the
 * existing workflow forbids, writing nothing.
 */

const requireAdminMock = vi.fn();
class FakeForbiddenError extends Error {}
class FakeUnauthenticatedError extends Error {}
vi.mock("@/lib/firebase/guards", () => ({
  requireAdmin: () => requireAdminMock(),
  ForbiddenError: FakeForbiddenError,
  UnauthenticatedError: FakeUnauthenticatedError,
}));

type Ref = { collection: "orders" | "products"; id: string };
const orders = new Map<string, Record<string, unknown>>();
const writes: Array<{ ref: Ref; patch: Record<string, unknown> }> = [];

vi.mock("@/lib/firebase/firestore", () => ({
  ordersCollection: () => ({ doc: (id: string): Ref => ({ collection: "orders", id }) }),
  productsCollection: () => ({ doc: (id: string): Ref => ({ collection: "products", id }) }),
}));
vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => ({
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: async (ref: Ref) => ({
          // Products always exist here (restock skips a deleted product — see admin-bulk-actions.test.ts).
          exists: ref.collection === "orders" ? orders.has(ref.id) : true,
          data: () => orders.get(ref.id),
        }),
        update: (ref: Ref, patch: Record<string, unknown>) => {
          writes.push({ ref, patch });
          if (ref.collection === "orders") orders.set(ref.id, { ...orders.get(ref.id), ...patch });
        },
      }),
  }),
}));

const { updateOrderStatusAction } = await import("@/actions/admin/order.actions");

function order(id: string, status: OrderStatus) {
  return {
    id,
    status,
    items: [
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 1 },
    ],
  };
}

beforeEach(() => {
  orders.clear();
  writes.length = 0;
  requireAdminMock.mockReset().mockResolvedValue({ uid: "admin-1", role: "ADMIN" });
});

describe("updateOrderStatusAction — the inline change is enforced on the server", () => {
  it("applies every transition the workflow allows, touching only status and updatedAt", async () => {
    for (const from of ORDER_STATUSES) {
      for (const to of getAllowedNextStatuses(from).filter((status) => status !== "CANCELLED")) {
        orders.set("o1", order("o1", from));
        writes.length = 0;
        const result = await updateOrderStatusAction({ orderId: "o1", status: to });
        expect(result.ok, `${from} → ${to}`).toBe(true);
        expect(orders.get("o1")!["status"]).toBe(to);
        expect(writes).toHaveLength(1);
        expect(Object.keys(writes[0]!.patch).sort()).toEqual(["status", "updatedAt"]);
      }
    }
  });

  it("refuses every transition the workflow forbids, with no write at all", async () => {
    let checked = 0;
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        if (from === to || getAllowedNextStatuses(from).includes(to)) continue;
        orders.set("o1", order("o1", from));
        writes.length = 0;
        const result = await updateOrderStatusAction({ orderId: "o1", status: to });
        expect(result.ok, `${from} → ${to}`).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe("INVALID_TRANSITION");
          expect(result.error.message).toBe(`Cannot change status from ${from} to ${to}.`);
        }
        expect(writes).toEqual([]);
        expect(orders.get("o1")!["status"]).toBe(from);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(15);
  });

  it("final statuses can never change again", async () => {
    for (const final of ["DELIVERED", "CANCELLED"] as const) {
      for (const to of ORDER_STATUSES) {
        orders.set("o1", order("o1", final));
        const result = await updateOrderStatusAction({ orderId: "o1", status: to });
        expect(result.ok, `${final} → ${to}`).toBe(false);
      }
    }
    expect(writes).toEqual([]);
  });

  it("judges the order's CURRENT status, not the one a stale page last showed", async () => {
    // The admin's page still shows Pending, but the order was already Confirmed elsewhere.
    orders.set("o1", order("o1", "CONFIRMED"));
    const result = await updateOrderStatusAction({ orderId: "o1", status: "CONFIRMED" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_TRANSITION");
    expect(writes).toEqual([]);
  });

  it("cancelling restocks every line in the same transaction", async () => {
    orders.set("o1", order("o1", "PENDING"));
    const result = await updateOrderStatusAction({ orderId: "o1", status: "CANCELLED" });
    expect(result.ok).toBe(true);
    const productWrites = writes.filter((w) => w.ref.collection === "products");
    expect(productWrites.map((w) => w.ref.id).sort()).toEqual(["p1", "p2"]);
    for (const write of productWrites)
      expect(Object.keys(write.patch).sort()).toEqual(["salesCount", "stock", "updatedAt"]);
    expect(orders.get("o1")!["status"]).toBe("CANCELLED");
  });

  it("no other transition touches stock", async () => {
    orders.set("o1", order("o1", "SHIPPED"));
    await updateOrderStatusAction({ orderId: "o1", status: "DELIVERED" });
    expect(writes.filter((w) => w.ref.collection === "products")).toEqual([]);
  });

  it("reports a missing order, and rejects a status that is not one of the real ones", async () => {
    const missing = await updateOrderStatusAction({ orderId: "gone", status: "CONFIRMED" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("NOT_FOUND");

    orders.set("o1", order("o1", "PENDING"));
    const invented = await updateOrderStatusAction({ orderId: "o1", status: "REFUNDED" });
    expect(invented.ok).toBe(false);
    expect(writes).toEqual([]);
  });

  it("is admin-only: a non-admin changes nothing", async () => {
    requireAdminMock.mockRejectedValue(new FakeForbiddenError());
    orders.set("o1", order("o1", "PENDING"));
    const result = await updateOrderStatusAction({ orderId: "o1", status: "CONFIRMED" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(writes).toEqual([]);
    expect(orders.get("o1")!["status"]).toBe("PENDING");
  });
});
