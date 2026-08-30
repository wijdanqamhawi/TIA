import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit-tests `getOrdersForCustomer` (T136/T140, spec User Story 2): proves
 * the query is scoped to `userId == <the requested uid>` only — a
 * customer can never see another customer's orders through this
 * function.
 */

type Call = { method: string; args: unknown[] };
const calls: Call[] = [];

function makeOrder(id: string, userId: string) {
  return {
    id,
    orderNumber: `ELR-20260827-000${id}`,
    userId,
    customerSnapshot: { fullName: "Test", email: "test@example.com", phone: "+1" },
    deliverySnapshot: {
      regionId: "west-bank",
      regionName: { en: "West Bank", ar: null },
      locationId: "loc",
      locationName: { en: "Ramallah", ar: null },
      fullAddress: "123 Main St",
    },
    items: [],
    notes: null,
    paymentMethod: "CASH_ON_DELIVERY",
    status: "PENDING",
    subtotal: 1000,
    total: 1000,
    createdAt: { toMillis: () => Date.now() },
    updatedAt: { toMillis: () => Date.now() },
  };
}

function createFakeQuery(docs: ReturnType<typeof makeOrder>[]) {
  const query: Record<string, unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return query;
  };
  query.where = chain("where");
  query.orderBy = chain("orderBy");
  query.limit = chain("limit");
  query.startAfter = chain("startAfter");
  query.get = vi.fn().mockResolvedValue({ docs: docs.map((d) => ({ id: d.id, data: () => d })) });
  return query;
}

const fakeCollection = vi.fn();
const docsToReturn: ReturnType<typeof makeOrder>[] = [];

vi.mock("@/lib/firebase/firestore", () => ({
  ordersCollection: () => fakeCollection(),
}));

const { getOrdersForCustomer } = await import("@/lib/domain/orders/order.service");

describe("getOrdersForCustomer (T136/T140)", () => {
  beforeEach(() => {
    calls.length = 0;
    docsToReturn.length = 0;
    fakeCollection.mockImplementation(() => createFakeQuery(docsToReturn));
  });

  it("filters on userId == the requested uid", async () => {
    docsToReturn.push(makeOrder("1", "user-a"));
    await getOrdersForCustomer("user-a");
    expect(calls.some((c) => c.method === "where" && c.args[0] === "userId" && c.args[1] === "==" && c.args[2] === "user-a")).toBe(
      true,
    );
  });

  it("orders by createdAt descending (newest first)", async () => {
    await getOrdersForCustomer("user-a");
    expect(calls.some((c) => c.method === "orderBy" && c.args[0] === "createdAt" && c.args[1] === "desc")).toBe(true);
  });

  it("returns only orders belonging to the requested user (never another customer's)", async () => {
    docsToReturn.push(makeOrder("1", "user-a"), makeOrder("2", "user-a"));
    const result = await getOrdersForCustomer("user-a");
    expect(result.orders.every((o) => o.userId === "user-a")).toBe(true);
    expect(result.orders).toHaveLength(2);
  });

  it("returns a nextCursorId only when a full page was returned", async () => {
    docsToReturn.push(makeOrder("1", "user-a"));
    const full = await getOrdersForCustomer("user-a", { pageSize: 1 });
    expect(full.nextCursorId).toBe("1");
  });

  it("returns a null nextCursorId when fewer than a full page is returned", async () => {
    docsToReturn.push(makeOrder("1", "user-a"));
    const partial = await getOrdersForCustomer("user-a", { pageSize: 10 });
    expect(partial.nextCursorId).toBeNull();
  });
});
