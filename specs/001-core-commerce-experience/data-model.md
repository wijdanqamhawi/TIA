# Data Model: Core Commerce Experience

**Feature**: `001-core-commerce-experience` | **Database**: Cloud Firestore (sole authoritative
data store — Constitution, research.md §1–§2)

> **Recovery note (2026-08-27)**: This file was accidentally destroyed (overwritten with a
> placeholder) during Special Offers remediation work and has been reconstructed from current
> project artifacts (TypeScript types, Zod schemas, Firestore converters, `spec.md`, `research.md`,
> `tasks.md`, `firestore.indexes.json`, and completed Phase 1–6 implementation) per explicit
> instruction, without OneDrive version recovery. Every entity below is either verified directly
> against implemented code (Users, Categories, Products, Category Showcases, Carts/Guest Carts,
> `LocalizedString`) or reconstructed from consistent, unambiguous descriptions in `spec.md`/
> `research.md`/`tasks.md` for entities not yet implemented (Wishlists, Orders, Counters, Stats,
> Delivery Regions, Delivery Locations). Any field whose exact shape could not be pinned down with
> confidence is explicitly marked **"Not yet pinned down"** rather than guessed — see the final
> implementation report for the consolidated list.

## Shared: `LocalizedString`

Used for every customer-facing bilingual text field (research.md §34). Never used for identifiers,
slugs, prices, stock, statuses, or any other language-independent value.

```ts
type LocalizedString = { en: string; ar: string | null };
```

`resolveLocalizedString(value, locale)` returns `value.ar` when `locale === "ar"` and it is
non-null, otherwise `value.en` — so a product/category with no Arabic content yet falls back to
English rather than rendering blank (spec SC-020).

---

## `users/{uid}` (`profile`/`profile.address` self-service editing implemented, Phase 9, T133–T135)

Document ID is the Firebase Auth `uid` — no separate application-generated user id. Guests are
never persisted here. `name`/`phone`/`profile.address` are customer-editable via
`updateProfileAction` (own `uid` only, taken from the verified session); `email` remains
Firebase-Auth-owned (kept in sync only by `createSessionAction`) and `role` remains server-managed
only — neither is ever accepted from a profile-update request.

| Field | Type | Notes |
|---|---|---|
| `uid` | string | mirrors the document ID |
| `name` | string | required |
| `email` | string | required, owned by Firebase Auth |
| `phone` | string \| null | optional |
| `role` | `"CUSTOMER" \| "ADMIN"` | server-set only; never client-writable |
| `profile.address` | `UserAddress \| null` | see below |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

`UserAddress`:

| Field | Type | Notes |
|---|---|---|
| `regionId` | string | one of the two fixed Delivery Region ids (`west-bank` \| `inside-1948`) |
| `locationId` | string | references `deliveryLocations/{locationId}` |
| `addressLine` | string | free text |
| `notes` | string \| null | optional |

The address's `regionId`/`locationId` double as the registered customer's persisted delivery-
location preference (research.md §41) — no separate `preferredLocationId` field exists.

---

## `categories/{categoryId}`

| Field | Type | Notes |
|---|---|---|
| `name` | `LocalizedString` | required |
| `slug` | string | required, unique, derived from `name.en`, language-independent |
| `description` | `LocalizedString \| null` | optional |
| `displayOrder` | number (non-negative int) | admin-controlled ordering |
| `isActive` | boolean | admin-controlled visibility |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

Fixed set of four for launch: Bracelets, Rings, Earrings, Watches (spec FR-007a–FR-007d).

---

## `products/{productId}`

