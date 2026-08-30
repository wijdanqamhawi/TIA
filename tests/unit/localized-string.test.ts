import { describe, expect, it } from "vitest";
import { resolveLocalizedString } from "@/types/localizedString";
import { localizedStringSchema } from "@/lib/validation/localizedString.schema";

describe("resolveLocalizedString", () => {
  it("returns the Arabic value when present and locale is ar", () => {
    expect(resolveLocalizedString({ en: "Bracelets", ar: "أساور" }, "ar")).toBe("أساور");
  });

  it("falls back to English when ar is null and locale is ar", () => {
    expect(resolveLocalizedString({ en: "Bracelets", ar: null }, "ar")).toBe("Bracelets");
  });

  it("returns English when locale is en, regardless of ar", () => {
    expect(resolveLocalizedString({ en: "Bracelets", ar: "أساور" }, "en")).toBe("Bracelets");
  });
});

describe("localizedStringSchema", () => {
  it("normalizes an empty-string ar to null", () => {
    const result = localizedStringSchema.parse({ en: "Bracelets", ar: "" });
    expect(result.ar).toBeNull();
  });

  it("rejects a missing en", () => {
    expect(localizedStringSchema.safeParse({ ar: "أساور" }).success).toBe(false);
  });

  it("rejects an empty en", () => {
    expect(localizedStringSchema.safeParse({ en: "", ar: null }).success).toBe(false);
  });
});
