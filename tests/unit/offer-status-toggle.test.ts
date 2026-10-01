import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import {
  buildOfferData,
  computeOfferStats,
  getOfferToggle,
  offerToggleInput,
  type OfferRow,
} from "@/lib/domain/admin/offer-list";
import { getOfferStatus, resolveOfferPricing } from "@/lib/domain/catalog/offer";
import type { Product } from "@/types/product";

/**
 * Stopping / starting an offer from its status pill, end to end through the
 * REAL `updateProductAction` and the REAL customer-facing offers service
 * (`getSpecialOffers`) over one in-memory product store: only `isOnSale`
 * changes, the product and its stored sale price and dates survive, the
 * storefront derives the regular price at once, the admin list keeps the row
 * as DISABLED, and the customer offers list drops it. Status is never stored —
 * it is derived every time. No real Firebase project is touched.
 *
 * (The storefront has no /en/offers page and no homepage Special Offers
 * section; `getSpecialOffers` is the service that backs that section, and the
 * product cards / product page / cart price through `resolveOfferPricing`.)
 */

const requireAdminMock = vi.fn();
class FakeForbiddenError extends Error {}
class FakeUnauthenticatedError extends Error {}
vi.mock("@/lib/firebase/guards", () => ({
  requireAdmin: () => requireAdminMock(),
  ForbiddenError: FakeForbiddenError,
  UnauthenticatedError: FakeUnauthenticatedError,
}));

type Doc = Record<string, unknown> & {
  saleStartAt?: Timestamp | null;
  saleEndAt?: Timestamp | null;
};
const store = new Map<string, Doc>();
const writes: Array<{ kind: "update" | "set" | "delete"; id: string }> = [];

type FakeQuery = {
  where(field: string, op: string, value: unknown): FakeQuery;
  orderBy(): FakeQuery;
  limit(n: number): FakeQuery;
  get(): Promise<{ docs: Array<{ id: unknown; data: () => Doc }> }>;
};

function query(filters: Array<[string, unknown]> = [], max = Infinity): FakeQuery {
  return {
    where: (field: string, _op: string, value: unknown) => query([...filters, [field, value]], max),
    orderBy: () => query(filters, max),
    limit: (n: number) => query(filters, n),
    get: async () => ({
      docs: [...store.values()]
        .filter((doc) => filters.every(([field, value]) => doc[field] === value))
        .slice(0, max)
        .map((doc) => ({ id: doc["id"], data: () => doc })),
    }),
  };
}
vi.mock("@/lib/firebase/firestore", () => ({
  productsCollection: () => ({
    ...query(),
    doc: (id: string) => ({
      get: async () => ({ exists: store.has(id), data: () => store.get(id) }),
      update: async (patch: Record<string, unknown>) => {
        writes.push({ kind: "update", id });
        store.set(id, { ...store.get(id), ...patch });
      },
      set: async () => void writes.push({ kind: "set", id }),
      delete: async () => void writes.push({ kind: "delete", id }),
    }),
  }),
}));
vi.mock("@/lib/domain/catalog/category.service", () => ({ categoryExists: async () => true }));
const invalidateMock = vi.fn();
vi.mock("@/lib/cache/invalidate", () => ({ invalidateStorefrontCatalog: () => invalidateMock() }));

const { updateProductAction } = await import("@/actions/admin/product.actions");
const { getSpecialOffers } = await import("@/lib/domain/catalog/product.service");

const NOW = new Date("2026-09-30T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => Timestamp.fromMillis(NOW.getTime() + hours * HOUR);

function product(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: { en: name, ar: null },
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    description: { en: "d", ar: null },
    material: { en: "m", ar: null },
    images: [],
    price: 10000,
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
    ...overrides,
  };
}

const catalog = () => [...store.values()] as unknown as Product[];
const data = () => buildOfferData(catalog(), { toMillis: () => Date.now() }, "en");
const row = (id: string): OfferRow => data().offers.find((o) => o.productId === id)!;
const statusOf = (id: string) =>
  getOfferStatus(store.get(id) as unknown as Product, { toMillis: () => Date.now() });
const storefrontPrice = (id: string) => resolveOfferPricing(store.get(id) as unknown as Product);
const customerOfferIds = async () => (await getSpecialOffers()).map((p) => p.id);

