/**
 * Dev/test-only sample data: the four core categories (bilingual names),
 * one homepage category showcase per category, and a handful of sample
 * bilingual products per category (data-model.md, spec FR-001a–FR-001f,
 * FR-074). Never runs as part of normal request handling (Constitution
 * Principle 7) — this script is the only place that writes it, and it is
 * idempotent (safe to re-run) via deterministic document IDs.
 *
 * Usage: npm run seed
 */
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { FieldValue } from "firebase-admin/firestore";
import {
  categoriesCollection,
  categoryShowcasesCollection,
  productsCollection,
  deliveryRegionsCollection,
  deliveryLocationsCollection,
} from "../src/lib/firebase/firestore";
import { deriveProductSlug } from "../src/lib/domain/catalog/product.service";
import { buildSearchTerms } from "../src/lib/utils/searchTokens";
import { getBaseUrl } from "../src/lib/config/site";
import type { LocalizedString } from "../src/types/localizedString";
import type { DeliveryRegionId } from "../src/types/deliveryRegion";

type SeedCategory = {
  id: string;
  name: LocalizedString;
  displayOrder: number;
};

const CATEGORIES: SeedCategory[] = [
  { id: "bracelets", name: { en: "Bracelets", ar: "أساور" }, displayOrder: 1 },
  { id: "rings", name: { en: "Rings", ar: "خواتم" }, displayOrder: 2 },
  { id: "earrings", name: { en: "Earrings", ar: "أقراط" }, displayOrder: 3 },
  { id: "watches", name: { en: "Watches", ar: "ساعات" }, displayOrder: 4 },
];

type SeedProduct = {
  categoryId: string;
  name: LocalizedString;
  description: LocalizedString;
  material: LocalizedString;
  price: number; // minor units
  stock: number;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
};

const PRODUCTS: SeedProduct[] = [
  {
    categoryId: "bracelets",
    name: { en: "Golden Bangle Bracelet", ar: "سوار ذهبي" },
    description: {
      en: "A timeless 18k gold-plated bangle, perfect for everyday elegance.",
      ar: "سوار مطلي بالذهب عيار 18 قيراط، أناقة يومية خالدة.",
    },
    material: { en: "18k Gold-Plated Brass", ar: "نحاس مطلي بالذهب عيار 18" },
    price: 15000,
    stock: 12,
    isBestSeller: true,
  },
  {
    categoryId: "bracelets",
    name: { en: "Pearl Tennis Bracelet", ar: null },
    description: {
      en: "Delicate freshwater pearls set in a classic tennis-bracelet chain.",
      ar: null,
    },
    material: { en: "Freshwater Pearl & Sterling Silver", ar: null },
    price: 9800,
    stock: 0,
    isNewArrival: true,
  },
  {
    categoryId: "rings",
    name: { en: "Solitaire Ring", ar: "خاتم سوليتير" },
    description: {
      en: "A refined solitaire-style ring with a brilliant-cut center stone.",
      ar: "خاتم سوليتير أنيق بحجر مركزي لامع.",
    },
    material: { en: "Sterling Silver & Cubic Zirconia", ar: "فضة إسترليني وزركونيا مكعبة" },
    price: 22000,
    stock: 6,
    isNewArrival: true,
  },
  {
    categoryId: "earrings",
    name: { en: "Pearl Drop Earrings", ar: "أقراط اللؤلؤ المتدلية" },
    description: {
      en: "Elegant drop earrings featuring a single lustrous pearl.",
      ar: "أقراط متدلية أنيقة بحبة لؤلؤ لامعة واحدة.",
    },
    material: { en: "Freshwater Pearl & Gold-Plated Brass", ar: "لؤلؤ ونحاس مطلي بالذهب" },
    price: 8500,
    stock: 20,
  },
  {
    categoryId: "watches",
    name: { en: "Classic Gold Watch", ar: "ساعة ذهبية كلاسيكية" },
    description: {
      en: "A minimalist gold-tone watch with a genuine leather strap.",
      ar: "ساعة بلون ذهبي بتصميم بسيط وحزام جلد طبيعي.",
    },
    material: { en: "Stainless Steel & Genuine Leather", ar: "ستانلس ستيل وجلد طبيعي" },
    price: 32000,
    stock: 8,
    isBestSeller: true,
  },
];

