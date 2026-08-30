import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/utils/slugify";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Gold Bangle Bracelet")).toBe("gold-bangle-bracelet");
  });

  it("strips diacritics and punctuation", () => {
    expect(slugify("Café Élora — Ring!")).toBe("cafe-elora-ring");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  --Watch--  ")).toBe("watch");
  });
});
