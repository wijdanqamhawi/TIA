# Phase 1 Data Model: Core Commerce Experience

**Revision note (2026-08-26)**: Updated to Cloud Firestore (replacing MongoDB/Mongoose). Entities,
fields, and business behavior are unchanged from the original model; only the storage
representation (Firestore collections/documents instead of Mongoose schemas/collections) and the
mechanisms that were MongoDB-specific (indexes, transactions, TTL) have been adapted, per
research.md.

All entities are plain TypeScript interfaces (Principle 12: strong typing throughout), each with a
matching Zod schema in `lib/validation/` used to validate data before every Firestore write, and a
thin converter (`FirestoreDataConverter<T>`) per collection so reads/writes are always
strongly typed rather than passing raw `DocumentData` around. Every document has `createdAt` /
`updatedAt` fields (Firestore `Timestamp`, set via `FieldValue.serverTimestamp()` on write) so
timestamps are always assigned by the server, never trusted from a client payload.

All collections are accessed exclusively through the Firebase Admin SDK, server-side only
(research.md §2); Firestore Security Rules default-deny direct client access to every collection
below (research.md §22).

## `users/{uid}`

Represents a registered customer or an administrator. Guests are never persisted here. Document ID
is the Firebase Authentication `uid` (no separate application-generated user id).

| Field | Type | Notes |
|---|---|---|
| `uid` | string | mirrors the document ID; Firebase Auth UID |
| `name` | string | required, 1–120 chars |
| `email` | string | required; mirrors the Firebase Auth account's email (kept in sync on write, never independently editable to diverge) |
| `phone` | string \| null | optional at registration, required before an authenticated checkout can be completed under the customer's own profile |
| `role` | `"CUSTOMER" \| "ADMIN"` | required, default `"CUSTOMER"`; **mirrors the Firebase Auth custom claim** (research.md §9) — the custom claim is authoritative for authorization decisions, this field exists for admin-panel querying/listing only |
| `profile.address` | object \| null | `{ regionId, locationId, addressLine, notes? }` — optional saved default, editable; `regionId`/`locationId` reference `deliveryRegions`/`deliveryLocations` (below) and double as the customer's **preferred delivery location** (spec FR-090) — no separate `preferredLocationId` field is needed since this is the same concept |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

**Validation rules**: email format and password strength are enforced by Firebase Authentication
itself at account creation (research.md §8) plus the registration Zod schema for defense-in-depth
on the fields we do control (name, phone). No password or password hash is ever stored in this
document — Firebase Authentication owns credential storage entirely.

**Relationships**: referenced by `carts/{uid}`, `wishlists/{uid}`, and `orders.userId` (optional).

## Shared type: `LocalizedString`

*(New — spec FR-066–FR-085, bilingual support.)* Every customer-facing text field that needs both
an Arabic and an English version uses this shape, never a plain string:

```
LocalizedString = { en: string; ar: string | null }
```

`en` is always required (English is the fallback language, spec FR-084); `ar` is nullable so a
product/category can exist before its Arabic content has been entered, without blocking creation
(spec FR-074, and the Edge Cases "no Arabic content yet" behavior: render falls back to `en` when
`ar` is `null` or empty). This is a plain data shape, not a new top-level collection — it appears
inline wherever noted below.

## `products/{productId}`

