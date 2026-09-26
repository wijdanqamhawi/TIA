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
import type { LocalizedString } from "../src/types/localizedString";
import type { ProductOption } from "../src/types/product";
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
  /**
   * Overrides the slug normally derived from `name.en`.
   *
   * Only for a product that has been *renamed in place* in the live store:
   * the slug is the product's public URL and its `storagePath` prefix, so a
   * rename deliberately keeps the original slug rather than orphaning every
   * existing link to it. Pinning it here keeps a fresh seed identical to the
   * live document — and, just as importantly, keeps `seedProducts`
   * idempotent, since its "already exists" check looks the product up by
   * slug and would otherwise seed a second copy alongside the renamed one.
   */
  slug?: string;
  description: LocalizedString;
  material: LocalizedString;
  price: number; // minor units
  stock: number;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  /**
   * Selectable product options (e.g. Color). Omitted by every product that
   * has none, which keeps the stored value `[]` exactly as before.
   */
  options?: ProductOption[];
  /**
   * Explicit images, each optionally tied to an option value via `valueKey`
   * (per-variant photography). Defaults to the single brand placeholder, so
   * every existing seeded product keeps exactly the image it always had.
   */
  images?: { url: string; storagePath: string; alt?: string; valueKey?: string | null }[];
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
    // A real asset path, so `resolveProductImage` returns it as-is instead
    // of hashing the product id into the shared demo pool — a hash knows
    // nothing about what a product *is*, which is how a watch ended up on a
    // cuff and two products collided on the same necklace photo.
    images: [
      {
        url: "/images/demo/collection-bracelets.jpg",
        storagePath: "seed/products/golden-bangle-bracelet.jpg",
        alt: "Golden Bangle Bracelet worn on the wrist",
      },
    ],
  },
  {
    // Renamed in place from "Pearl Tennis Bracelet" and reassigned from
    // Bracelets to Rings, because the photograph this product resolves to
    // shows a set of rings — the product was changed to match its image
    // rather than the image swapped to match a name nothing else supported.
    //
    // The slug is pinned to the pre-rename value on purpose: it is the
    // product's public URL (`/shop/pearl-tennis-bracelet`) and the prefix of
    // its `storagePath`, and there is no redirect layer, so re-deriving it
    // from the new name would 404 every link that already points at it. See
    // `SeedProduct.slug`.
    categoryId: "rings",
    name: { en: "Pearl & Turquoise Ring Set", ar: "طقم خواتم لؤلؤ وفيروز" },
    slug: "pearl-tennis-bracelet",
    description: {
      en: "A set of slender rings pairing freshwater pearls with turquoise stones.",
      ar: "طقم من الخواتم الرفيعة يجمع بين اللؤلؤ الطبيعي وأحجار الفيروز.",
    },
    material: {
      en: "Freshwater Pearl, Turquoise & Sterling Silver",
      ar: "لؤلؤ طبيعي وفيروز وفضة إسترليني",
    },
    price: 9800,
    stock: 0,
    isNewArrival: true,
    // Pinned explicitly: on the brand placeholder, the demo layer picked
    // this photo by hashing the Firestore document id, so a fresh database
    // (new id) would have shown an unrelated frame. `product-02.jpg` is the
    // pearl-and-turquoise ring set the product was renamed to match.
    images: [
      {
        url: "/images/demo/product-02.jpg",
        storagePath: "seed/products/pearl-tennis-bracelet.jpg",
        alt: "Pearl & Turquoise Ring Set worn on the hand",
      },
    ],
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
    images: [
      {
        url: "/images/demo/collection-rings-editorial.jpg",
        storagePath: "seed/products/solitaire-ring.jpg",
        alt: "Solitaire Ring with a brilliant-cut centre stone",
      },
    ],
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
    images: [
      {
        url: "/images/demo/editorial-earring-model.jpg",
        storagePath: "seed/products/pearl-drop-earrings.jpg",
        alt: "Pearl Drop Earrings worn on the ear",
      },
    ],
  },
  // ── DEMO: the only seeded product with selectable options ──────────────
  // Exists to exercise the Product Details colour swatches and the
  // thumbnail gallery end-to-end. Its three colours are REAL product
  // options — the same `{ key, name, values }` shape the admin product form
  // writes and the same one `addCartItemAction` re-validates — so choosing
  // one genuinely changes the `{ optionKey, valueKey }` pair stored on the
  // cart line. No new variant architecture is introduced for it.
  {
    categoryId: "bracelets",
    name: { en: "Aurelia Signature Cuff", ar: "سوار أوريليا المميز" },
    description: {
      en: "A sculpted open cuff with a softly brushed finish, offered in three metal tones.",
      ar: "سوار مفتوح منحوت بلمسة نهائية ناعمة، متوفر بثلاث درجات معدنية.",
    },
    material: { en: "Brushed Plated Brass", ar: "نحاس مطلي بلمسة مصقولة" },
    price: 18500,
    stock: 15,
    isNewArrival: true,
    options: [
      {
        key: "color",
        name: { en: "Color", ar: "اللون" },
        values: [
          { key: "gold", label: { en: "Gold", ar: "ذهبي" } },
          { key: "silver", label: { en: "Silver", ar: "فضي" } },
          { key: "rose-gold", label: { en: "Rose Gold", ar: "ذهبي وردي" } },
        ],
      },
    ],
    // Each colour's PRIMARY image (position 0 within its colour) is the
    // panel extracted from the supplied three-up reference — the gold,
    // silver and rose-gold cuff photographed separately. The `-2` entry is
    // an existing secondary demo frame, kept only so thumbnail switching
    // stays exercised within a colour; replace it whenever a real second
    // shot of that finish exists.
    //
    // Only files that actually exist are listed here. Declaring an image
    // whose file is absent renders a broken frame in the gallery, so any
    // further angles get added at the same time as their assets.
    images: [
      {
        url: "/images/demo/aurelia-gold-1.jpg",
        storagePath: "seed/products/aurelia-gold-1.jpg",
        alt: "Aurelia Signature Cuff in gold, worn on the wrist",
        valueKey: "gold",
      },
      {
        url: "/images/demo/aurelia-gold-2.jpg",
        storagePath: "seed/products/aurelia-gold-2.jpg",
        alt: "Aurelia Signature Cuff in gold, close-up detail",
        valueKey: "gold",
      },
      {
        url: "/images/demo/aurelia-silver-1.jpg",
        storagePath: "seed/products/aurelia-silver-1.jpg",
        alt: "Aurelia Signature Cuff in silver, worn on the wrist",
        valueKey: "silver",
      },
      {
        url: "/images/demo/aurelia-silver-2.jpg",
        storagePath: "seed/products/aurelia-silver-2.jpg",
        alt: "Aurelia Signature Cuff in silver, close-up detail",
        valueKey: "silver",
      },
      {
        url: "/images/demo/aurelia-rose-gold-1.jpg",
        storagePath: "seed/products/aurelia-rose-gold-1.jpg",
        alt: "Aurelia Signature Cuff in rose gold, worn on the wrist",
        valueKey: "rose-gold",
      },
      {
        url: "/images/demo/aurelia-rose-gold-2.jpg",
        storagePath: "seed/products/aurelia-rose-gold-2.jpg",
        alt: "Aurelia Signature Cuff in rose gold, close-up detail",
        valueKey: "rose-gold",
      },
    ],
  },
  {
    // Renamed from "Classic Gold Watch": the piece is offered in three
    // finishes, so a name fixed to one of them contradicted its own swatches.
    //
    // The slug is pinned to the pre-rename value for the same reason as the
    // ring set above — it is the public URL and the `storagePath` prefix,
    // and re-deriving it from the new name would 404 existing links and
    // break `seedProducts`' own by-slug idempotency check. See
    // `SeedProduct.slug`.
    //
    // Three photographed colour values, read by the shared variant
    // architecture (`getColorVariants`, `ProductImage.valueKey`) that
    // Aurelia already uses — there is nothing watch-specific here. Two
    // frames per finish: `-1` worn on the wrist (what the card shows),
    // `-2` a styled detail shot, so the detail gallery's thumbnail rail
    // switches within a colour as well as between colours.
    categoryId: "watches",
    name: { en: "Classic Watch", ar: "ساعة كلاسيكية" },
    slug: "classic-gold-watch",
    description: {
      en: "A minimalist rectangular watch on a linked bracelet, offered in three finishes.",
      ar: "ساعة مستطيلة بتصميم بسيط وسوار معدني، متوفرة بثلاث درجات معدنية.",
    },
    material: { en: "Stainless Steel", ar: "ستانلس ستيل" },
    price: 32000,
    stock: 8,
    isBestSeller: true,
    options: [
      {
        key: "color",
        name: { en: "Color", ar: "اللون" },
        values: [
          { key: "gold", label: { en: "Gold", ar: "ذهبي" } },
          { key: "silver", label: { en: "Silver", ar: "فضي" } },
          { key: "rose-gold", label: { en: "Rose Gold", ar: "ذهبي وردي" } },
        ],
      },
    ],
    images: [
      {
        url: "/images/demo/watch-gold-1.jpg",
        storagePath: "seed/products/watch-gold-1.jpg",
        alt: "Classic Watch in gold, worn on the wrist",
        valueKey: "gold",
      },
      {
        url: "/images/demo/watch-gold-2.jpg",
        storagePath: "seed/products/watch-gold-2.jpg",
        alt: "Classic Watch in gold, styled detail",
        valueKey: "gold",
      },
      {
        url: "/images/demo/watch-silver-1.jpg",
        storagePath: "seed/products/watch-silver-1.jpg",
        alt: "Classic Watch in silver, worn on the wrist",
        valueKey: "silver",
      },
      {
        url: "/images/demo/watch-silver-2.jpg",
        storagePath: "seed/products/watch-silver-2.jpg",
        alt: "Classic Watch in silver, styled detail",
        valueKey: "silver",
      },
      {
        url: "/images/demo/watch-rose-gold-1.jpg",
        storagePath: "seed/products/watch-rose-gold-1.jpg",
        alt: "Classic Watch in rose gold, worn on the wrist",
        valueKey: "rose-gold",
      },
      {
        url: "/images/demo/watch-rose-gold-2.jpg",
        storagePath: "seed/products/watch-rose-gold-2.jpg",
        alt: "Classic Watch in rose gold, styled detail",
        valueKey: "rose-gold",
      },
    ],
  },

  // ── Shop expansion: 16 additive products (6 → 22) ──────────────────────
  // Existing categories only — there is deliberately no Necklaces category.
  // Every product has its own photograph under `public/images/products/`,
  // named after its slug, so no two products share a frame and none falls
  // through to the hashed demo pool. Six of those files are byte-identical
  // copies of previously unused `public/images/demo/product-0N.jpg` shots;
  // the demo pool itself is left untouched. All sixteen are in stock.

  // Bracelets
  {
    categoryId: "bracelets",
    name: { en: "Étoile Charm Bracelet", ar: "سوار إيتوال بالتعليقات" },
    description: {
      en: "A fine gold chain hung with star, clover and pearl charms — a little constellation for the wrist.",
      ar: "سلسلة ذهبية رقيقة تتدلى منها تعليقات على شكل نجمة وبرسيم ولؤلؤة، كأنها كوكبة صغيرة على المعصم.",
    },
    material: {
      en: "18k Gold-Plated Brass, Enamel, Crystal & Pearl",
      ar: "نحاس مطلي بالذهب عيار 18 ومينا وكريستال ولؤلؤ",
    },
    price: 11800,
    stock: 18,
    isNewArrival: true,
    images: [
      {
        url: "/images/products/etoile-charm-bracelet.jpg",
        storagePath: "seed/products/etoile-charm-bracelet.jpg",
        alt: "Étoile Charm Bracelet with star, clover and pearl charms",
      },
    ],
  },
  {
    categoryId: "bracelets",
    name: { en: "Serene Tennis Bracelet", ar: "سوار سيرين تنس" },
    description: {
      en: "A continuous line of brilliant-cut stones set in warm gold, made to be worn every day.",
      ar: "صف متصل من الأحجار اللامعة مرصعة بالذهب الدافئ، مصمم ليُرتدى كل يوم.",
    },
    material: {
      en: "Gold-Plated Sterling Silver & Cubic Zirconia",
      ar: "فضة إسترليني مطلية بالذهب وزركونيا مكعبة",
    },
    price: 21000,
    stock: 7,
    images: [
      {
        url: "/images/products/serene-tennis-bracelet.jpg",
        storagePath: "seed/products/serene-tennis-bracelet.jpg",
        alt: "Serene Tennis Bracelet with a continuous line of stones",
      },
    ],
  },
  {
    categoryId: "bracelets",
    name: { en: "Lumière Dome Cuff", ar: "سوار لوميير العريض" },
    description: {
      en: "A bold, high-polish domed cuff that catches the light from every angle.",
      ar: "سوار عريض مقبب بلمعة عالية يعكس الضوء من كل زاوية.",
    },
    material: { en: "18k Gold-Plated Brass", ar: "نحاس مطلي بالذهب عيار 18" },
    price: 17500,
    stock: 12,
    isBestSeller: true,
    images: [
      {
        url: "/images/products/lumiere-dome-cuff.jpg",
        storagePath: "seed/products/lumiere-dome-cuff.jpg",
        alt: "Lumière Dome Cuff worn on the wrist",
      },
    ],
  },
  {
    categoryId: "bracelets",
    name: { en: "Amour Knot Bangle", ar: "سوار أمور بعقدة" },
    description: {
      en: "A slender gold bangle tied in a single love knot — understated and easy to stack.",
      ar: "سوار ذهبي نحيف معقود بعقدة حب واحدة، بسيط وسهل التنسيق مع غيره.",
    },
    material: { en: "18k Gold-Plated Brass", ar: "نحاس مطلي بالذهب عيار 18" },
    price: 10500,
    stock: 20,
    images: [
      {
        url: "/images/products/amour-knot-bangle.jpg",
        storagePath: "seed/products/amour-knot-bangle.jpg",
        alt: "Amour Knot Bangle worn on the wrist",
      },
    ],
  },
  {
    categoryId: "bracelets",
    name: { en: "Amara Beaded Bracelet", ar: "سوار أمارا بالخرز" },
    description: {
      en: "Polished gold beads alternating with pearls, finished with a small engraved medallion.",
      ar: "خرزات ذهبية مصقولة تتناوب مع اللؤلؤ، تنتهي بميدالية صغيرة محفورة.",
    },
    material: {
      en: "18k Gold-Plated Brass & Freshwater Pearl",
      ar: "نحاس مطلي بالذهب عيار 18 ولؤلؤ طبيعي",
    },
    price: 9200,
    stock: 16,
    isNewArrival: true,
    images: [
      {
        url: "/images/products/amara-beaded-bracelet.jpg",
        storagePath: "seed/products/amara-beaded-bracelet.jpg",
        alt: "Amara Beaded Bracelet with gold beads, pearls and a medallion",
      },
    ],
  },

  // Rings
  {
    categoryId: "rings",
    name: { en: "Éclat Halo Ring", ar: "خاتم إيكلا بالكريستال" },
    description: {
      en: "A delicate rose-gold band crowned with a centre stone in a sparkling halo.",
      ar: "خاتم رقيق بلون الذهب الوردي يعلوه حجر مركزي تحيط به هالة لامعة.",
    },
    material: {
      en: "Rose Gold-Plated Sterling Silver & Cubic Zirconia",
      ar: "فضة إسترليني مطلية بالذهب الوردي وزركونيا مكعبة",
    },
    price: 19500,
    stock: 8,
    isBestSeller: true,
    images: [
      {
        url: "/images/products/eclat-halo-ring.jpg",
        storagePath: "seed/products/eclat-halo-ring.jpg",
        alt: "Éclat Halo Ring worn on the hand",
      },
    ],
  },
  {
    categoryId: "rings",
    name: { en: "Celeste Signet Ring", ar: "خاتم سيليست المنقوش" },
    description: {
      en: "A classic engraved signet with a softly worn, heirloom character.",
      ar: "خاتم ختم كلاسيكي منقوش بطابع عتيق يوحي بالقطع الموروثة.",
    },
    material: { en: "Gold-Plated Sterling Silver", ar: "فضة إسترليني مطلية بالذهب" },
    price: 13500,
    stock: 13,
    images: [
      {
        url: "/images/products/celeste-signet-ring.jpg",
        storagePath: "seed/products/celeste-signet-ring.jpg",
        alt: "Celeste Signet Ring worn on the hand",
      },
    ],
  },
  {
    categoryId: "rings",
    name: { en: "Amour Band Ring", ar: "خاتم أمور الحلقي" },
    description: {
      en: "A slim gold band set with a row of bright stones — lovely alone or stacked.",
      ar: "خاتم ذهبي نحيف مرصع بصف من الأحجار اللامعة، جميل وحده أو مع خواتم أخرى.",
    },
    material: {
      en: "Gold-Plated Sterling Silver & Cubic Zirconia",
      ar: "فضة إسترليني مطلية بالذهب وزركونيا مكعبة",
    },
    price: 8800,
    stock: 24,
    images: [
      {
        url: "/images/products/amour-band-ring.jpg",
        storagePath: "seed/products/amour-band-ring.jpg",
        alt: "Amour Band Ring set with a row of stones",
      },
    ],
  },
  {
    categoryId: "rings",
    name: { en: "Double Pearl Ring", ar: "خاتم اللؤلؤ المزدوج" },
    description: {
      en: "An open gold wrap ring finished with a lustrous pearl at each end.",
      ar: "خاتم ذهبي مفتوح ملتف تزين طرفيه حبتا لؤلؤ لامعتان.",
    },
    material: {
      en: "18k Gold-Plated Brass & Freshwater Pearl",
      ar: "نحاس مطلي بالذهب عيار 18 ولؤلؤ طبيعي",
    },
    price: 11500,
    stock: 10,
    images: [
      {
        url: "/images/products/double-pearl-ring.jpg",
        storagePath: "seed/products/double-pearl-ring.jpg",
        alt: "Double Pearl Ring with a pearl at each end",
      },
    ],
  },
  {
    categoryId: "rings",
    name: { en: "Celeste Statement Ring", ar: "خاتم سيليست البارز" },
    description: {
      en: "A radiant cut-crystal centre framed in pavé, on a split gold shank.",
      ar: "حجر كريستال مشع في المنتصف تحيط به أحجار صغيرة مرصوصة، على حلقة ذهبية مزدوجة.",
    },
    material: {
      en: "Gold-Plated Sterling Silver & Cubic Zirconia",
      ar: "فضة إسترليني مطلية بالذهب وزركونيا مكعبة",
    },
    price: 16800,
    stock: 9,
    isNewArrival: true,
    images: [
      {
        url: "/images/products/celeste-statement-ring.jpg",
        storagePath: "seed/products/celeste-statement-ring.jpg",
        alt: "Celeste Statement Ring with a large cut-crystal centre",
      },
    ],
  },

  // Earrings
  {
    categoryId: "earrings",
    name: { en: "Luna Drop Earrings", ar: "أقراط لونا المتدلية" },
    description: {
      en: "A soft green teardrop suspended from a vintage-inspired silver setting.",
      ar: "حجر أخضر ناعم على شكل دمعة يتدلى من قاعدة فضية مستوحاة من الطراز العتيق.",
    },
    material: {
      en: "Sterling Silver & Green Crystal",
      ar: "فضة إسترليني وكريستال أخضر",
    },
    price: 9800,
    stock: 15,
    isBestSeller: true,
    images: [
      {
        url: "/images/products/luna-drop-earrings.jpg",
        storagePath: "seed/products/luna-drop-earrings.jpg",
        alt: "Luna Drop Earrings worn on the ear",
      },
    ],
  },
  {
    categoryId: "earrings",
    name: { en: "Étoile Chandelier Earrings", ar: "أقراط إيتوال الثريا" },
    description: {
      en: "Ornate gold bell-shaped chandeliers with finely worked detail and gentle movement.",
      ar: "أقراط ذهبية مزخرفة على شكل جرس بتفاصيل دقيقة وحركة ناعمة.",
    },
    material: { en: "18k Gold-Plated Brass", ar: "نحاس مطلي بالذهب عيار 18" },
    price: 12500,
    stock: 9,
    images: [
      {
        url: "/images/products/etoile-chandelier-earrings.jpg",
        storagePath: "seed/products/etoile-chandelier-earrings.jpg",
        alt: "Étoile Chandelier Earrings worn on the ear",
      },
    ],
  },
  {
    categoryId: "earrings",
    name: { en: "Celeste Hoop Earrings", ar: "أقراط سيليست الحلقية" },
    description: {
      en: "Chunky, high-shine gold hoops with a softly rounded profile.",
      ar: "أقراط حلقية ذهبية عريضة بلمعة عالية وانحناءة ناعمة.",
    },
    material: { en: "18k Gold-Plated Brass", ar: "نحاس مطلي بالذهب عيار 18" },
    price: 7800,
    stock: 22,
    isNewArrival: true,
    images: [
      {
        url: "/images/products/celeste-hoop-earrings.jpg",
        storagePath: "seed/products/celeste-hoop-earrings.jpg",
        alt: "Celeste Hoop Earrings in polished gold",
      },
    ],
  },
  {
    categoryId: "earrings",
    name: { en: "Pearl Bloom Earrings", ar: "أقراط زهرة اللؤلؤ" },
    description: {
      en: "A flower of pearls around a crystal centre, with a pearl teardrop falling below.",
      ar: "زهرة من اللؤلؤ حول قلب من الكريستال، تتدلى منها لؤلؤة على شكل دمعة.",
    },
    material: {
      en: "Gold-Plated Brass, Pearl & Crystal",
      ar: "نحاس مطلي بالذهب ولؤلؤ وكريستال",
    },
    price: 9200,
    stock: 17,
    images: [
      {
        url: "/images/products/pearl-bloom-earrings.jpg",
        storagePath: "seed/products/pearl-bloom-earrings.jpg",
        alt: "Pearl Bloom Earrings with a pearl flower and teardrop",
      },
    ],
  },

  // Watches
  {
    categoryId: "watches",
    name: { en: "Élan Classic Watch", ar: "ساعة إيلان الكلاسيكية" },
    description: {
      en: "A rectangular ivory dial on a polished gold link bracelet — refined, everyday elegance.",
      ar: "ميناء عاجي مستطيل على سوار ذهبي مصقول بحلقات، أناقة راقية لكل يوم.",
    },
    material: {
      en: "Gold-Tone Stainless Steel",
      ar: "ستانلس ستيل بلون ذهبي",
    },
    price: 26500,
    stock: 6,
    images: [
      {
        url: "/images/products/elan-classic-watch.jpg",
        storagePath: "seed/products/elan-classic-watch.jpg",
        alt: "Élan Classic Watch with a rectangular ivory dial and gold link bracelet",
      },
    ],
  },
  {
    categoryId: "watches",
    name: { en: "Luna Mesh Watch", ar: "ساعة لونا بسوار شبكي" },
    description: {
      en: "A round ivory dial on a fine gold mesh strap that sits lightly on the wrist.",
      ar: "ميناء عاجي دائري على سوار ذهبي شبكي ناعم يستقر بخفة على المعصم.",
    },
    material: {
      en: "Gold-Tone Stainless Steel",
      ar: "ستانلس ستيل بلون ذهبي",
    },
    price: 24000,
    stock: 8,
    isNewArrival: true,
    images: [
      {
        url: "/images/products/luna-mesh-watch.jpg",
        storagePath: "seed/products/luna-mesh-watch.jpg",
        alt: "Luna Mesh Watch with a round ivory dial and gold mesh strap",
      },
    ],
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
        // Root-relative, which the showcase image schema accepts (it used to
        // require an absolute URL, which forced this placeholder to embed
        // the seeding machine's host — T247/Phase 17). Still recognised as
        // the placeholder by `demoImages.ts`, so the storefront is unchanged.
        url: "/brand/logo.svg",
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
    const slug = product.slug ?? deriveProductSlug(product.name.en);
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
      // One brand placeholder by default — every product without explicit
      // images keeps exactly the single image it always had. A product that
      // declares `images` (the colour-variant demo) gets those instead,
      // each optionally tagged with the option value it belongs to.
      images: (
        product.images ?? [
          {
            // Root-relative, which `productImageSchema` accepts, so no
            // environment's host (e.g. localhost) is baked into stored data.
            // Still recognised as the placeholder by `demoImages.ts`.
            url: "/brand/logo.svg",
            // A non-empty synthetic path — see the matching note on
            // categoryShowcases' `desktopImage` above.
            storagePath: `seed/products/${slug}.svg`,
          },
        ]
      ).map((image, index) => ({
        url: image.url,
        storagePath: image.storagePath,
        position: index,
        alt: image.alt ?? product.name.en,
        valueKey: image.valueKey ?? null,
      })),
      material: product.material,
      options: product.options ?? [],
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
