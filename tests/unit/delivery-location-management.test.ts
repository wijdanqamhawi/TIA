import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit-tests the admin delivery-location Server Actions (T282/T283):
 * `updateDeliveryRegionAction` rejects an unknown `regionId`;
 * `createDeliveryLocationAction`/`updateDeliveryLocationAction` reject a
 * `name` missing `en` and a duplicate slug within the same region.
 */

const requireAdminMock = vi.fn();

class FakeForbiddenError extends Error {}
class FakeUnauthenticatedError extends Error {}

vi.mock("@/lib/firebase/guards", () => ({
  requireAdmin: () => requireAdminMock(),
  ForbiddenError: FakeForbiddenError,
  UnauthenticatedError: FakeUnauthenticatedError,
}));

type FakeRegion = { regionId: string; name: { en: string; ar: string | null }; displayOrder: number; isActive: boolean };
type FakeLocation = {
  regionId: string;
  name: { en: string; ar: string | null };
  slug: string;
  searchTerms: string[];
  displayOrder: number;
  isActive: boolean;
};

const regionDocs = new Map<string, FakeRegion>();
const locationDocs = new Map<string, FakeLocation>();
const regionUpdateMock = vi.fn();
const locationUpdateMock = vi.fn();
const locationSetMock = vi.fn();
const locationDeleteMock = vi.fn();

vi.mock("@/lib/firebase/firestore", () => ({
  deliveryRegionsCollection: () => ({
    doc: (id: string) => ({
      get: async () => {
        const data = regionDocs.get(id);
        return { exists: Boolean(data), data: () => data };
      },
      update: (patch: unknown) => regionUpdateMock(id, patch),
    }),
  }),
  deliveryLocationsCollection: () => ({
    doc: (id?: string) => {
      const docId = id ?? `generated-${locationDocs.size + 1}`;
      return {
        id: docId,
        get: async () => {
          const data = locationDocs.get(docId);
          return { exists: Boolean(data), data: () => data };
        },
        set: (data: unknown) => locationSetMock(docId, data),
        update: (patch: unknown) => locationUpdateMock(docId, patch),
        delete: () => locationDeleteMock(docId),
      };
    },
    where: (field1: string, _op1: string, value1: string) => ({
      where: (field2: string, _op2: string, value2: string) => ({
        limit: () => ({
          get: async () => {
            const filters: Record<string, string> = { [field1]: value1, [field2]: value2 };
            const conflict = Array.from(locationDocs.entries()).find(
              ([, doc]) => doc.regionId === filters.regionId && doc.slug === filters.slug,
            );
            return { docs: conflict ? [{ id: conflict[0] }] : [] };
          },
        }),
      }),
    }),
  }),
}));

const { updateDeliveryRegionAction, createDeliveryLocationAction, updateDeliveryLocationAction } = await import(
  "@/actions/admin/delivery-location.actions"
);

describe("updateDeliveryRegionAction (T282)", () => {
  beforeEach(() => {
    regionDocs.clear();
    regionUpdateMock.mockReset();
    requireAdminMock.mockReset().mockResolvedValue({ uid: "admin-1", role: "ADMIN" });
    regionDocs.set("west-bank", {
      regionId: "west-bank",
      name: { en: "West Bank", ar: "الضفة الغربية" },
      displayOrder: 1,
      isActive: true,
    });
  });

  it("rejects a non-admin/unauthenticated caller without touching Firestore", async () => {
    requireAdminMock.mockRejectedValue(new FakeForbiddenError());
    const result = await updateDeliveryRegionAction({ regionId: "west-bank", isActive: false });
    expect(result.ok).toBe(false);
    expect(regionUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown regionId", async () => {
    const result = await updateDeliveryRegionAction({ regionId: "gaza", isActive: false });
    expect(result.ok).toBe(false);
    expect(regionUpdateMock).not.toHaveBeenCalled();
  });

  it("updates an existing fixed region", async () => {
    const result = await updateDeliveryRegionAction({ regionId: "west-bank", displayOrder: 2 });
    expect(result.ok).toBe(true);
    expect(regionUpdateMock).toHaveBeenCalledWith("west-bank", expect.objectContaining({ displayOrder: 2 }));
  });
});

describe("createDeliveryLocationAction / updateDeliveryLocationAction (T283)", () => {
  beforeEach(() => {
    locationDocs.clear();
    locationSetMock.mockReset();
    locationUpdateMock.mockReset();
    requireAdminMock.mockReset().mockResolvedValue({ uid: "admin-1", role: "ADMIN" });
    locationDocs.set("existing-ramallah", {
      regionId: "west-bank",
      name: { en: "Ramallah", ar: "رام الله" },
      slug: "ramallah",
      searchTerms: ["ramallah"],
      displayOrder: 1,
      isActive: true,
    });
  });

  it("rejects a name missing `en`", async () => {
    const result = await createDeliveryLocationAction({
      regionId: "west-bank",
      name: { ar: "نابلس" },
      displayOrder: 2,
      isActive: true,
    });
    expect(result.ok).toBe(false);
    expect(locationSetMock).not.toHaveBeenCalled();
  });

  it("rejects a duplicate slug within the same region", async () => {
    const result = await createDeliveryLocationAction({
      regionId: "west-bank",
      name: { en: "Ramallah", ar: null },
      displayOrder: 2,
      isActive: true,
    });
    expect(result.ok).toBe(false);
    expect(locationSetMock).not.toHaveBeenCalled();
  });

  it("allows the same slug text in a different region", async () => {
    const result = await createDeliveryLocationAction({
      regionId: "inside-1948",
      name: { en: "Ramallah", ar: null },
      displayOrder: 2,
      isActive: true,
    });
    expect(result.ok).toBe(true);
    expect(locationSetMock).toHaveBeenCalled();
  });

  it("updateDeliveryLocationAction rejects renaming to a slug already used in the same region", async () => {
    locationDocs.set("nablus", {
      regionId: "west-bank",
      name: { en: "Nablus", ar: "نابلس" },
      slug: "nablus",
      searchTerms: ["nablus"],
      displayOrder: 2,
      isActive: true,
    });

    const result = await updateDeliveryLocationAction({ locationId: "nablus", name: { en: "Ramallah", ar: null } });
    expect(result.ok).toBe(false);
    expect(locationUpdateMock).not.toHaveBeenCalled();
  });
});
