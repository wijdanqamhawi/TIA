import type { ProductImage, ProductOption } from "@/types/product";
import type { LocalizedString } from "@/types/localizedString";

/**
 * Derives a product's *photographed* colour variants from the product data
 * that already exists — its `options` and the `valueKey` already carried by
 * `ProductImage` (the same field the detail-page gallery switches on).
 *
 * ── NO NEW VARIANT SYSTEM ────────────────────────────────────────────────
 * Nothing here is stored, seeded or written. A "variant" is simply an
 * existing option value that already has at least one image tagged with its
 * `valueKey`. One product, one price, one card — this only decides which of
 * that product's own photographs to show.
 *
 * A variant is only reported when it has real photography of its own,
 * because the card's entire purpose is swapping the image: offering a
 * swatch that cannot change the picture would be a dead control. Fewer than
 * two photographed values means there is nothing to choose between, so the
 * result is empty and the card renders exactly as it always has — which is
 * what keeps every product without colour variants untouched.
 */
export const COLOR_OPTION_KEY = "color";

export type ColorVariant = {
  /** The option value's stable key, e.g. `gold` — never localized. */
  key: string;
  /** The value's own bilingual label from the product data. */
  label: LocalizedString;
  /** That colour's primary photograph (lowest `position` among its images). */
  image: ProductImage;
};

export function getColorVariants(product: {
  options: ProductOption[];
  images: ProductImage[];
}): ColorVariant[] {
  // The cart stores a single `{ optionKey, valueKey }` pair, and the detail
  // page offers `options[0]`; the colour dimension is matched by key so a
  // product whose first option is (say) a size never renders as swatches.
  const option =
    product.options.find((candidate) => candidate.key === COLOR_OPTION_KEY) ?? null;
  if (!option) return [];

  const variants: ColorVariant[] = [];
  for (const value of option.values) {
    const images = product.images
      .filter((image) => image.valueKey === value.key)
      .sort((a, b) => a.position - b.position);
    const image = images[0];
    if (!image) continue;
    variants.push({ key: value.key, label: value.label, image });
  }

  return variants.length >= 2 ? variants : [];
}
