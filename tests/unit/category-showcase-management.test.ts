import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateCategoryShowcaseSchema } from "@/lib/validation/categoryShowcase.schema";

/**
 * T161: `updateCategoryShowcaseAction` rejects an unknown `categoryId` and
 * a `title` missing `en`.
 */

describe("updateCategoryShowcaseSchema", () => {
  it("rejects a title missing `en`", () => {
    const result = updateCategoryShowcaseSchema.safeParse({
      showcaseId: "s1",
      title: { ar: "أساور" },
    });
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
const setMock = vi.fn();

vi.mock("@/lib/firebase/firestore", () => ({
  categoryShowcasesCollection: () => ({
    doc: (id = "new-showcase") => ({
      id,
      get: async () => {
        const data = docs.get(id);
        return { exists: Boolean(data), data: () => data };
      },
      update: (patch: unknown) => updateMock(id, patch),
    }),
    // `where("categoryId", "==", value).limit(n).get()` over the fake documents.
    where: (_field: string, _op: string, value: string) => ({
      limit: () => ({
        get: async () => {
          const matches = [...docs]
            .filter(([, d]) => d.categoryId === value)
            .map(([id]) => ({ id }));
          return { docs: matches, empty: matches.length === 0 };
        },
      }),
    }),
    firestore: {
      runTransaction: async (
        fn: (tx: {
          get: (q: { get: () => unknown }) => unknown;
          set: (ref: { id: string }, data: unknown) => void;
        }) => unknown,
      ) => fn({ get: (query) => query.get(), set: (ref, data) => setMock(ref.id, data) }),
    },
  }),
}));

const { createCategoryShowcaseAction, updateCategoryShowcaseAction } =
  await import("@/actions/admin/category-showcase.actions");

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

    const result = await updateCategoryShowcaseAction({
      showcaseId: "s1",
      categoryId: "unknown-category",
    });

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

  it("refuses to move a showcase onto a category that already has one", async () => {
    docs.set("s1", { ...baseShowcase(), categoryId: "rings" });
    docs.set("s2", baseShowcase()); // bracelets

    const result = await updateCategoryShowcaseAction({ showcaseId: "s2", categoryId: "rings" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("still saves when the showcase keeps its own category", async () => {
    docs.set("s1", { ...baseShowcase(), categoryId: "rings" });

    const result = await updateCategoryShowcaseAction({
      showcaseId: "s1",
      categoryId: "rings",
      title: { en: "Rings, reworded", ar: null },
    });

    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});

describe("updateCategoryShowcaseAction — status pill toggle", () => {
  beforeEach(() => {
    docs.clear();
    updateMock.mockReset();
    requireAdminMock.mockReset().mockResolvedValue({ uid: "admin-1", role: "ADMIN" });
  });

  it("sets an ACTIVE showcase INACTIVE on its existing isActive field, keeping every other field", async () => {
    docs.set("s1", baseShowcase());

    const result = await updateCategoryShowcaseAction({ showcaseId: "s1", isActive: false });

    expect(result).toEqual({ ok: true, data: null });
    expect(updateMock).toHaveBeenCalledTimes(1);
    const [id, patch] = updateMock.mock.calls[0]!;
    const { updatedAt: _updatedAt, ...fields } = patch as Record<string, unknown>;
    expect(id).toBe("s1");
    expect(fields).toEqual({ ...baseShowcase(), isActive: false });
  });

  it("sets an INACTIVE showcase back to ACTIVE", async () => {
    docs.set("s1", { ...baseShowcase(), isActive: false });

    const result = await updateCategoryShowcaseAction({ showcaseId: "s1", isActive: true });

    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledWith("s1", expect.objectContaining({ isActive: true }));
  });

  it("rejects a non-admin caller without writing", async () => {
    docs.set("s1", baseShowcase());
    requireAdminMock.mockRejectedValue(new FakeForbiddenError());

    const result = await updateCategoryShowcaseAction({ showcaseId: "s1", isActive: false });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean status without writing", async () => {
    docs.set("s1", baseShowcase());

    const result = await updateCategoryShowcaseAction({ showcaseId: "s1", isActive: "INACTIVE" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("createCategoryShowcaseAction", () => {
  const valid = {
    categoryId: "rings",
    title: { en: "Rings", ar: "خواتم" },
    subtitle: null,
    cta: { en: "Shop Rings", ar: null },
    desktopImage: { url: "https://example.com/d.jpg", storagePath: "showcases/new/d.jpg" },
    mobileImage: null,
    displayOrder: 5,
    isActive: true,
  };

  beforeEach(() => {
    docs.clear();
    setMock.mockReset();
    requireAdminMock.mockReset().mockResolvedValue({ uid: "admin-1", role: "ADMIN" });
  });

  it("rejects a non-admin caller without writing", async () => {
    requireAdminMock.mockRejectedValue(new FakeForbiddenError());
    const result = await createCategoryShowcaseAction(valid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(setMock).not.toHaveBeenCalled();
  });

  it("requires a desktop image", async () => {
    const result = await createCategoryShowcaseAction({ ...valid, desktopImage: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(setMock).not.toHaveBeenCalled();
  });

  it("refuses a second showcase for a category that already has one", async () => {
    docs.set("s1", { ...baseShowcase(), categoryId: "rings" });

    const result = await createCategoryShowcaseAction(valid);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
    expect(setMock).not.toHaveBeenCalled();
  });

  it("creates the showcase for a category that has none", async () => {
    docs.set("s1", baseShowcase()); // bracelets only

    const result = await createCategoryShowcaseAction(valid);

    expect(result).toEqual({ ok: true, data: { showcaseId: "new-showcase" } });
    expect(setMock).toHaveBeenCalledWith(
      "new-showcase",
      expect.objectContaining({
        id: "new-showcase",
        categoryId: "rings",
        title: { en: "Rings", ar: "خواتم" },
        desktopImage: valid.desktopImage,
        mobileImage: null,
        displayOrder: 5,
        isActive: true,
      }),
    );
  });
});