| Field | Type | Notes |
|---|---|---|
| `name` | `LocalizedString` | required |
| `slug` | string | required, unique, derived from `name.en`, language-independent |
| `description` | `LocalizedString` | required |
| `price` | number (integer, minor units, > 0) | regular/original price |
| `categoryId` | string | must reference an existing category (server-validated, never trusted from the client) |
| `images` | `ProductImage[]` | `{ url, storagePath, position, alt }` |
| `material` | `LocalizedString` | required |
| `options` | `ProductOption[]` | `{ key, name: LocalizedString, values: { key, label: LocalizedString }[] }` |
| `stock` | number (non-negative int) | admin-managed; the only source of Sold Out |
| `availability` | boolean | admin-controlled visibility, independent of stock |
| `isNewArrival` | boolean | admin-set designation |
| `isBestSeller` | boolean | admin-set designation |
| `salesCount` | number (non-negative int) | denormalized counter, transactionally incremented on order creation / decremented on cancellation (research.md §17b) |
| `searchTerms` | string[] | bilingual keyword tokens (research.md §17a) |
| `isOnSale` | boolean | **(Special Offers)** admin-set; whether a promotional offer is configured/enabled at all |
| `salePrice` | number (integer, minor units) \| null | **(Special Offers)** must be `> 0` and strictly `< price`; required only when `isOnSale === true` |
| `saleStartAt` | Timestamp \| null | **(Special Offers)** optional; offer has not begun before this instant |
| `saleEndAt` | Timestamp \| null | **(Special Offers)** optional; offer has ended at/after this instant |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

### Sold Out derivation

`isSoldOut` is **never stored**. It is always computed as `stock === 0` (`lib/domain/catalog/
soldOut.ts`, Constitution Principle 10, spec FR-015a) — every read (storefront, cart, checkout,
admin, exports) uses this single function so the derived value can never drift from `stock`.
Sold Out is independent of, and always wins over, offer state: a Sold Out product on an Active
offer still cannot be purchased (spec FR-122).

### Offer status derivation (Special Offers)

A product's offer status is likewise **never stored** — it is always computed from `isOnSale`,
`salePrice`, `saleStartAt`, `saleEndAt`, and the current time, mirroring the Sold Out pattern
exactly (research.md §47, spec FR-115):

```ts
type OfferStatus = "DISABLED" | "SCHEDULED" | "ACTIVE" | "EXPIRED";

function getOfferStatus(product, now: Timestamp): OfferStatus {
  if (!product.isOnSale || product.salePrice == null) return "DISABLED";
  if (product.saleStartAt && now < product.saleStartAt) return "SCHEDULED";
  if (product.saleEndAt && now >= product.saleEndAt) return "EXPIRED";
  return "ACTIVE";
}

function getEffectivePrice(product, now: Timestamp): number {
  return getOfferStatus(product, now) === "ACTIVE" ? product.salePrice! : product.price;
}
```

Only `ACTIVE` counts as "on sale" anywhere in the UI or in price calculations (spec FR-116). Every
price-displaying surface (Home Special Offers section, Shop, category pages, product detail, Quick
View, Cart, Checkout, Orders-at-creation-time) calls `getEffectivePrice` against a live-read
Product — never a cached or client-submitted value (spec FR-119, SC-029). A historical order's
snapshotted item price is immutable and is never recomputed by a later offer change (spec FR-121).

### Validation rules

- `price > 0` (integer minor units).
- `stock >= 0` (integer).
- `salePrice`, when set, must be `> 0` and strictly `< price` — enforced client-side and re-verified
  server-side on every admin write (spec FR-114, SC-027).
- `slug` uniqueness is enforced via a transactional read-check-then-write (data-model.md
  "Uniqueness without unique indexes" pattern, reused for `salePrice` gating — no separate
  mechanism needed).

### Composite indexes (`firestore.indexes.json`)

| Fields | Purpose |
|---|---|
| `availability ASC, createdAt DESC` | Shop "newest" sort |
| `availability ASC, price ASC` | Shop "price" sort |
| `availability ASC, salesCount DESC` | Shop "popularity" sort |
| `categoryId ASC, availability ASC, createdAt DESC` | category page, newest |
| `categoryId ASC, availability ASC, price ASC` | category page, price |
| `categoryId ASC, availability ASC, salesCount DESC` | category page, popularity |
| `isNewArrival ASC, availability ASC, createdAt DESC` | New Arrivals collection query |
| `isBestSeller ASC, availability ASC, salesCount DESC` | Best Sellers collection query |
| `isOnSale ASC, availability ASC, createdAt DESC` | **(Special Offers)** homepage/Shop Special Offers candidate query — `isOnSale == true AND availability == true`, then filtered to `ACTIVE` in application code, because Firestore cannot combine that equality filter with independent range filters on both `saleStartAt` and `saleEndAt` in one query (research.md §48, mirrors the `searchTerms` workaround in §17a) |
| `searchTerms CONTAINS, availability ASC` | keyword search |
| `searchTerms CONTAINS, categoryId ASC, availability ASC` | keyword search within a category |

