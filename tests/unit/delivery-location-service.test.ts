import { describe, expect, it, vi, beforeEach } from "vitest";

const whereMock = vi.fn();
const limitMock = vi.fn();
const getMock = vi.fn();

vi.mock("@/lib/firebase/firestore", () => ({
  deliveryLocationsCollection: () => ({ where: whereMock }),
  deliveryRegionsCollection: () => ({}),
}));

import {
  deriveDeliveryLocationSlug,
  buildDeliveryLocationSearchTerms,
  assertUniqueDeliveryLocationSlug,
  assertValidDeliveryRegionId,
} from "@/lib/domain/delivery/deliveryLocation.service";

describe("deriveDeliveryLocationSlug (T265)", () => {
  it("mirrors bilingual product slug derivation (lowercase, hyphenated, English-only source)", () => {
    expect(deriveDeliveryLocationSlug("Ramallah")).toBe("ramallah");
    expect(deriveDeliveryLocationSlug("Beit Sahour")).toBe("beit-sahour");
  });
});

describe("buildDeliveryLocationSearchTerms (T265)", () => {
  it("mirrors bilingual product search-token behavior — tokenizes both languages, deduplicated", () => {
    const terms = buildDeliveryLocationSearchTerms("Ramallah", "رام الله");
    expect(terms).toContain("ramallah");
    expect(terms).toContain("رام");
    expect(terms).toContain("الله");
  });

  it("handles a null Arabic name gracefully", () => {
    const terms = buildDeliveryLocationSearchTerms("Ramallah", null);
    expect(terms).toEqual(["ramallah"]);
  });
});

describe("assertValidDeliveryRegionId (T266)", () => {
  it("accepts the two fixed region IDs", () => {
    expect(() => assertValidDeliveryRegionId("west-bank")).not.toThrow();
    expect(() => assertValidDeliveryRegionId("inside-1948")).not.toThrow();
  });

  it("rejects any other value", () => {
    expect(() => assertValidDeliveryRegionId("gaza")).toThrow();
    expect(() => assertValidDeliveryRegionId("")).toThrow();
  });
});

describe("assertUniqueDeliveryLocationSlug (T265, per-region uniqueness)", () => {
  beforeEach(() => {
    whereMock.mockReset().mockReturnValue({ where: whereMock, limit: limitMock });
    limitMock.mockReset().mockReturnValue({ get: getMock });
    getMock.mockReset();
  });

  it("rejects a duplicate slug within the same region", async () => {
    getMock.mockResolvedValue({ docs: [{ id: "existing-doc" }] });
    await expect(assertUniqueDeliveryLocationSlug("west-bank", "ramallah")).rejects.toThrow();
  });

  it("allows the same slug text in a different region query (each region checked independently)", async () => {
    // The service scopes the query itself by regionId — a call for
    // "inside-1948" with an empty result set (no conflict in *that*
    // region) must succeed regardless of what exists in "west-bank".
    getMock.mockResolvedValue({ docs: [] });
    await expect(assertUniqueDeliveryLocationSlug("inside-1948", "ramallah")).resolves.toBeUndefined();
    expect(whereMock).toHaveBeenCalledWith("regionId", "==", "inside-1948");
  });

  it("does not conflict with itself when excludeLocationId matches the only match", async () => {
    getMock.mockResolvedValue({ docs: [{ id: "self-id" }] });
    await expect(
      assertUniqueDeliveryLocationSlug("west-bank", "ramallah", { excludeLocationId: "self-id" }),
    ).resolves.toBeUndefined();
  });
});
