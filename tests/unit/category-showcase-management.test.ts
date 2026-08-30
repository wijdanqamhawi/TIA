import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateCategoryShowcaseSchema } from "@/lib/validation/categoryShowcase.schema";

/**
 * T161: `updateCategoryShowcaseAction` rejects an unknown `categoryId` and
 * a `title` missing `en`.
 */

describe("updateCategoryShowcaseSchema", () => {
  it("rejects a title missing `en`", () => {
    const result = updateCategoryShowcaseSchema.safeParse({ showcaseId: "s1", title: { ar: "أساور" } });
    expect(result.success).toBe(false);
  });

  it("rejects a missing showcaseId", () => {
    const result = updateCategoryShowcaseSchema.safeParse({ title: { en: "Bracelets", ar: null } });
    expect(result.success).toBe(false);
  });
});

const requireAdminMock = vi.fn();
class FakeForbiddenError extends Error {}
class FakeUnauthenticatedError extends Error {}

vi.mock("@/lib/firebase/guards", () => ({
  requireAdmin: () => requireAdminMock(),
  ForbiddenError: FakeForbiddenError,
  UnauthenticatedError: FakeUnauthenticatedError,
}));

vi.mock("@/lib/domain/catalog/category.service", () => ({
  categoryExists: async (categoryId: string) => categoryId === "rings",
}));

type FakeShowcase = {
  categoryId: string;
  title: { en: string; ar: string | null };
  subtitle: null;
  cta: { en: string; ar: string | null };
  desktopImage: { url: string; storagePath: string };
  mobileImage: null;
  displayOrder: number;
  isActive: boolean;
};
const docs = new Map<string, FakeShowcase>();
const updateMock = vi.fn();

vi.mock("@/lib/firebase/firestore", () => ({
  categoryShowcasesCollection: () => ({
    doc: (id: string) => ({
      get: async () => {
        const data = docs.get(id);
        return { exists: Boolean(data), data: () => data };
      },
      update: (patch: unknown) => updateMock(id, patch),
    }),
  }),
}));

const { updateCategoryShowcaseAction } = await import("@/actions/admin/category-showcase.actions");

function baseShowcase(): FakeShowcase {
  return {
    categoryId: "bracelets",
    title: { en: "Bracelets", ar: null },
    subtitle: null,
    cta: { en: "Shop Now", ar: null },
    desktopImage: { url: "https://example.com/d.jpg", storagePath: "showcases/d.jpg" },
    mobileImage: null,
    displayOrder: 1,
    isActive: true,
  };
}

describe("updateCategoryShowcaseAction", () => {
  beforeEach(() => {
    docs.clear();
    updateMock.mockReset();
    requireAdminMock.mockReset().mockResolvedValue({ uid: "admin-1", role: "ADMIN" });
  });

  it("returns NOT_FOUND for an unknown showcaseId", async () => {
    const result = await updateCategoryShowcaseAction({ showcaseId: "missing", displayOrder: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("rejects a categoryId that no longer exists", async () => {
    docs.set("s1", baseShowcase());

    const result = await updateCategoryShowcaseAction({ showcaseId: "s1", categoryId: "unknown-category" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("accepts a categoryId that does exist", async () => {
    docs.set("s1", baseShowcase());

    const result = await updateCategoryShowcaseAction({ showcaseId: "s1", categoryId: "rings" });

    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
