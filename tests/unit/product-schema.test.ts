import { describe, expect, it } from "vitest";
import { productSchema } from "@/lib/validation/product.schema";

const validProduct = {
  name: { en: "Gold Ring", ar: "خاتم ذهبي" },
  description: { en: "A ring.", ar: "خاتم." },
  material: { en: "Gold", ar: "ذهب" },
  price: 10000,
  categoryId: "rings",
  images: [{ url: "https://example.com/a.jpg", storagePath: "products/a.jpg", position: 0, alt: "Gold Ring" }],
  options: [],
  stock: 5,
  availability: true,
};

describe("productSchema", () => {
  it("accepts a fully valid product", () => {
    expect(productSchema.safeParse(validProduct).success).toBe(true);
  });

  it("rejects a negative price", () => {
    const result = productSchema.safeParse({ ...validProduct, price: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects a zero price", () => {
    const result = productSchema.safeParse({ ...validProduct, price: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer price", () => {
    const result = productSchema.safeParse({ ...validProduct, price: 19.99 });
    expect(result.success).toBe(false);
  });

  it("rejects negative stock", () => {
    const result = productSchema.safeParse({ ...validProduct, stock: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts zero stock (a valid Sold Out state)", () => {
    const result = productSchema.safeParse({ ...validProduct, stock: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects a missing categoryId", () => {
    const { categoryId: _categoryId, ...withoutCategory } = validProduct;
    const result = productSchema.safeParse(withoutCategory);
    expect(result.success).toBe(false);
  });

  it("rejects an empty-string categoryId", () => {
    const result = productSchema.safeParse({ ...validProduct, categoryId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a LocalizedString field missing `en`", () => {
    const result = productSchema.safeParse({ ...validProduct, name: { ar: "خاتم ذهبي" } });
    expect(result.success).toBe(false);
  });

  it("accepts a LocalizedString field with `ar: null`", () => {
    const result = productSchema.safeParse({ ...validProduct, name: { en: "Gold Ring", ar: null } });
    expect(result.success).toBe(true);
  });

  it("defaults isOnSale/salePrice/saleStartAt/saleEndAt when omitted", () => {
    const result = productSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isOnSale).toBe(false);
      expect(result.data.salePrice).toBeNull();
      expect(result.data.saleStartAt).toBeNull();
      expect(result.data.saleEndAt).toBeNull();
    }
  });

  it("rejects a salePrice equal to the regular price (spec FR-114, SC-027)", () => {
    const result = productSchema.safeParse({ ...validProduct, price: 10000, isOnSale: true, salePrice: 10000 });
    expect(result.success).toBe(false);
  });

  it("rejects a salePrice greater than the regular price", () => {
    const result = productSchema.safeParse({ ...validProduct, price: 10000, isOnSale: true, salePrice: 12000 });
    expect(result.success).toBe(false);
  });

  it("rejects isOnSale: true with no salePrice set", () => {
    const result = productSchema.safeParse({ ...validProduct, isOnSale: true, salePrice: null });
    expect(result.success).toBe(false);
  });

  it("rejects isOnSale: true with a non-positive salePrice", () => {
    const result = productSchema.safeParse({ ...validProduct, isOnSale: true, salePrice: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts a valid on-sale product with a lower salePrice", () => {
    const result = productSchema.safeParse({ ...validProduct, price: 10000, isOnSale: true, salePrice: 8000 });
    expect(result.success).toBe(true);
  });
});
