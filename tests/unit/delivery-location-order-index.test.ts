import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Firestore emulator does not enforce composite indexes, so a query that
 * needs one passes every emulator test and then fails in production with
 * FAILED_PRECONDITION ("The query requires an index"). This pins the contract:
 * `getNextDeliveryLocationOrder`'s real query shape is recorded, the composite
 * index that shape requires is derived from it, and that index must be in the
 * version-controlled `firestore.indexes.json` that gets deployed.
 */

type Call = { method: string; args: unknown[] };
const calls: Call[] = [];
let highestDoc: { displayOrder: number } | null = null;

function chain(): unknown {
  const handler: ProxyHandler<object> = {
    get(_target, method: string) {
      if (method === "get") {
        return async () => ({ docs: highestDoc ? [{ data: () => highestDoc }] : [] });
      }
      return (...args: unknown[]) => {
        calls.push({ method, args });
        return chain();
      };
    },
  };
  return new Proxy({}, handler);
}

vi.mock("@/lib/firebase/firestore", () => ({
  deliveryLocationsCollection: () => chain(),
  deliveryRegionsCollection: () => chain(),
}));

const { getNextDeliveryLocationOrder } = await import("@/lib/domain/delivery/deliveryLocation.service");

type IndexField = { fieldPath: string; order: "ASCENDING" | "DESCENDING" };

/** The composite index Firestore needs for `where(field == value)… orderBy(field, dir)`: equality fields (ascending), then the ordered field. */
function requiredIndex(recorded: Call[]): IndexField[] {
  const equality = recorded
    .filter((c) => c.method === "where" && c.args[1] === "==")
    .map((c): IndexField => ({ fieldPath: String(c.args[0]), order: "ASCENDING" }));
  const ordered = recorded
    .filter((c) => c.method === "orderBy")
    .map((c): IndexField => ({ fieldPath: String(c.args[0]), order: c.args[1] === "desc" ? "DESCENDING" : "ASCENDING" }));
  return [...equality, ...ordered];
}

beforeEach(() => {
  calls.length = 0;
  highestDoc = null;
});

describe("getNextDeliveryLocationOrder", () => {
  it("asks for the highest displayOrder in the region only: where(regionId ==).orderBy(displayOrder desc).limit(1)", async () => {
    await getNextDeliveryLocationOrder("west-bank");
    expect(calls).toEqual([
      { method: "where", args: ["regionId", "==", "west-bank"] },
      { method: "orderBy", args: ["displayOrder", "desc"] },
      { method: "limit", args: [1] },
    ]);
  });

  it("returns the highest existing order + 1", async () => {
    highestDoc = { displayOrder: 7 };
    expect(await getNextDeliveryLocationOrder("west-bank")).toBe(8);
  });

  it("returns 1 for a region with no locations", async () => {
    expect(await getNextDeliveryLocationOrder("inside-1948")).toBe(1);
  });

  it("requires a composite index that is defined in firestore.indexes.json (so `firebase deploy` creates it)", async () => {
    await getNextDeliveryLocationOrder("west-bank");
    const needed = requiredIndex(calls);
    expect(needed).toEqual([
      { fieldPath: "regionId", order: "ASCENDING" },
      { fieldPath: "displayOrder", order: "DESCENDING" },
    ]);

    const file = JSON.parse(readFileSync(resolve(__dirname, "../../firestore.indexes.json"), "utf8")) as {
      indexes: { collectionGroup: string; queryScope: string; fields: IndexField[] }[];
    };
    const defined = file.indexes.filter((index) => index.collectionGroup === "deliveryLocations");
    expect(defined.map((index) => index.fields)).toContainEqual(needed);
    expect(defined.find((index) => JSON.stringify(index.fields) === JSON.stringify(needed))?.queryScope).toBe("COLLECTION");
  });

  it("keeps the ascending list index too — the admin list and checkout still order ascending", () => {
    const file = JSON.parse(readFileSync(resolve(__dirname, "../../firestore.indexes.json"), "utf8")) as {
      indexes: { collectionGroup: string; fields: IndexField[] }[];
    };
    const fields = file.indexes.filter((index) => index.collectionGroup === "deliveryLocations").map((index) => index.fields);
    expect(fields).toContainEqual([
      { fieldPath: "regionId", order: "ASCENDING" },
      { fieldPath: "displayOrder", order: "ASCENDING" },
    ]);
  });
});
