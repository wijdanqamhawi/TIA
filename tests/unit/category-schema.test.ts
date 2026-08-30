import { describe, expect, it } from "vitest";
import { categorySchema } from "@/lib/validation/category.schema";
import { categoryShowcaseSchema } from "@/lib/validation/categoryShowcase.schema";

describe("categorySchema", () => {
  const valid = {
    name: { en: "Bracelets", ar: "أساور" },
    displayOrder: 1,
    isActive: true,
  };

  it("accepts a valid category", () => {
    expect(categorySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a negative displayOrder", () => {
    expect(categorySchema.safeParse({ ...valid, displayOrder: -1 }).success).toBe(false);
  });

  it("rejects a non-integer displayOrder", () => {
    expect(categorySchema.safeParse({ ...valid, displayOrder: 1.5 }).success).toBe(false);
  });

  it("rejects a name missing `en`", () => {
    expect(categorySchema.safeParse({ ...valid, name: { ar: "أساور" } }).success).toBe(false);
  });
});

describe("categoryShowcaseSchema", () => {
  const valid = {
    categoryId: "bracelets",
    title: { en: "Bracelets", ar: "أساور" },
    cta: { en: "Shop Bracelets", ar: "تسوقي الأساور" },
    desktopImage: { url: "https://example.com/desktop.jpg", storagePath: "showcases/desktop.jpg" },
    displayOrder: 1,
    isActive: true,
  };

  it("accepts a valid showcase", () => {
    expect(categoryShowcaseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a negative displayOrder", () => {
    expect(categoryShowcaseSchema.safeParse({ ...valid, displayOrder: -1 }).success).toBe(false);
  });

  it("rejects a missing desktopImage", () => {
    const { desktopImage: _desktopImage, ...withoutImage } = valid;
    expect(categoryShowcaseSchema.safeParse(withoutImage).success).toBe(false);
  });
});