/** What the status pill does: decide with the pure rule, then send the payload through the real action. */
async function clickPill(id: string) {
  const toggle = getOfferToggle(row(id), Date.now());
  if (toggle.kind !== "stop" && toggle.kind !== "start") return { toggle, result: null };
  return { toggle, result: await updateProductAction(offerToggleInput(row(id), toggle)) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  store.clear();
  writes.length = 0;
  invalidateMock.mockReset();
  requireAdminMock.mockReset().mockResolvedValue({ uid: "admin-1", role: "ADMIN" });
  for (const p of [
    product("active", "Active Ring", {
      isOnSale: true,
      salePrice: 7500,
      saleStartAt: at(-2),
      saleEndAt: at(5),
    }),
    product("scheduled", "Scheduled Ring", { isOnSale: true, salePrice: 9000, saleStartAt: at(3) }),
    product("expired", "Expired Ring", { isOnSale: true, salePrice: 8000, saleEndAt: at(-1) }),
    // A switched-off offer keeps its details — one still in period, one whose period has ended.
    product("paused", "Paused Ring", {
      isOnSale: false,
      salePrice: 6000,
      saleStartAt: at(-2),
      saleEndAt: at(8),
    }),
    product("pausedLate", "Paused Late Ring", {
      isOnSale: false,
      salePrice: 6000,
      saleEndAt: at(-3),
    }),
    product("pausedSoon", "Paused Soon Ring", {
      isOnSale: false,
      salePrice: 6000,
      saleStartAt: at(4),
      saleEndAt: at(9),
    }),
    product("plain", "Plain Band"),
  ]) {
    store.set(p.id, p);
  }
});
afterEach(() => vi.useRealTimers());

describe("ACTIVE → DISABLED (stop)", () => {
  it("starts as a genuinely active offer that customers see", async () => {
    expect(statusOf("active")).toBe("ACTIVE");
    expect(storefrontPrice("active")).toEqual({ offerStatus: "ACTIVE", effectivePrice: 7500 });
    expect(await customerOfferIds()).toEqual(["active"]);
    expect(row("active").status).toBe("ACTIVE");
  });

  it("the pill sends only isOnSale: false; the product is not deleted or recreated", async () => {
    const before = store.size;
    const { toggle, result } = await clickPill("active");

    expect(toggle.kind).toBe("stop");
    expect(offerToggleInput(row("active"), { kind: "stop" })).toEqual({
      productId: "active",
      isOnSale: false,
    });
    expect(result?.ok).toBe(true);
    expect(store.size).toBe(before);
    expect(writes).toEqual([{ kind: "update", id: "active" }]); // one update — no set, no delete
    expect(store.get("active")).toMatchObject({
      isOnSale: false,
      price: 10000,
      stock: 5,
      availability: true,
    });
  });

  it("keeps the stored sale price and offer dates (the offer is switched off, not erased)", async () => {
    const original = store.get("active")!;
    await clickPill("active");
    const after = store.get("active")!;
    expect(after["salePrice"]).toBe(7500);
    expect(after["saleStartAt"]!.toMillis()).toBe(original["saleStartAt"]!.toMillis());
    expect(after["saleEndAt"]!.toMillis()).toBe(original["saleEndAt"]!.toMillis());
    expect(after["options"]).toEqual([]); // the partial-update schema fix: nothing else is reset
  });

  it("the status is DERIVED: it reads DISABLED now, with no status field stored anywhere", async () => {
    await clickPill("active");
    expect(statusOf("active")).toBe("DISABLED");
    expect(store.get("active")).not.toHaveProperty("status");
    expect(store.get("active")).not.toHaveProperty("offerStatus");
  });

  it("the storefront uses the regular price at once", async () => {
    await clickPill("active");
    expect(storefrontPrice("active")).toEqual({ offerStatus: "DISABLED", effectivePrice: 10000 });
  });

  it("the customer offers list (the service behind the homepage Special Offers section) drops it", async () => {
    await clickPill("active");
    expect(await customerOfferIds()).toEqual([]);
  });

  it("the admin list keeps the row as DISABLED and the counts follow", async () => {
    await clickPill("active");
    const { offers, choices } = data();
    expect(offers.find((o) => o.productId === "active")).toMatchObject({
      status: "DISABLED",
      salePrice: 7500,
    });
    expect(computeOfferStats(offers)).toEqual({
      total: 6,
      active: 0,
      scheduled: 1,
      expired: 1,
      disabled: 4,
    });
    expect(choices.map((c) => c.id)).toEqual(["plain"]); // not offered to New Offer — it still has its offer
  });

  it("refreshes the storefront cache and leaves every other product untouched", async () => {
    const others = new Map(
      [...store].filter(([id]) => id !== "active").map(([id, d]) => [id, JSON.stringify(d)]),
    );
    await clickPill("active");
    expect(invalidateMock).toHaveBeenCalledTimes(1);
    for (const [id, snapshot] of others) expect(JSON.stringify(store.get(id)), id).toBe(snapshot);
  });

  it("does nothing for a non-admin", async () => {
    requireAdminMock.mockRejectedValue(new FakeForbiddenError());
    const { result } = await clickPill("active");
    expect(result?.ok).toBe(false);
    expect(writes).toEqual([]);
    expect(store.get("active")).toMatchObject({ isOnSale: true });
  });
});