Queries filter only on `availability`, never on `stock` — Sold Out products remain visible (shown
as SOLD OUT) rather than disappearing from listings.

### Relationships

- `categoryId` references `categories/{categoryId}`; a product is deleted independently of its
  category (categories are never cascade-deleted).
- An `Order Item` snapshot copies a product's bilingual name/option label/price **at purchase
  time** — later edits or deletion of the product never retroactively change a past order (spec
  FR-007-adjacent "Sold Out"/pricing integrity guarantees, spec SC-007).

---

## `categoryShowcases/{showcaseId}` (spec FR-001a–FR-001f)

| Field | Type | Notes |
|---|---|---|
| `categoryId` | string | references `categories/{categoryId}` |
| `desktopImage` | `{ url, storagePath }` | required |
| `mobileImage` | `{ url, storagePath } \| null` | optional |
| `title` | `LocalizedString` | required |
| `subtitle` | `LocalizedString \| null` | optional |
| `cta` | `LocalizedString` | required |
| `displayOrder` | number (non-negative int) | admin-controlled ordering |
| `isActive` | boolean | admin-controlled visibility |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

### Relationships

Each showcase's featured-product strip is a **live query** (`categoryId == X AND availability ==
true`, ordered by `createdAt DESC`, limited to a small N) — never a denormalized product list on
the showcase document, so it can never leak another category's products or go stale (spec FR-001b).

---

## `collections/{collectionId}` (optional, not currently required)

Originally specified as a generic curated-membership mechanism spanning New Arrivals, Best
Sellers, and Special Offers. **As of the current spec** (`spec.md` Key Entities, "Collection"),
all three of those are instead realized directly as derived queries over `Product` fields
(`isNewArrival`, `isBestSeller`, and the offer-state derivation above, respectively) — no
`collections` document is read or written by any currently-specified feature.

This generic entity remains a documented, possible **future** extension for a curated merchandising
grouping not already covered by a Product-level flag (e.g., a hand-picked "Gift Ideas" grouping),
should one be requested later. If implemented, its shape would be:

| Field | Type | Notes |
|---|---|---|
| `collectionId` | string | Firestore auto-ID |
| `name` | string | required, unique |
| `slug` | string | required, unique |
| `description` | string \| null | optional |
| `type` | `"DYNAMIC" \| "MANUAL"` | `DYNAMIC` = computed membership; `MANUAL` = explicit `productIds` list |
| `productIds` | array of string (Product doc IDs) | used when `type === "MANUAL"` |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

No code currently reads or writes this collection; it is not part of any active task.

---

## `carts/{uid}` and `guestCarts/{guestCartId}`

Two collections sharing one document shape, kept separate so a Firestore **TTL policy** on
`guestCarts.expiresAt` can never expire a registered customer's cart (research.md §5).

| Field | Type | Notes |
|---|---|---|
| `items` | `CartItem[]` | `{ productId, selectedOption: { optionKey, valueKey } \| null, quantity }` |
| `expiresAt` | Timestamp \| null | set (~30 days out) on every write for `guestCarts`; always `null` for `carts` |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

The cart document **never stores a price** — every read (`buildCartSummary`,
`lib/domain/cart/cart.service.ts`) joins live against `products/{productId}` and computes
subtotal/total server-side, re-validating availability/Sold Out/stock/selected-option and (once
Special Offers pricing is wired into cart display) the current effective price on every read, so
no client-submitted or stale total is ever trusted (spec "Price Security", FR-119, FR-120).

A guest cart is addressed by an opaque `guestCartId` carried in an HMAC-signed, `httpOnly`,
`Secure` (prod), `SameSite=Lax` cookie — the cookie itself never carries price or item data.
Guest→registered merge (`mergeGuestCartIntoUserCart`) sums duplicate `productId`+`selectedOption`
lines, clamps to live stock, and drops lines for deleted products.

---

## `wishlists/{uid}` (implemented, Phase 7, T109–T117)

Document ID is the Firebase Auth `uid`. Registered-customer-only; guests are never given a
temporary wishlist record (spec FR-033a) — a guest is redirected to sign in/register instead, and
no wishlist data is stored for her until she does. There is deliberately no `guestWishlists`
collection mirroring `guestCarts`.

| Field | Type | Notes |
|---|---|---|
| `items` | `WishlistItem[]` | see below |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

**`WishlistItem` — final, resolved shape** (this permanently resolves the prior "Not yet pinned
down precisely" note):

| Field | Type | Notes |
|---|---|---|
| `productId` | string | reference only |
| `selectedOption` | `{ optionKey: string, valueKey: string } \| null` | mirrors `CartItem.selectedOption` exactly — a single option-dimension pair, never an array, matching the catalog's one-option-dimension-per-product model (this collection's own `carts/{uid}` section above); `null` when the product has no options |
| `addedAt` | Timestamp | used only to order the wishlist page newest-first; never displayed as, or substituted for, a stored price/stock value |

**Deliberately excluded** (this task's explicit requirement, spec FR-032, Constitution Principle
10): `quantity`, `price`, `stock`, and `availability` are never stored on a wishlist item. Every
display (the `/wishlist` page) and mutation (`moveWishlistItemToCartAction`) reads the product's
current price (via `resolveOfferPricing`, Special Offers-aware), stock, availability, and derived
Sold Out state live from `products/{productId}` at the moment of the read — the same live-read
pattern `buildCartSummary` already established for Cart, so wishlist pricing can never drift from
what Home/Shop/Cart/Checkout show for the same product at the same moment.

A Sold Out (or otherwise unavailable / insufficient-stock) item remains fully visible in the
wishlist — only "Move to Cart" is disabled/rejected for it; removing it always works regardless
(spec: "SOLD OUT products remain visible in Wishlist but cannot move to Cart").

### Guest-intent preservation (spec FR-033a, research.md §7)

A guest's "Add to Wishlist" click redirects to `/login?next=<path>&intent=wishlist:<productId>`
(or `wishlist:<productId>:<optionKey>:<valueKey>` when a specific option was selected) — no
guest-side data is ever written. `createSessionAction` parses and completes this `intent` right
after a successful sign-in/sign-up (re-validating the product/option still exist, exactly like the
Server Action would), then proceeds with the normal sign-in flow regardless of whether the intent
still resolves (a stale intent for a deleted product/option is silently ignored, never surfaced as
a sign-in error).

### Security / customer isolation

Every wishlist mutation is authorized via the verified session's own `uid` (`requireUser()`) —
the Firestore document path (`wishlists/{uid}`) is always derived from that verified `uid`, never
from a client-supplied identifier, so a customer can only ever read or write her own wishlist. This
is the same enforcement pattern already used for `carts/{uid}`. Per-collection Firestore Security
Rules (the `wishlists/{uid}`: owner-only-read, deny-all-write row) are added uniformly across every
collection in Phase 16 (T227) — not before, and not specially for this collection alone; until
then, `firestore.rules`' default-deny-all scaffold already denies any direct client access, and the
Admin SDK (all server-side reads/writes) bypasses it entirely, consistent with every other
collection at this stage of the project.

---

## `orders/{orderId}` (implemented, Phase 8, T118–T132; customer-facing read access added Phase 9, T136–T139)

Firestore auto-ID document. Created exactly once, entirely inside the single order-creation
transaction (`createOrder`, research.md §3); never mutated except by a future admin order-status
transition (Phase 10, T162 — updates only `status`/`updatedAt`, never the item/price/delivery
snapshot).

| Field | Type | Notes |
|---|---|---|
| `orderNumber` | string | human-readable `ELR-YYYYMMDD-NNNN`, generated from `counters/order-{YYYYMMDD}` inside the transaction (research.md §4); the Firestore document ID is never exposed to customers |
| `userId` | string \| null | `uid` for a registered customer; `null` for a guest order |
| `customerSnapshot` | `{ fullName: string, email: string, phone: string }` | captured at checkout; **`email` and `phone` are both required** — this permanently resolves the prior "not yet pinned down" ambiguity. `phone` is validated by the shared `phoneSchema` (also used at registration); the checkout form cannot be submitted without a valid phone number |
| `deliverySnapshot` | `{ regionId, regionName: LocalizedString, locationId, locationName: LocalizedString, fullAddress: string }` | `regionId`/`locationId` re-verified against live `deliveryRegions`/`deliveryLocations` data inside the same transaction; `regionName`/`locationName` are a bilingual **snapshot** captured at order time (research.md §42) — never re-derived later, so a later region/location rename never rewrites a past order |
| `items` | `OrderItem[]` | see below |
| `notes` | string \| null | a separate, order-level, optional customer note — distinct from any delivery-snapshot field |
| `subtotal` | number (integer, minor units) | server-recomputed at order-creation time from live effective prices, never client-submitted |
| `total` | number (integer, minor units) | mirrors `subtotal` — no shipping/tax/discount computation exists in this feature |
| `paymentMethod` | `"CASH_ON_DELIVERY"` | only method implemented (`PaymentMethod` discriminated union, research.md §10, allows future methods without a schema break) |
| `status` | `"PENDING" \| "CONFIRMED" \| "PREPARING" \| "SHIPPED" \| "DELIVERED" \| "CANCELLED"` | always `"PENDING"` at creation; the full transition state machine (`PENDING→CONFIRMED→PREPARING→SHIPPED→DELIVERED`, cancellation branches, terminal states) is validated in `order-status.service.ts`, built out in Phase 10 (T162) — Phase 8 only defines and stores the stable values and their localized (Arabic/English) display labels |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

`OrderItem` (immutable bilingual snapshot, spec FR-079/SC-007):

| Field | Type | Notes |
|---|---|---|
| `productId` | string | reference only — the product itself may later change or be deleted |
| `productName` | `LocalizedString` | snapshotted at purchase time |
| `selectedOption` | `{ optionKey, valueKey, label: LocalizedString } \| null` | snapshotted at purchase time |
| `unitPrice` | number (integer, minor units) | the product's **effective price** actually charged (regular or active Special Offer sale price via `getEffectivePrice`) at the exact moment of purchase — never recomputed later even if the offer subsequently changes (spec FR-121); the only value ever used in `subtotal`/`total` arithmetic |
| `originalPrice` | number (integer, minor units) | the product's regular price at purchase time — preserved for display/record purposes only, never used in a calculation |
| `wasOnSale` | boolean | `true` when `unitPrice < originalPrice` (the offer's derived status was `ACTIVE` at purchase time) — lets a later viewer identify a historical sale purchase without needing to read (and without ever trusting) live `Product` data |
| `quantity` | number (positive int) | as ordered |

### Guest order-confirmation access control

Order numbers are sequential (`ELR-YYYYMMDD-NNNN`) and therefore guessable. Viewing
`/order-confirmation/[orderNumber]` (which shows the customer's name/phone/address/order contents)
is restricted to: a signed-in customer whose `uid` matches `order.userId`, or — for a guest order
(`userId: null`) — the browser holding a short-lived, signed, httpOnly cookie granted by
`grantGuestOrderAccess` immediately after that exact checkout succeeds (`lib/domain/orders/
guest-order-access.ts`, mirrors `guest-cart.ts`'s HMAC-signing pattern). Neither case is ever
satisfied by merely knowing/guessing the order number — this is the concrete mechanism behind "a
normal customer must not access another customer's protected order data."

---

## `counters/order-{YYYYMMDD}` (implemented, Phase 8, T120–T121)

| Field | Type | Notes |
|---|---|---|
| `seq` | number (positive int) | per-day sequence (UTC calendar day); read during the order-creation transaction's read phase and committed during its write phase (`reserveOrderNumber`, research.md §4) so two concurrent checkouts can never receive the same value |

---

## `stats/summary` (implemented, Phase 8, T122; read by Phase 10's dashboard, T169)

Single denormalized document, avoids scanning `orders` for dashboard totals (research.md §17b).

| Field | Type | Notes |
|---|---|---|
| `totalSales` | number (integer, minor units) | `+= order.total` on order creation, `-= order.total` on cancellation (Phase 10), both transactional (`reserveStatsUpdate`) |
| `totalOrders` | number (non-negative int) | `+= 1` on order creation, `-= 1` on cancellation, both transactional |

Total registered customers and total products are **not** stored here — they use Firestore
`count()` aggregation queries directly against `users`/`products` instead (research.md §17b).

---

## `deliveryRegions/{regionId}` (implemented, Phase 8 prerequisite — pulled forward from Phase 19)

Exactly two documents, at two **fixed** document IDs — the two-region limit is enforced
structurally (only these IDs are ever validated as legitimate), not by an editable list. Seeded by
`scripts/seed.ts` (dev/test-only). Building this collection now (rather than waiting for the full
Phase 19 Navbar location-selector feature) was necessary because checkout itself requires a live
region/city selection per this task's explicit requirements — only the data layer was pulled
forward; Phase 19's polished modal/drawer selector, its persistence cookie, and its admin
management UI remain unbuilt.

| Field | Type | Notes |
|---|---|---|
| `regionId` | `"west-bank" \| "inside-1948"` | fixed; mirrors the document ID; never a fresh/auto-generated value (research.md §40) |
| `name` | `LocalizedString` | required |
| `displayOrder` | number (non-negative int) | admin-controlled ordering |
| `isActive` | boolean | admin-controlled visibility |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

---

## `deliveryLocations/{locationId}` (implemented, Phase 8 prerequisite — pulled forward from Phase 19)

Designed to be a fully admin-manageable city/area list within each fixed region (Phase 19's
eventual scope); for now, seeded directly by `scripts/seed.ts` with an illustrative starting set
per region (explicitly dev/test-only, not the final shipping coverage) — no admin create/edit/
deactivate UI exists yet.

| Field | Type | Notes |
|---|---|---|
| `regionId` | string | must be one of the two fixed `deliveryRegions` ids |
| `name` | `LocalizedString` | required |
| `slug` | string | unique **per region** (not globally); seeded directly rather than via the transactional read-check-then-write Phase 19 will add for admin-created locations |
| `searchTerms` | string[] | bilingual keyword tokens, generated the same way as product `searchTerms` (research.md §44) — populated at seed time; not yet exposed through a bilingual search UI (Phase 19) |
| `displayOrder` | number (non-negative int) | admin-controlled ordering |
| `isActive` | boolean | admin-controlled availability for checkout |
| `createdAt` / `updatedAt` | Timestamp | server-assigned |

### Authoritative delivery-location revalidation

Exactly like stock, a shopper's selected `regionId`/`locationId` is re-verified against **live**
`deliveryLocations` data inside the order-creation transaction (research.md §42, T277) — the
transaction aborts with no order created if the document doesn't exist, its `regionId` doesn't
match, or `isActive !== true`, even if the location looked valid when first selected (spec
FR-092–FR-093, SC-023).

### Composite indexes (implemented, `firestore.indexes.json`)

| Fields | Purpose |
|---|---|
| `deliveryLocations: regionId ASC, isActive ASC, displayOrder ASC` | location list within a region |
| `deliveryLocations: isActive ASC, displayOrder ASC` | flat active-location list |
| `deliveryRegions: isActive ASC, displayOrder ASC` | region selector |

---

## Cross-entity data-integrity rules

- **Stock integrity**: `stock` is only ever mutated inside a Firestore transaction that re-reads it
  first (`decrementStockForOrder`, `restockForCancellation`) — never a bare `update()` from client
  input — so concurrent checkouts can never drive it below 0 (research.md §3).
- **Sold Out derivation**: never stored; always `stock === 0` (`lib/domain/catalog/soldOut.ts`).
- **Offer status derivation**: never stored; always computed from `isOnSale`/`salePrice`/
  `saleStartAt`/`saleEndAt` and the current time (`getOfferStatus`/`getEffectivePrice` above);
  always subordinate to Sold Out (a Sold Out product is never purchasable regardless of offer
  state).
- **Language-independent identifiers**: every document ID, `slug`, option/value `key`, order
  `status` value, `paymentMethod` value, and `regionId`/`locationId` is a stable, language-
  independent string — never a bilingual value, never affected by the currently selected locale.
- **Historical snapshot immutability**: `OrderItem.productName`/`selectedOption.label`/`unitPrice`
  and `Order.delivery.regionName`/`locationName` are captured once, at order-creation time, and are
  never rewritten by later product/translation/price/offer/location edits (spec FR-007, FR-121,
  SC-007).
- **Admin-only mutation surface**: every collection above is written exclusively through
  server-verified Server Actions / the Admin SDK — no collection is ever client-writable via
  Firestore Security Rules directly (`tasks.md` T227, "all writes admin-SDK-only" /
  "denied — all mutations go through Server Actions").
- **Firebase/Cloud Firestore remains the sole authoritative data store** for every entity above —
  no MongoDB, no secondary database, and (per the Excel Export feature) no export file is ever a
  second source of truth.