| Field | Type | Notes |
|---|---|---|
| `productId` | string | Firestore auto-ID |
| `name` | `LocalizedString` | required (`en` required, `ar` optional/nullable, falls back to `en`) |
| `slug` | string | required; URL-safe, derived from `name.en` at creation (admin may override) — **language-independent**, the same slug/URL serves both locales (spec FR-076). Uniqueness is enforced in the create/rename **transaction** (read-check-then-write for an existing doc with the same `slug`), since Firestore has no native unique-constraint feature the way a Mongo unique index provided |
| `description` | `LocalizedString` | required |
| `price` | number | required, > 0; stored as an integer in minor units (e.g., cents) to avoid floating-point drift — **language-independent**, never affected by locale (spec FR-077) |
| `categoryId` | string (Category doc ID) | required reference to `categories/{categoryId}`; MUST reference an existing category document (spec FR-007d) — validated server-side against Firestore inside the create/update transaction, not merely trusted from the admin form (Constitution Principle 13) |
| `images` | array of `{ url, storagePath, position, alt }` | at least one required for the product to be marked available; `storagePath` is the Firebase Storage object path used for reorder/delete, `alt` is required per image for accessibility (Constitution Principle 16) (research.md §11); `alt` MAY itself be a `LocalizedString` in a future refinement, but is not required to be for launch — noted, not a blocking gap |
| `material` | `LocalizedString` | required |
| `options` | array of `{ key, name: LocalizedString, values: [{ key, label: LocalizedString }] }` | e.g., `{ key: "color", name: { en: "Color", ar: "اللون" }, values: [{ key: "gold", label: { en: "Gold", ar: "ذهبي" } }, { key: "rose-gold", label: { en: "Rose Gold", ar: "ذهبي وردي" } }] }`; optional (may be empty array). `key`/`values[].key` are stable, language-independent slugs — a `CartItem`/`OrderItem` references an option by these keys (never by localized label text), so switching language never changes what's selected (spec FR-072's "switching language must not change the underlying relationship" principle, applied here too) |
| `stock` | number | required, integer ≥ 0; admin-managed inventory count (spec FR-036a). Zero is a valid, expected value (a Sold Out product), never a negative one — see "Sold Out derivation" below |
| `availability` | boolean | required; the administrator's explicit storefront **visibility** control (shown vs. hidden from the catalog entirely, spec FR-038) — deliberately **independent of `stock`**. A product is never automatically hidden just because `stock` reaches 0; only an explicit admin action changes `availability` |
| `isNewArrival` | boolean | default `false` |
| `isBestSeller` | boolean | default `false` |
| `salesCount` | number | default `0`; cumulative quantity sold across non-cancelled orders, incremented on order creation and decremented on order cancellation — the authoritative source for "best-selling" ranking |
| `searchTerms` | array of string | lowercase keyword tokens derived from **both** `name.en` and `name.ar` (and the category's localized name) at write time, queried via `array-contains-any` for the shop search box — so search works regardless of which language the shopper is typing in (research.md §17 — Firestore has no native full-text search) |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

**Composite indexes** (`firestore.indexes.json`, deployed via Firebase CLI), covering every
filter+sort combination the shop page, category browsing, and curated collections need
(research.md §17):

| Index | Used by |
|---|---|
| `availability ASC, createdAt DESC` | Shop page, sort = newest, no category filter |
| `availability ASC, price ASC` | Shop page, sort = price, no category filter |
| `availability ASC, salesCount DESC` | Shop page, sort = popularity, no category filter |
| `categoryId ASC, availability ASC, createdAt DESC` | Shop page filtered by category, and each category's own dedicated page (FR-007a), sort = newest |
| `categoryId ASC, availability ASC, price ASC` | Shop page filtered by category, and each category's own dedicated page, sort = price |
| `categoryId ASC, availability ASC, salesCount DESC` | Shop page filtered by category, and each category's own dedicated page, sort = popularity |
| `isNewArrival ASC, availability ASC, createdAt DESC` | New Arrivals collection section |
| `isBestSeller ASC, availability ASC, salesCount DESC` | Best Sellers collection section |

Every catalog query above filters only on `availability` (admin visibility) — **never** on
`stock` — because a Sold Out product must still be browsable (spec FR-015a): it is included in
every listing/collection query exactly like an in-stock product, and is distinguished purely by
the derived Sold Out state described next.

**Sold Out derivation (spec FR-015a — no stored "isSoldOut" field, by design)**: "Sold Out" is
never written to Firestore as its own field; it is computed wherever a product is rendered or
validated, as `isSoldOut = stock === 0`. This is deliberate: storing a separate boolean alongside
`stock` would create a second value that could drift out of sync with the real stock number (e.g.,
an admin's stock edit succeeding while a paired "isSoldOut" write fails or is forgotten) — exactly
the kind of inconsistency Constitution Principle 10 (Inventory Integrity) rules out. Deriving it
at read time from `stock` instead makes the two values structurally impossible to disagree. The
catalog UI, product detail page, cart validation, and checkout's authoritative re-check
(research.md §3) all compute this the same way, from the same field.

`slug` is a single-field index, automatic (Firestore auto-indexes single fields).

**Validation rules**: `price > 0`, `stock >= 0` enforced by the Zod schema before every write
(rejects negative price/stock per spec edge cases).

**Relationships**: references `categories/{categoryId}` via `categoryId`; snapshotted (not
referenced) inside each order's `items[]` entry at purchase time — product edits/deletion never
retroactively change a past order line.

## `categories/{categoryId}`

Product taxonomy. Initial categories: **Bracelets, Rings, Earrings, Watches** — extensible; new
categories can be added later purely as new documents (spec FR-046a), with no code change required
to the catalog browsing/filtering logic since every query already parameterizes on `categoryId`.

| Field | Type | Notes |
|---|---|---|
| `categoryId` | string | Firestore auto-ID |
| `name` | `LocalizedString` | required, `name.en` unique (enforced at the application layer, same pattern as `Product.slug`) — e.g., `{ en: "Bracelets", ar: "أساور" }` |
| `slug` | string | required, unique (application-layer enforced) — e.g., "bracelets"; derived from `name.en`; **language-independent**, the same slug/URL serves both locales — used to build the category's dedicated route (`/shop/category/{slug}`, research.md §category-routes) |
| `description` | `LocalizedString` \| null | optional; shown on the category's own page header |
| `displayOrder` | number | required, integer; governs the order categories render in on the homepage Featured Categories section, the storefront category navigation, and the Shop page's category switcher (spec FR-046a) |
| `isActive` | boolean | required, default `true`; only active categories are offered in the admin product category selector (spec FR-036c) and shown in customer-facing navigation. Deactivating a category does not change the `categoryId` any existing product still references — those products keep their assignment |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

**Composite index**: `isActive ASC, displayOrder ASC` — used to render the ordered, active-only
category list on the homepage, navigation, and Shop-page switcher without a client-side sort.

**Validation rules**: `name.en` and `slug` uniqueness enforced the same way as `Product.slug`
(read-check-then-write inside the creating/renaming transaction, data-model.md "Uniqueness without
unique indexes" below); `displayOrder` MUST be a non-negative integer. Switching the storefront's
active language never changes `categoryId`, `slug`, or any product-category relationship (spec
FR-072/FR-076) — only which half of `name`/`description` is displayed.

## `categoryShowcases/{showcaseId}`

*(New — spec FR-001a–FR-001f, homepage category showcase requirement.)* One document per core
category's large, full-width homepage merchandising section. Distinct from `categories` (taxonomy)
and `collections` (New Arrivals/Best Sellers/Special Offers curation) — this collection exists
purely to make the showcase's imagery/copy admin-editable without a code change (spec FR-001d).

| Field | Type | Notes |
|---|---|---|
| `showcaseId` | string | Firestore auto-ID |
| `categoryId` | string (Category doc ID) | required reference to `categories/{categoryId}` — the showcase's CTA always navigates to this category's dedicated page; validated server-side the same way `Product.categoryId` is (data-model.md, `products`) |
| `desktopImage` | `{ url, storagePath }` | required; large editorial/cinematic image for laptop/desktop widths |
| `mobileImage` | `{ url, storagePath }` \| null | optional; a distinct mobile-composed crop (spec FR-001f — "not merely a shrunk desktop banner"). When `null`, the storefront falls back to a responsively-served crop of `desktopImage` via `next/image` rather than requiring every showcase to have two uploaded assets on day one |
| `title` | `LocalizedString` | required — the category name as shown on the showcase (kept independently editable from `Category.name` in case the showcase wants different phrasing, though it normally mirrors it) |
| `subtitle` | `LocalizedString` \| null | optional short tagline |
| `cta` | `LocalizedString` | required — e.g., `{ en: "Shop Bracelets", ar: "تسوقي الأساور" }` |
| `displayOrder` | number | required, non-negative integer; governs Hero → Bracelets → Rings → Earrings → Watches → … ordering on the homepage (spec FR-001) |
| `isActive` | boolean | required, default `true`; an inactive showcase is skipped entirely (spec Edge Cases — graceful degradation when content isn't ready yet) |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

**Composite index**: `isActive ASC, displayOrder ASC` — same pattern as `categories`, renders the
homepage's showcase sequence without a client-side sort.

**Validation rules**: `categoryId` must reference an existing category (same transactional check
as products); `desktopImage` required; `title`/`cta` required with at least `en` populated.

**Relationships**: references `categories/{categoryId}`; the accompanying "Featured {Category}"
product strip is not stored on this document — it is a live query
(`products` where `categoryId == this.categoryId AND availability == true`, ordered by
`createdAt DESC` or `salesCount DESC`, limited to a small N) run at render time, so it can never
go stale relative to the real catalog and can never leak another category's products (spec
FR-001b).

## `deliveryRegions/{regionId}`

*(New — spec FR-086–FR-098, delivery location selection.)* Exactly two documents, business-rule
fixed (never a general/worldwide region list): **`west-bank`** and **`inside-1948`** — these are
**deterministic, human-readable document IDs** (not Firestore auto-IDs), chosen once at seed time,
so region identity is stable, predictable, and never confused with an arbitrary auto-generated
string.

| Field | Type | Notes |
|---|---|---|
| `regionId` | string | `"west-bank"` \| `"inside-1948"` — the document ID itself; language-independent |
| `name` | `LocalizedString` | required — `{ en: "West Bank", ar: "الضفة الغربية" }` or `{ en: "Inside / 1948 Areas", ar: "الداخل" }` |
| `displayOrder` | number | required, non-negative integer; governs selector ordering |
| `isActive` | boolean | required, default `true`; an admin may relabel or temporarily hide a region, but MUST NOT add a third region through this mechanism — the two-region business rule (spec FR-086) is enforced by only ever seeding/allowing these two document IDs, not by application-level validation of an open-ended list |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

**Composite index**: `isActive ASC, displayOrder ASC`.

## `deliveryLocations/{locationId}`

*(New — spec FR-086–FR-098.)* A supported city/area within one `deliveryRegions` document. The
actual supported set is entirely store-owner-configured (spec FR-089) — this collection starts
empty or with illustrative seed data only, never a hardcoded "final" list.

| Field | Type | Notes |
|---|---|---|
| `locationId` | string | Firestore auto-ID |
| `regionId` | string (`deliveryRegions` doc ID) | required reference to `"west-bank"` or `"inside-1948"`; validated server-side against the fixed two-value set, the same pattern as `Product.categoryId` |
| `name` | `LocalizedString` | required — e.g., `{ en: "Ramallah", ar: "رام الله" }` |
| `slug` | string | required, unique per region (application-layer enforced, same pattern as `Category.slug`) — language-independent |
| `searchTerms` | array of string | lowercase keyword tokens derived from both `name.en` and `name.ar` at write time, queried via `array-contains-any` for the selector's bilingual search (spec FR-088) |
| `displayOrder` | number | required, non-negative integer |
| `isActive` | boolean | required, default `true`; only active locations are offered in the selector, `CheckoutLocationSelect`, and are valid for order creation (spec FR-092) |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

**Composite indexes**:

- `regionId ASC, isActive ASC, displayOrder ASC` — selector's per-region city list, and the
  region-scoped search
- `isActive ASC, displayOrder ASC` — a flat, all-regions active list where needed

**Validation rules**: `regionId` must be one of the two fixed `deliveryRegions` document IDs;
`name.en` and `slug` required; `displayOrder` non-negative integer.

**Relationships**: references `deliveryRegions/{regionId}`; referenced by `users/{uid}.profile.
address` (preferred location) and snapshotted (not referenced) inside `orders.delivery` at
checkout time — see `orders/{orderId}` below.

## `collections/{collectionId}`

Curated merchandising grouping, distinct from `categories` (research.md, original §"Collections"),
spanning one or more categories. Covers New Arrivals, Best Sellers, Special Offers, and future
curated groupings.

| Field | Type | Notes |
|---|---|---|
| `collectionId` | string | Firestore auto-ID |
| `name` | string | required, unique |
| `slug` | string | required, unique |
| `description` | string \| null | optional |
| `type` | `"DYNAMIC" \| "MANUAL"` | `DYNAMIC` = computed membership (New Arrivals = most-recently-created available products via the `isNewArrival` index; Best Sellers = top `salesCount` via the `isBestSeller` index); `MANUAL` = explicit `productIds` list (e.g., Special Offers) |
| `productIds` | array of string (Product doc IDs) | used when `type === "MANUAL"`; ignored for `DYNAMIC` |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

**Rationale for `DYNAMIC`/`MANUAL` split**: unchanged from the original model — New Arrivals and
Best Sellers stay correct automatically as products change; Special Offers needs explicit admin
selection. New curated collections can be added later purely as data (a new `MANUAL` document),
satisfying "collections can be extended later" with no code change.

## `carts/{uid}` and `guestCarts/{guestCartId}`

Two collections (rather than one collection with a discriminator field), so that a **Firestore
TTL policy** can be applied to `guestCarts` only, expiring abandoned guest carts automatically
without risking a registered customer's cart (research.md §5). A registered customer's cart
document ID is always their `uid`; a guest cart's document ID is the opaque `guestCartId` from the
signed cookie. Both collections share the same document shape:

| Field | Type | Notes |
|---|---|---|
| `items` | array of `CartItem` (see below) | |
| `expiresAt` | Timestamp | **`guestCarts` only** — the field the Firestore TTL policy targets; refreshed on every mutation (~30 days out); not present on `carts` documents (registered carts never expire) |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

**`CartItem`** (embedded object within the `items` array — Firestore's native map/array support
replaces Mongoose embedded subdocuments directly, no structural change needed):

| Field | Type | Notes |
|---|---|---|
| `productId` | string | required, references `products/{productId}` |
| `selectedOption` | `{ optionKey, valueKey } \| null` | required if the product defines `options`; references the **stable, language-independent** `options[].key`/`values[].key` on the product (data-model.md, `products`) — never a localized label, so a cart line's selection is unaffected by switching language. The localized label is resolved from the live product at render time |
| `quantity` | number | integer ≥ 1; re-validated against live stock on every read used for checkout |

**Invariant**: a cart is either a `carts/{uid}` document or a `guestCarts/{guestCartId}` document
— never both for the same shopping session; the merge operation (research.md §6) is what moves a
shopper from the latter to the former.

## `wishlists/{uid}`

Registered customers only (spec FR-033a) — no guest wishlist documents exist. Document ID is
always the owning user's `uid` (one wishlist per user, enforced structurally by using `uid` as the
document key rather than a separate unique index).

| Field | Type | Notes |
|---|---|---|
| `items` | array of `WishlistItem` (see below) | |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

**`WishlistItem`** (embedded object):

| Field | Type | Notes |
|---|---|---|
| `productId` | string | required |
| `addedAt` | Timestamp | server-assigned at add time |

## `orders/{orderId}`

| Field | Type | Notes |
|---|---|---|
| `orderId` | string | Firestore auto-ID; internal only, never shown to customers |
| `orderNumber` | string | required, unique by construction (transactional counter, research.md §4); format `ELR-YYYYMMDD-NNNN` |
| `userId` | string \| null | Firebase `uid` for an authenticated checkout, `null` for a guest order |
| `customer` | `{ fullName, email, phone }` | required snapshot, captured at checkout regardless of `userId` |
| `delivery` | `{ regionId, locationId, regionName: LocalizedString, locationName: LocalizedString, addressLine, notes? }` | required snapshot — `regionId`/`locationId` reference `deliveryRegions`/`deliveryLocations` as they existed at checkout (spec FR-092); `regionName`/`locationName` are a **bilingual snapshot** of those documents' `name` at that moment, captured the same way `OrderItem.productName` is (below), so a past order stays understandable even if an admin later renames/deactivates that location (spec FR-095, Edge Cases) |
| `items` | array of `OrderItem` (see below) | immutable once created |
| `subtotal` | number | required, minor units, server-calculated |
| `total` | number | required, minor units, server-calculated (currently equal to subtotal; the field exists so future fees/discounts don't require a schema change) |
| `paymentMethod` | `{ type: "COD" }` (extensible union) | required; research.md §10 |
| `status` | `"PENDING" \| "CONFIRMED" \| "PREPARING" \| "SHIPPED" \| "DELIVERED" \| "CANCELLED"` | required, default `"PENDING"` |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

**`OrderItem`** (embedded object — immutable snapshot):

| Field | Type | Notes |
|---|---|---|
| `productId` | string \| null | reference where available; `null` only if the product was later hard-deleted (name/image/price snapshot still fully describes the line) |
| `productName` | `LocalizedString` | **bilingual** snapshot at purchase time (spec FR-079) — both `en` and `ar` are captured from the product as it existed at checkout, so the order remains understandable in either language regardless of later product-translation edits or deletion |
| `productImage` | string \| null | snapshot (first image URL) at purchase time — not language-dependent |
| `selectedOption` | `{ optionKey, valueKey, label: LocalizedString } \| null` | snapshot — unlike the live `CartItem.selectedOption` (which resolves its label from the current product), the order's copy stores the **bilingual label text itself** at purchase time, since this is historical data that must stay correct even after the product's option labels are later edited |
| `unitPrice` | number | snapshot, minor units — language-independent |
| `quantity` | number | integer ≥ 1 |
| `lineTotal` | number | `unitPrice * quantity`, stored (not recomputed) so historical totals never drift |

**Composite indexes**:

- `userId ASC, createdAt DESC` — a customer's own order history
- `status ASC, createdAt DESC` — admin order list filtering
- `orderNumber` is queried as a single-field equality lookup (auto-indexed) for
  `/order-confirmation/[orderNumber]` and `/account/orders/[orderNumber]`

**State transitions** (enforced in the order-status domain service, not just the UI — unchanged
from the original model):

```
PENDING → CONFIRMED → PREPARING → SHIPPED → DELIVERED
PENDING → CANCELLED
CONFIRMED → CANCELLED
PREPARING → CANCELLED
```

- `SHIPPED` and `DELIVERED` are terminal for cancellation.
- `DELIVERED` and `CANCELLED` are terminal states; no transitions out of either.
- Any transition not listed above is rejected by the service with a clear error.
- A `CANCELLED` transition runs inside a Firestore transaction that decrements each line's
  `Product.salesCount` and increments (restocks) each line's `Product.stock`, so inventory and
  best-seller ranking stay accurate (Constitution Principle 10), and also decrements
  `stats/summary.totalSales`/`totalOrders` (see below) within that same transaction.
- `Order.status` remains this exact six-value enum string (spec FR-078) — it is **never** stored
  translated. Its Arabic/English display label (e.g., `"PENDING"` → "Pending"/"قيد الانتظار") is a
  pure client-side lookup against the static UI translation catalog (research.md §32), entirely
  separate from this stored value.

## `counters/order-{YYYYMMDD}`

| Field | Type | Notes |
|---|---|---|
| `seq` | number | current sequence value for that calendar day, incremented inside the order-creation transaction |

Not a domain entity — purely an implementation mechanism for research.md §4. One document is
created per calendar day on first use that day.

## `stats/summary`

| Field | Type | Notes |
|---|---|---|
| `totalSales` | number | minor units; sum of `total` across all non-cancelled orders |
| `totalOrders` | number | count of all non-cancelled orders |
| `updatedAt` | Timestamp | server-assigned on every transactional update |

A single, internal document (not a domain entity a user ever sees directly) maintained
transactionally by order creation (`+=`) and order cancellation (`-=`) — see research.md §17b.
Exists purely so the admin dashboard's total-sales and total-orders figures are an O(1) read
regardless of how large the `orders` collection grows, rather than requiring a scan or a
per-request aggregation over an unboundedly growing collection. Denied to all client reads/writes
(research.md §22) — read only by the dashboard's Server Component via the Admin SDK, written only
inside the order-creation/cancellation transactions.

## Cross-entity data-integrity rules

- **Historical accuracy** (spec FR-047 / Constitution Principle 9): an `OrderItem` never reads
  live `Product` data after creation; all display of past orders uses the embedded snapshot only.
- **Stock integrity** (Constitution Principle 10, spec FR-024/FR-036a): `Product.stock` is only
  mutated by (a) admin edits (create/update — Zod-rejected if negative), (b) order creation
  (decrement, inside the order-creation transaction), and (c) order cancellation (increment,
  inside the cancellation transaction). No other code path writes `stock`. Because (b) reads the
  current `stock` and re-validates `quantity <= stock` **inside the same transaction** that
  performs the decrement (research.md §3), two concurrent checkouts racing for the last unit(s)
  cannot both succeed — Firestore's transaction conflict handling ensures the second transaction
  to commit re-reads the already-decremented value and fails validation, so `stock` can never be
  driven below 0 by any combination of concurrent orders. "Sold Out" (`stock === 0`) is therefore
  always an accurate, race-free reflection of true availability, never an artifact of a stale read.
- **Cart/wishlist referential cleanup**: when a product is deleted by an admin, any `CartItem`/
  `WishlistItem` referencing it is filtered out at read time (not eagerly deleted), so a stale
  cart/wishlist never displays a dangling reference; the item silently drops out of the visible
  list with an "item no longer available" notice if it was present at that read.
- **Uniqueness without unique indexes**: Firestore has no native unique-constraint feature, so
  every field that was previously a MongoDB unique index (`User.email` — delegated entirely to
  Firebase Authentication, which does enforce email uniqueness; `Product.slug`;
  `Category.slug`/`name.en`; `Order.orderNumber`; `DeliveryLocation.slug`, unique per `regionId`)
  is instead enforced by either (a) delegating to Firebase Authentication (email), (b) a
  transactional counter that makes collision structurally impossible (order number), or (c) a
  read-check-then-write step inside the creating transaction/batch (slugs, category `name.en`,
  delivery-location slug scoped to its region) that aborts the write if a conflicting document is
  found. Uniqueness is always checked against the **English** value only (`name.en`) — Arabic
  names are never required to be globally unique, since they're display content, not identifiers.
- **Bilingual content never affects identity** (spec FR-072/FR-076/FR-095, new): `productId`,
  `slug`, `categoryId`, `orderNumber`, `regionId`, `locationId`, and every Firestore document
  reference in this data model are plain, language-independent strings. Switching the storefront's
  active language changes only which half of a `LocalizedString` is read for display — it never
  changes a document's ID, a slug/URL, a `categoryId`/`regionId`/`locationId` reference, an
  `optionKey`/`valueKey`, or the stored `status` enum value. This is the same principle already
  established for `Order.status` above, applied consistently across every entity that gained
  bilingual fields in this revision.
- **Authoritative delivery-location revalidation** (spec FR-092/FR-093, new): exactly like stock
  and pricing, a checkout's `regionId`/`locationId` is re-verified against the live
  `deliveryLocations` document (`regionId` matches, `isActive === true`) **inside the same
  order-creation transaction** that verifies stock and computes pricing (research.md §3) — never
  trusted from a client-supplied, previously-cached, or offline-displayed selection. If the check
  fails, the whole transaction aborts and no order is created, identically to an out-of-stock
  line.
