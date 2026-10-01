import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { updateCategorySchema } from "@/lib/validation/category.schema";
import { CategorySelect } from "@/components/admin/CategorySelect";

/**
 * T157: `updateCategoryAction` rejects a negative `displayOrder`, an
 * unknown `categoryId`, and a `name` missing `en`; `CategorySelect` (T153)
 * excludes an inactivated category.
 */

describe("updateCategorySchema", () => {
  it("rejects a negative displayOrder", () => {
    const result = updateCategorySchema.safeParse({ categoryId: "c1", displayOrder: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a name missing `en`", () => {
    const result = updateCategorySchema.safeParse({ categoryId: "c1", name: { ar: "أساور" } });
    expect(result.success).toBe(false);
  });

  it("rejects a missing categoryId", () => {
    const result = updateCategorySchema.safeParse({ displayOrder: 1 });
    expect(result.success).toBe(false);
  });
});

describe("CategorySelect", () => {
  it("only renders the categories it's given — the caller (admin product/showcase forms) is responsible for passing only active ones (T153)", () => {
    render(
      <CategorySelect
        categories={[
          { id: "bracelets", nameEn: "Bracelets" },
          { id: "rings", nameEn: "Rings" },
        ]}
        value=""
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole("option", { name: "Bracelets" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Rings" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Earrings" })).toBeNull();
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

type FakeCategory = {
  name: { en: string; ar: string | null };
  slug: string;
  description: null;
  displayOrder: number;
  isActive: boolean;
};
const docs = new Map<string, FakeCategory>();
const updateMock = vi.fn();
const createMock = vi.fn();
const queryDocs: { id: string }[] = [];

vi.mock("@/lib/firebase/firestore", () => ({
  categoriesCollection: () => ({
    doc: (id: string) => ({
      get: async () => {
        const data = docs.get(id);
        return { exists: Boolean(data), data: () => data, id };
      },
      update: (patch: unknown) => updateMock(id, patch),
      create: (data: unknown) => createMock(id, data),
    }),
    where: () => ({
      limit: () => ({
        get: async () => ({ docs: queryDocs }),
      }),
    }),
  }),
}));

const { createCategoryAction, updateCategoryAction } =
  await import("@/actions/admin/category.actions");

describe("updateCategoryAction", () => {
  beforeEach(() => {
    docs.clear();
    queryDocs.length = 0;
    updateMock.mockReset();
    requireAdminMock.mockReset().mockResolvedValue({ uid: "admin-1", role: "ADMIN" });
  });

  it("rejects a non-admin caller", async () => {
    requireAdminMock.mockRejectedValue(new FakeForbiddenError());
    const result = await updateCategoryAction({ categoryId: "c1", displayOrder: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("returns NOT_FOUND for an unknown categoryId", async () => {
    const result = await updateCategoryAction({ categoryId: "unknown", displayOrder: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("updates displayOrder/isActive without touching name/slug when name is omitted", async () => {
    docs.set("c1", {
      name: { en: "Bracelets", ar: null },
      slug: "bracelets",
      description: null,
      displayOrder: 1,
      isActive: true,
    });

    const result = await updateCategoryAction({ categoryId: "c1", isActive: false });

    expect(result.ok).toBe(true);
    const [, patch] = updateMock.mock.calls[0];
    expect(patch).toMatchObject({ isActive: false, slug: "bracelets" });
  });
});

describe("createCategoryAction", () => {
  const valid = {
    name: { en: "Necklaces", ar: "قلائد" },
    description: null,
    displayOrder: 5,
    isActive: true,
  };

  beforeEach(() => {
    docs.clear();
    queryDocs.length = 0;
    createMock.mockReset().mockResolvedValue(undefined);
    requireAdminMock.mockReset().mockResolvedValue({ uid: "admin-1", role: "ADMIN" });
  });

  it("rejects a non-admin caller without writing", async () => {
    requireAdminMock.mockRejectedValue(new FakeForbiddenError());
    const result = await createCategoryAction(valid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("requires both the English and the Arabic name", async () => {
    for (const name of [
      { en: "", ar: "قلائد" },
      { en: "Necklaces", ar: "  " },
      { en: "Necklaces", ar: null },
    ]) {
      const result = await createCategoryAction({ ...valid, name });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid display order", async () => {
    for (const displayOrder of [-1, 1.5, Number.NaN]) {
      const result = await createCategoryAction({ ...valid, displayOrder });
      expect(result.ok).toBe(false);
    }
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects an English name with no letters or numbers", async () => {
    const result = await createCategoryAction({ ...valid, name: { en: "***", ar: "قلائد" } });
    expect(result.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates the category under its slug, with the seeded categories' shape", async () => {
    const result = await createCategoryAction({
      ...valid,
      name: { en: "  Necklaces ", ar: " قلائد " },
    });
    expect(result).toEqual({ ok: true, data: { categoryId: "necklaces" } });
    const [id, data] = createMock.mock.calls[0];
    expect(id).toBe("necklaces");
    expect(data).toMatchObject({
      id: "necklaces",
      name: { en: "Necklaces", ar: "قلائد" },
      slug: "necklaces",
      description: null,
      displayOrder: 5,
      isActive: true,
    });
  });

  it("refuses a name whose slug is already taken", async () => {
    queryDocs.push({ id: "rings" });
    const result = await createCategoryAction({ ...valid, name: { en: "Rings", ar: "خواتم" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("reports CONFLICT when the document id already exists", async () => {
    createMock.mockRejectedValue(Object.assign(new Error("exists"), { code: 6 }));
    const result = await createCategoryAction(valid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
  });
});