export async function seedCategories(): Promise<void> {
  for (const category of CATEGORIES) {
    const ref = categoriesCollection().doc(category.id);
    const existing = await ref.get();
    if (existing.exists) {
      console.log(`[categories] ${category.id} already exists, skipping`);
      continue;
    }

    await ref.set({
      id: category.id,
      name: category.name,
      slug: category.id,
      description: null,
      displayOrder: category.displayOrder,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[categories] seeded ${category.id}`);
  }
}

export async function seedShowcases(): Promise<void> {
  for (const category of CATEGORIES) {
    const showcaseId = `${category.id}-showcase`;
    const ref = categoryShowcasesCollection().doc(showcaseId);
    const existing = await ref.get();
    if (existing.exists) {
      console.log(`[showcases] ${showcaseId} already exists, skipping`);
      continue;
    }

    await ref.set({
      id: showcaseId,
      categoryId: category.id,
      desktopImage: {
        // A fully-qualified URL — `productImageSchema`/the showcase image
        // schema require a real URL (`z.string().url()`), so a bare
        // relative path here would fail validation the moment an admin
        // ever saves this form without first replacing this placeholder
        // image (a real bug this seed data was silently triggering —
        // T247/Phase 17).
        url: `${getBaseUrl()}/brand/logo.svg`,
        // A non-empty synthetic path — `productImageSchema`/the showcase
        // image schema require a non-empty `storagePath` (it's a real
        // Storage object reference in production), so an empty string
        // here would fail client-side validation the moment an admin
        // ever saves this showcase's form without first replacing this
        // placeholder image (a real bug this seed data was silently
        // triggering — T247/Phase 17).
        storagePath: `seed/showcases/${category.id}.svg`,
      },
      mobileImage: null,
      title: category.name,
      subtitle: null,
      cta: {
        en: `Shop ${category.name.en}`,
        ar: category.name.ar ? `تسوقي ${category.name.ar}` : null,
      },
      displayOrder: category.displayOrder,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[showcases] seeded ${showcaseId}`);
  }
}

export async function seedProducts(): Promise<void> {
  const categoryById = new Map(CATEGORIES.map((category) => [category.id, category]));

  for (const product of PRODUCTS) {
    const slug = deriveProductSlug(product.name.en);
    const existing = await productsCollection().where("slug", "==", slug).limit(1).get();
    if (!existing.empty) {
      console.log(`[products] ${slug} already exists, skipping`);
      continue;
    }

    const category = categoryById.get(product.categoryId);
    const ref = productsCollection().doc();

    await ref.set({
      id: ref.id,
      name: product.name,
      slug,
      description: product.description,
      price: product.price,
      categoryId: product.categoryId,
      images: [
        {
          // A fully-qualified URL — `productImageSchema`/the showcase image
        // schema require a real URL (`z.string().url()`), so a bare
        // relative path here would fail validation the moment an admin
        // ever saves this form without first replacing this placeholder
        // image (a real bug this seed data was silently triggering —
        // T247/Phase 17).
        url: `${getBaseUrl()}/brand/logo.svg`,
          // A non-empty synthetic path — see the matching note on
          // categoryShowcases' `desktopImage` above; a real bug this seed
          // data was silently triggering (T247/Phase 17): saving any
          // seeded product's edit form without first replacing this
          // placeholder image failed client-side validation.
          storagePath: `seed/products/${slug}.svg`,
          position: 0,
          alt: product.name.en,
        },
      ],
      material: product.material,
      options: [],
      stock: product.stock,
      availability: true,
      isNewArrival: product.isNewArrival ?? false,
      isBestSeller: product.isBestSeller ?? false,
      salesCount: 0,
      isOnSale: false,
      salePrice: null,
      saleStartAt: null,
      saleEndAt: null,
      searchTerms: buildSearchTerms(
        product.name.en,
        product.name.ar,
        category?.name.en,
        category?.name.ar,
      ),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[products] seeded ${slug}`);
  }
}

type SeedDeliveryLocation = { id: string; name: LocalizedString; displayOrder: number };

const DELIVERY_REGIONS: { id: DeliveryRegionId; name: LocalizedString; displayOrder: number }[] = [
  { id: "west-bank", name: { en: "West Bank", ar: "الضفة الغربية" }, displayOrder: 1 },
  { id: "inside-1948", name: { en: "Inside / 1948 Areas", ar: "الداخل / مناطق 48" }, displayOrder: 2 },
];

// Illustrative starting set only — explicitly dev/test-only, not the final
// shipping coverage (spec Assumptions); an admin manages the real list.
const DELIVERY_LOCATIONS: Record<DeliveryRegionId, SeedDeliveryLocation[]> = {
  "west-bank": [
    { id: "ramallah", name: { en: "Ramallah", ar: "رام الله" }, displayOrder: 1 },
    { id: "nablus", name: { en: "Nablus", ar: "نابلس" }, displayOrder: 2 },
    { id: "hebron", name: { en: "Hebron", ar: "الخليل" }, displayOrder: 3 },
    { id: "bethlehem", name: { en: "Bethlehem", ar: "بيت لحم" }, displayOrder: 4 },
  ],
  "inside-1948": [
    { id: "haifa", name: { en: "Haifa", ar: "حيفا" }, displayOrder: 1 },
    { id: "jaffa", name: { en: "Jaffa", ar: "يافا" }, displayOrder: 2 },
    { id: "nazareth", name: { en: "Nazareth", ar: "الناصرة" }, displayOrder: 3 },
  ],
};

export async function seedDeliveryLocations(): Promise<void> {
  for (const region of DELIVERY_REGIONS) {
    const ref = deliveryRegionsCollection().doc(region.id);
    const existing = await ref.get();
    if (!existing.exists) {
      await ref.set({
        id: region.id,
        regionId: region.id,
        name: region.name,
        displayOrder: region.displayOrder,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`[deliveryRegions] seeded ${region.id}`);
    } else {
      console.log(`[deliveryRegions] ${region.id} already exists, skipping`);
    }

    for (const location of DELIVERY_LOCATIONS[region.id]) {
      const locationId = `${region.id}-${location.id}`;
      const locationRef = deliveryLocationsCollection().doc(locationId);
      const existingLocation = await locationRef.get();
      if (existingLocation.exists) {
        console.log(`[deliveryLocations] ${locationId} already exists, skipping`);
        continue;
      }

      await locationRef.set({
        id: locationId,
        regionId: region.id,
        name: location.name,
        slug: location.id,
        searchTerms: buildSearchTerms(location.name.en, location.name.ar),
        displayOrder: location.displayOrder,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`[deliveryLocations] seeded ${locationId}`);
    }
  }
}

export async function seedAll(): Promise<void> {
  await seedCategories();
  await seedShowcases();
  await seedProducts();
  await seedDeliveryLocations();
  console.log("Seed complete.");
}

// CLI entry point only — guarded so `tests/integration/catalog-seed.test.ts`
// can import `seedAll`/`seedCategories`/etc. above without triggering the
// production guard or `process.exit()` as an import side effect.
const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  // Refuses to run against a real production project by accident — only
  // the Firebase Local Emulator Suite, or an explicit opt-in, may seed.
  if (!process.env.FIRESTORE_EMULATOR_HOST && process.env.ALLOW_SEED_PRODUCTION !== "true") {
    console.error(
      "Refusing to seed: FIRESTORE_EMULATOR_HOST is not set (this script is dev/test-only). " +
        "Start the Firebase Local Emulator Suite first, or set ALLOW_SEED_PRODUCTION=true if you " +
        "really intend to seed sample/placeholder data into a real project.",
    );
    process.exit(1);
  }

  seedAll()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("seed failed:", err);
      process.exit(1);
    });
}