describe("DISABLED → active (start)", () => {
  it("re-activates an offer whose period is still valid, repeating the stored sale price (dates untouched)", async () => {
    const toggle = getOfferToggle(row("paused"), Date.now());
    expect(toggle).toEqual({ kind: "start", resultingStatus: "ACTIVE" });
    expect(offerToggleInput(row("paused"), toggle as never)).toEqual({
      productId: "paused",
      isOnSale: true,
      salePrice: 6000,
    });

    const original = store.get("paused")!;
    const { result } = await clickPill("paused");
    expect(result?.ok).toBe(true);
    expect(store.get("paused")).toMatchObject({ isOnSale: true, salePrice: 6000 });
    expect(store.get("paused")!["saleStartAt"]!.toMillis()).toBe(
      original["saleStartAt"]!.toMillis(),
    );
    expect(store.get("paused")!["saleEndAt"]!.toMillis()).toBe(original["saleEndAt"]!.toMillis());
    expect(statusOf("paused")).toBe("ACTIVE");
    expect(storefrontPrice("paused")).toEqual({ offerStatus: "ACTIVE", effectivePrice: 6000 });
    expect((await customerOfferIds()).sort()).toEqual(["active", "paused"]);
    expect(store.size).toBe(7); // nothing created or removed
  });

  it("an offer whose start date is still ahead becomes SCHEDULED — customers keep the regular price", async () => {
    expect(getOfferToggle(row("pausedSoon"), Date.now())).toEqual({
      kind: "start",
      resultingStatus: "SCHEDULED",
    });
    await clickPill("pausedSoon");
    expect(statusOf("pausedSoon")).toBe("SCHEDULED");
    expect(storefrontPrice("pausedSoon")).toEqual({
      offerStatus: "SCHEDULED",
      effectivePrice: 10000,
    });
    expect(await customerOfferIds()).not.toContain("pausedSoon");
  });

  it("an expired offer is NOT reactivated: the pill is blocked and nothing is written", async () => {
    expect(getOfferToggle(row("pausedLate"), Date.now())).toEqual({
      kind: "blocked",
      reason: "expired",
    });
    writes.length = 0;
    const { result } = await clickPill("pausedLate");
    expect(result).toBeNull();
    expect(writes).toEqual([]);
    expect(store.get("pausedLate")).toMatchObject({ isOnSale: false });
  });

  it("even if isOnSale were forced on for an expired period, the derived status stays EXPIRED at the regular price", async () => {
    await updateProductAction({ productId: "pausedLate", isOnSale: true, salePrice: 6000 });
    expect(statusOf("pausedLate")).toBe("EXPIRED");
    expect(storefrontPrice("pausedLate")).toEqual({
      offerStatus: "EXPIRED",
      effectivePrice: 10000,
    });
    expect(await customerOfferIds()).not.toContain("pausedLate");
  });

  it("a stored sale price that is no longer below the regular price blocks the start", () => {
    const bad: OfferRow = { ...row("paused"), salePrice: 10000 };
    expect(getOfferToggle(bad, Date.now())).toEqual({ kind: "blocked", reason: "invalidPrice" });
  });
});

describe("SCHEDULED and EXPIRED are not toggleable", () => {
  it("offers no action, and never sends anything", async () => {
    expect(getOfferToggle(row("scheduled"), Date.now())).toEqual({ kind: "none" });
    expect(getOfferToggle(row("expired"), Date.now())).toEqual({ kind: "none" });
    expect((await clickPill("scheduled")).result).toBeNull();
    expect((await clickPill("expired")).result).toBeNull();
    expect(writes).toEqual([]);
  });
});
