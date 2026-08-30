import { describe, expect, it, vi } from "vitest";

/**
 * Unit-tests `reserveOrderNumber` (T128, research.md §4) against a
 * lightweight fake `Transaction`/counter document — proves the
 * `ELR-YYYYMMDD-NNNN` format and per-day sequence increment without
 * requiring the Firebase emulator.
 */

const store = new Map<string, { seq: number }>();

vi.mock("@/lib/firebase/firestore", () => ({
  orderCounterDoc: (dateKey: string) => ({ id: `order-${dateKey}` }),
}));

function makeFakeTransaction() {
  return {
    get: vi.fn(async (ref: { id: string }) => {
      const data = store.get(ref.id);
      return { exists: data !== undefined, data: () => data };
    }),
    set: vi.fn((ref: { id: string }, data: { seq: number }) => {
      store.set(ref.id, { seq: data.seq });
    }),
    update: vi.fn((ref: { id: string }, patch: { seq: number }) => {
      const existing = store.get(ref.id);
      store.set(ref.id, { seq: patch.seq ?? existing?.seq ?? 0 });
    }),
  };
}

const { reserveOrderNumber } = await import("@/lib/domain/orders/order-number.service");

describe("reserveOrderNumber", () => {
  it("formats ELR-YYYYMMDD-NNNN with a zero-padded 4-digit sequence", async () => {
    store.clear();
    const transaction = makeFakeTransaction();
    const { orderNumber, commit } = await reserveOrderNumber(transaction as never, new Date("2026-08-27T12:00:00Z"));
    commit();

    expect(orderNumber).toBe("ELR-20260827-0001");
  });

  it("increments the sequence for a second order on the same day", async () => {
    store.clear();
    const transaction = makeFakeTransaction();
    const first = await reserveOrderNumber(transaction as never, new Date("2026-08-27T09:00:00Z"));
    first.commit();

    const second = await reserveOrderNumber(transaction as never, new Date("2026-08-27T18:00:00Z"));
    second.commit();

    expect(first.orderNumber).toBe("ELR-20260827-0001");
    expect(second.orderNumber).toBe("ELR-20260827-0002");
  });

  it("starts a fresh sequence for a different day", async () => {
    store.clear();
    const transaction = makeFakeTransaction();
    const day1 = await reserveOrderNumber(transaction as never, new Date("2026-08-27T23:00:00Z"));
    day1.commit();

    const day2 = await reserveOrderNumber(transaction as never, new Date("2026-08-28T01:00:00Z"));
    day2.commit();

    expect(day1.orderNumber).toBe("ELR-20260827-0001");
    expect(day2.orderNumber).toBe("ELR-20260828-0001");
  });

  it("pads the sequence to 4 digits past 9", async () => {
    store.clear();
    store.set("order-20260827", { seq: 9 });
    const transaction = makeFakeTransaction();
    const { orderNumber } = await reserveOrderNumber(transaction as never, new Date("2026-08-27T12:00:00Z"));
    expect(orderNumber).toBe("ELR-20260827-0010");
  });

  it("does not commit the write until commit() is called", async () => {
    store.clear();
    const transaction = makeFakeTransaction();
    await reserveOrderNumber(transaction as never, new Date("2026-08-27T12:00:00Z"));
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });
});
