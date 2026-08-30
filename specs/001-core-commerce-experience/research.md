# Phase 0 Research: Core Commerce Experience

**Revision note (2026-08-26)**: This document was updated to replace the MongoDB/Mongoose data
layer with Firebase (Cloud Firestore, Firebase Authentication, Firebase Admin SDK, Firebase
Storage), per an explicit stack change. All other technical decisions (Next.js App Router,
Server Actions, Zod, Playwright/Vitest, Vercel, design system, SEO, accessibility, etc.) are
unchanged from the original research. Every item below records the resulting decision, rationale,
and alternatives considered so the plan does not silently invent technical choices (Constitution
Principle 21).

## 1. Framework & rendering model

- **Decision**: Next.js (App Router) + React + TypeScript, Server Components by default, Client
  Components only for interactive leaves (quantity steppers, cart drawer, filters, forms, image
  uploader, dialogs, and the Firebase Auth client SDK sign-in/sign-up forms).
- **Rationale**: Directed by user. App Router's Server Components minimize client JS (Principle
  17), and Server Actions/Route Handlers keep business logic and all trusted Firestore/Storage
  access off the client, satisfying Principle 11 (separation of concerns) and Principle 15 (no
  secrets client-side).
- **Alternatives considered**: Pages Router (rejected — App Router is current and required by the
  brief); separate SPA + API backend (rejected — unnecessary split for a single deployable app).
- **Unchanged by the Firebase migration.**

## 1a. Category page routing structure (new — dedicated category pages)

- **Decision**: Each product category gets its own dedicated route,
  `/shop/category/[categorySlug]` (e.g., `/shop/category/bracelets`, `/shop/category/rings`,
  `/shop/category/earrings`, `/shop/category/watches`), a Server Component that queries
  `products` filtered to `categoryId == <that category's id>` using the composite indexes in
  data-model.md, and reuses the same search/filter/sort UI as the main `/shop` page — scoped to
  that category only (spec FR-007a, FR-007c). The main `/shop` page keeps its existing
  `[slug]` product-detail route; the category segment (`/shop/category/...`) is a sibling path,
  not a suffix on `/shop/[slug]`, specifically so a category slug can never collide with a product
  slug at the same URL depth. The Shop page itself additionally gets a category
  filter/switcher control (`?category=<slug>` query param, or equivalent client state) so a
  customer can narrow to one category without leaving `/shop` (spec FR-007b), while a category's
  own page always offers the "clean" canonical URL for that category (used for the homepage
  Featured Categories cards, storefront navigation, and search-engine indexing).
- **Rationale**: The brief's example (`/shop/bracelets`) would collide with the existing
  `/shop/[slug]` product-detail route (data-model.md's `Product.slug` and a category's `slug`
  live in different collections with no cross-collection uniqueness guarantee — nothing stops an
  admin from naming a product "bracelets" and creating a routing ambiguity). `/shop/category/...`
  is the "equivalent clean SEO-friendly category structure" the brief explicitly allows,
  preserving a short, readable, crawlable URL per category while removing that collision risk
  entirely.
- **Alternatives considered**: Reusing `/collections/[slug]` for categories too (rejected — the
  spec deliberately keeps Category and Collection as distinct concepts, spec FR-007/FR-046a; a
  category page and a collection page have different membership rules — one is fixed taxonomy,
  the other is curated/dynamic — and conflating their routes would blur that distinction for
  users and for the `DYNAMIC`/`MANUAL` collection logic in data-model.md); a query-param-only
  approach (`/shop?category=bracelets`) with no dedicated category route at all (rejected — the
  brief explicitly asks for dedicated, SEO-friendly category routes/pages, and a query-param-only
  URL is weaker for search indexing and for direct/shareable links to a single category).

## 2. Database & data access — Cloud Firestore

- **Decision**: Cloud Firestore (Native mode) is the system of record for all application data
  (users, products, categories, collections, carts, wishlists, orders, counters). All reads and
  writes used for business logic go through the **Firebase Admin SDK**, invoked only from
  server-side code (Server Actions, Route Handlers, Server Components) — never from a client SDK
  for anything beyond the Firebase Auth sign-in/sign-up UI itself. A single cached Admin SDK app
  instance (`lib/firebase/admin.ts`) is initialized once per server process to avoid
  re-initializing the SDK on every request in a serverless environment.
- **Rationale**: Directed by user (replace MongoDB/Mongoose with Firebase/Firestore). Keeping all
  business-data access server-side via the Admin SDK preserves the original constraint that
  "database access must only occur server-side," and lets Firestore Security Rules default-deny
  all direct client access to business collections as a defense-in-depth backstop (see §9),
  rather than relying on rules alone to enforce business logic. This directly carries forward
  Constitution Principle 11 (clear boundaries between UI and data access) and Principle 15.
- **Alternatives considered**: Client-side Firestore SDK with Security Rules as the sole
  enforcement layer (rejected — would move authorization/pricing/inventory logic into declarative
  rules, which is harder to unit test and keep aligned with the domain services already planned
  in `lib/domain/*`, and would let a compromised client attempt writes even if rules block them —
  worse defense-in-depth than never exposing the write path at all); Cloud SQL/Postgres (rejected
  — user specified Firebase); staying on MongoDB (rejected — explicit migration instruction).

## 3. Transactional writes — Firestore transactions (replaces MongoDB transactions / replica set)

- **Decision**: Order creation uses a single Firestore **transaction**
  (`db.runTransaction(...)` via the Admin SDK) that reads the authoritative product documents,
  the order-number counter document, and (for a registered customer) the user's cart document,
  **validates every line's requested quantity against that just-read, authoritative `stock`
  value** (rejecting the entire transaction — no partial order — if any line's quantity exceeds
  current stock, is Sold Out, or the product is no longer available), then performs all writes —
  stock decrement, `salesCount` increment, `stats/summary` counters, order-number counter
  increment, order document creation, and cart clear — atomically within that one transaction.
  Because the stock read and the stock write happen inside the same transaction, Firestore's
  optimistic-concurrency transaction handling guarantees `stock` can never be decremented below 0
  by any interleaving of concurrent checkouts (data-model.md, "Stock integrity"): if two customers
  race for the last unit, the transaction that commits second automatically re-reads the
  already-updated `stock`, fails its own validation, and is retried/rejected rather than allowing
  both to succeed.
- **Rationale**: User requires atomic/transaction-safe order creation. Firestore transactions
  provide the same all-or-nothing guarantee MongoDB multi-document transactions provided,
  **without any replica-set or special cluster topology requirement** — Firestore transactions
  work identically in every environment (local Firebase Emulator Suite, and the single managed
  Firestore database in every Firebase project) with zero additional infrastructure
  configuration. This removes the MongoDB-specific "replica set required for transactions"
  constraint entirely — there is no equivalent deployment requirement to document for Firestore.
  The only Firestore-specific limits to respect are: a transaction may read/write at most 500
  documents and must complete within 270 seconds — comfortably within this feature's per-order
  document count (a handful of product docs + 1 counter + 1 order + at most 1 cart).
- **Alternatives considered**: Firestore **batched writes** alone (rejected as the sole mechanism
  — batched writes are atomic for the writes themselves but cannot perform the reads-then-decide
  logic order creation needs, e.g., verifying current stock before deciding the write; a
  transaction is required precisely because it combines consistent reads with atomic writes);
  Cloud Functions-triggered compensating writes (rejected — unnecessary complexity when a single
  transaction already satisfies the atomicity requirement).

## 4. Order number strategy

- **Decision**: Human-readable order numbers of the form `ELR-YYYYMMDD-NNNN` (e.g.
  `ELR-20260826-0007`), where `NNNN` is a zero-padded, per-day sequence stored in a
  `counters/order-YYYYMMDD` Firestore document (`{ seq: number }`). Inside the same order-creation
  transaction (§3), the counter document is read, `seq` incremented, and the new value used to
  build the order number — Firestore transactions guarantee this read-increment-write is
  serialized against concurrent order creations, so two simultaneous checkouts can never receive
  the same sequence value. The Firestore document `_id`/auto-ID is never exposed to customers.
- **Rationale**: Satisfies "collision-resistant, human-readable, not a raw DB id." A
  transactional counter document is the Firestore-idiomatic equivalent of the previous MongoDB
  atomic `$inc` approach, preserving the same guarantee.
- **Alternatives considered**: Firestore auto-generated document IDs as the order number
  (rejected — not human-readable, explicitly disallowed); client-generated UUIDs (rejected — not
  human-friendly and not derived from a trusted server sequence); Cloud Firestore's
  `FieldValue.increment()` used outside a transaction (rejected — `increment()` alone is a
  fire-and-forget atomic add that never returns the resulting value to the caller, so it cannot
  be used to read back the new sequence number for the order-number string within the same
  request).

## 5. Guest cart persistence

- **Decision**: A guest cart is identified by a random, unguessable `guestCartId` stored in a
  signed, `httpOnly`, `Secure`, `SameSite=Lax` cookie (set on first cart mutation). The cart
  document lives in a dedicated `guestCarts/{guestCartId}` Firestore collection (kept separate
  from registered-customer carts — see §Data model note below) with an `expiresAt` timestamp
  field set ~30 days out on every write. A **Firestore TTL policy** is configured on
  `guestCarts.expiresAt` so Firestore automatically deletes expired guest carts with no
  application code required. The cookie only carries an opaque identifier — never price or item
  data — so the client cannot tamper with cart contents.
- **Rationale**: Satisfies "secure guest-cart persistence strategy suitable for production" and
  Principle 15 (no trusting client-supplied commerce data). Firestore TTL policies are the direct
  equivalent of the MongoDB TTL index used previously, but — because Firestore TTL policies apply
  per collection-group/field rather than per document flag — guest carts are kept in their own
  `guestCarts` collection (rather than a shared `carts` collection with a boolean discriminator)
  so the TTL policy cannot accidentally expire a registered customer's cart.
- **Alternatives considered**: A single `carts` collection with a `type: guest|user` discriminator
  and a manual cleanup Cloud Function (rejected — a native TTL policy on a dedicated collection is
  simpler and requires no scheduled function); client-side-only cart storage (rejected — same
  reasoning as the original research: not visible to the server for authoritative checks, doesn't
  survive device changes).

## 6. Guest → registered cart merge strategy

- **Decision**: Unchanged in behavior from the original plan. On successful login or
  registration, if a `guestCartId` cookie is present, its `guestCarts/{guestCartId}` document is
  merged into the user's `carts/{uid}` document inside a Firestore transaction: for each guest
  line, if the product already exists in the user cart, quantities are summed and clamped to
  available stock; otherwise the line is added (also clamped to stock). The guest cart document is
  then deleted and the cookie cleared.
- **Rationale**: Prevents losing items a shopper added before signing in (Principle 8) while never
  allowing the merge to produce an over-stock quantity. Using a transaction (rather than a plain
  batched write) ensures the stock-clamping read and the merge write are consistent even if
  another process changes stock concurrently.
- **Alternatives considered**: Same as original research — discarding the guest cart on login, or
  always overwriting the user cart — both rejected for the same UX/data-loss reasons.

## 7. Wishlist guest-intent handling

- **Decision**: Unchanged in behavior. Wishlist actions are registered-customer-only (spec
  FR-033a). When a guest clicks "Add to Wishlist," the client redirects to
  `/login?next=<current-path>&intent=wishlist:<productId>`. After successful authentication via
  Firebase Authentication, the login/register Server Action reads the `intent` param and, if it is
  a valid `wishlist:<productId>` for a product that still exists, performs the wishlist add
  (through the Admin SDK) before redirecting the user back to `next`. No guest-side data is
  persisted before authentication.
- **Rationale**: Matches the requirement to "preserve the intended product/action where
  reasonable" without introducing guest-side wishlist storage, which the spec explicitly rules
  out. Unaffected by the database/auth provider change beyond the identity check now being a
  Firebase Authentication session instead of an Auth.js session.

## 8. Authentication — Firebase Authentication (replaces Auth.js / NextAuth)

- **Decision**: **Firebase Authentication** (Email/Password provider) handles credential storage,
  password hashing, and identity verification — the Firebase platform itself manages password
  hashing (scrypt) and credential storage, so the application never handles or stores raw
  passwords or a password hash. The client-side Firebase Auth SDK is used only on the
  `/login` and `/register` pages to obtain a short-lived Firebase **ID token** after a successful
  sign-in/sign-up. That ID token is immediately POSTed to a Server Action
  (`createSessionAction`), which uses the **Firebase Admin SDK** to verify the token and mint a
  Firebase **session cookie** (`auth.createSessionCookie`, multi-day expiry), set as `httpOnly`,
  `Secure`, `SameSite=Lax`. All subsequent server-side authentication checks (Server Actions,
  Route Handlers, Server Components, middleware) verify that session cookie via the Admin SDK
  (`auth.verifySessionCookie`) — never trusting a client-supplied UID or role.
- **Rationale**: Directed by user (Firebase Authentication instead of Auth.js/NextAuth). Session
  cookies (rather than relying on the client SDK's own token refresh) give the server an
  authoritative, httpOnly, non-JS-readable credential to check on every request — the same
  server-verifiable-session property the original Auth.js database-session decision was chosen
  for. `auth.revokeRefreshTokens(uid)` provides the same "invalidate a session server-side"
  capability the original plan wanted (e.g., on role change or account deactivation).
- **Alternatives considered**: Trusting the Firebase client SDK's ID token directly on every
  request without a session cookie (rejected — would require the client to attach a fresh ID
  token to every Server Action call and re-verify it each time with no simple httpOnly-cookie
  transport; session cookies are Firebase's documented pattern for SSR frameworks precisely to
  avoid this); keeping Auth.js with a Firebase Adapter (rejected — user explicitly asked to
  replace Auth.js/NextAuth, and a dual-system approach would add complexity with no benefit once
  Firebase Auth is in use).

## 9. Roles & admin authorization enforcement

- **Decision**: Role (`CUSTOMER | ADMIN`) is stored as a **Firebase custom claim** on the user's
  Firebase Auth account (`role: "ADMIN"`), set only by the Admin SDK (never client-settable), and
  mirrored onto the corresponding `users/{uid}` Firestore document for convenient querying (e.g.,
  "list all customers" in the admin panel) — the custom claim remains the authoritative value for
  authorization checks; the Firestore mirror is read-model convenience only. Enforcement keeps the
  same three-layer defense-in-depth as the original plan:
  1. `middleware.ts` performs a **lightweight presence check** (does a valid-looking session
     cookie exist?) to fast-redirect obviously-unauthenticated requests away from `/admin/*`. It
     does not call the Admin SDK (which is a heavier, Node-only dependency not ideal for
     middleware's default Edge runtime) — it is a fast pre-filter only, not the authorization
     decision.
  2. Every admin Server Action, Route Handler, and the `admin/layout.tsx` Server Component
     independently verifies the session cookie via the Admin SDK and checks
     `decodedClaims.role === "ADMIN"` before doing or rendering anything admin-only. This is the
     actual, authoritative enforcement point.
  3. Admin-only UI is additionally hidden client-side as a UX nicety only, never as the
     enforcement mechanism.
- **Rationale**: Directly satisfies Principle 6 ("hiding a button... is never sufficient") and
  spec FR-034/FR-035. Custom claims are Firebase's documented mechanism for role-based access and
  are embedded directly in the ID token / session cookie, so no extra Firestore read is required
  to authorize a request — the claim is available the instant the session cookie is verified.
- **Alternatives considered**: Relying solely on a `role` field in the `users/{uid}` Firestore
  document, read on every request (rejected — an extra Firestore read per request versus a claim
  already present in the verified session cookie; also more error-prone to keep in sync as the
  sole source of truth); middleware-only protection using the Admin SDK in a Node.js-runtime
  middleware (viable alternative — Next.js middleware can run in the Node.js runtime, but this
  plan keeps the authoritative check in Server Components/Actions regardless, so middleware stays
  a lightweight pre-filter rather than a second full Admin-SDK verification, which would be
  redundant compute on every request without adding real security beyond what layer 2 already
  guarantees).

## 10. Payment abstraction

- **Decision**: Unchanged. A `PaymentMethod` interface/discriminated union
  (`{ type: "COD" } | future types`) behind `lib/domain/checkout/payment/`. Order creation calls a
  single `resolvePaymentMethod(input)` that validates the method is enabled/supported and returns
  a normalized value stored on the order document; `CashOnDeliveryProvider` is the only
  implementation now.
- **Rationale**: User requires an extensible abstraction so future online payment providers don't
  require redesigning checkout (spec FR-022). Not affected by the database/auth migration.

## 11. Product image management — Firebase Storage (replaces Cloudinary)

- **Decision**: **Firebase Storage** holds all product images, under a strict
  `products/{productId}/{imageId}` path convention. Because the admin's authenticated Firebase ID
  token is already available client-side after sign-in, the admin's browser uploads **directly to
  Firebase Storage using the Firebase client SDK**, with **Firebase Storage Security Rules**
  restricting writes under `products/**` to requests that are simultaneously: (a) authenticated
  (`request.auth != null`), (b) carrying the `role == "ADMIN"` custom claim (mirroring the same
  claim used for Firestore/server authorization, §9), (c) an image content type
  (`request.resource.contentType.matches('image/(jpeg|png|webp)')`), and (d) under a size ceiling
  (e.g., `request.resource.size < 8 * 1024 * 1024`) — so file-type and file-size validation happen
  at the Storage layer itself, not just trusted from client-side form checks. No separate
  server-side "signed upload URL" endpoint is required the way Cloudinary's flow needed one. After
  a successful upload, the client calls `attachUploadedImageAction` (a Server Action) with the
  resulting Storage path and download URL; that action re-verifies the caller is an admin via the
  Admin SDK, re-validates the payload shape with Zod, and persists
  `{ url, storagePath, position, alt }` onto the product document. Admins can reorder
  (`reorderProductImagesAction` updates `position`) and remove images
  (`removeProductImageAction` deletes the object from Storage via the Admin SDK — which, as a
  trusted server context, bypasses Storage Security Rules the same way the Admin SDK bypasses
  Firestore Security Rules — then removes it from the product document). Firebase Storage's
  built-in image-serving supports resizing via a standard Cloud Function extension
  (`Resize Images`) if responsive derivatives are needed beyond what `next/image` already
  provides at request time; this plan relies on `next/image` for responsive delivery and does not
  require that extension at launch.
- **Rationale**: Matches "Firebase Storage instead of Cloudinary," "secure server-side
  [authorization for] upload flow," "multiple images," "remove/reorder," "persisted URL/public
  identifier." Enforcing the write restriction via Storage Security Rules (checked against the
  same custom claim used everywhere else) is the Firebase-idiomatic equivalent of Cloudinary's
  signed-upload-signature flow, and is simpler because it needs no dedicated signing Route
  Handler.
- **Alternatives considered**: Proxying image bytes through a Next.js Route Handler to the Admin
  SDK's Storage bucket API (rejected — routes large binaries through the serverless function
  unnecessarily, worse for performance/body-size limits than direct-to-Storage upload, same
  reasoning that ruled out storing binaries in the database); keeping Cloudinary alongside
  Firebase (rejected — user explicitly asked to remove Cloudinary in favor of Firebase Storage).

## 12. Validation

- **Decision**: Unchanged. Zod schemas colocated under `lib/validation/`, one file per domain area
  (auth, profile, checkout, product, cart, order-status), imported by both Server Actions/Route
  Handlers (server-side enforcement, source of truth) and client forms (immediate UX feedback
  only — never trusted as the enforcement point).
- **Rationale**: Directed by user; satisfies Principle 13. Not affected by the database/auth
  migration — Zod validates plain request payloads regardless of what persists them.

## 13. Rate limiting

- **Decision**: Unchanged in approach. A small `rateLimit(key, limit, windowSeconds)` utility in
  `lib/utils/rate-limit.ts` applied to authentication (login/register) and checkout submission,
  pluggable between an in-memory limiter (local dev) and a durable store (e.g., Upstash Redis via
  the Vercel Marketplace) in production so limits are consistent across serverless instances.
  Firebase Authentication also applies its own built-in abuse protection on sign-in attempts as a
  complementary platform-level control.
- **Rationale**: User requires "basic rate limiting strategy for sensitive endpoints." Not a
  database concern, so unaffected by the Firestore migration beyond noting Firebase Auth's native
  protection as an additional layer.

## 14. Testing stack

- **Decision**: Vitest for unit and integration tests. Integration tests that need a real
  Firestore/Auth/Storage backend run against the **Firebase Local Emulator Suite**
  (`firebase emulators:start` — Firestore, Authentication, and Storage emulators), configured via
  `firebase.json` and started automatically by the test runner in CI. Unit tests specifically
  cover the Sold Out derivation logic (`isSoldOut = stock === 0`) and the stock/quantity
  validation rules (rejecting 0, negative, non-integer, and over-stock quantities) as pure
  functions, independent of Firestore. Playwright remains the E2E framework for the critical
  customer/admin journeys (quickstart.md), including the Sold Out and out-of-stock-checkout
  scenarios, run against either the emulator suite (fast, isolated) or a dedicated Firebase
  "staging" project (closer to production).
- **Responsive/viewport coverage (strengthened — spec FR-050, SC-008/SC-008a)**: the critical
  customer flow (guest browse → cart → checkout → confirmation) and the critical admin flow
  (login → dashboard → product/order management) are each run under Playwright's device emulation
  at, at minimum, one representative **mobile** viewport (e.g., 375×667, iPhone-class), one
  **tablet** viewport (e.g., 768×1024, iPad-class), and one **desktop** viewport (e.g.,
  1280×800+), using Playwright's built-in device presets/`viewport` option rather than hand-rolled
  window-resize scripting. These automated passes are a floor, not a substitute for human
  judgment: before a production release, the storefront and Admin Dashboard are additionally
  **manually verified** on representative real/emulated iPhone, Android, tablet, laptop, and
  desktop layouts (spec Assumptions — representative widths, not an exhaustive device matrix),
  since automated viewport emulation cannot fully substitute for checking real touch behavior,
  font rendering, and on-device performance.
- **Rationale**: Directed by user (Playwright explicit) and Firebase migration. The Emulator Suite
  is the direct Firebase-native replacement for `mongodb-memory-server` — it gives fully local,
  disposable Firestore/Auth/Storage instances for fast, isolated tests without touching a real
  Firebase project. Explicit mobile/tablet/desktop E2E coverage plus a pre-release manual pass
  directly satisfies the brief's testing requirement and Constitution Principle 19 (testing
  proportional to business risk) — responsive behavior across the whole app is exactly the kind of
  regression that's easy to break silently in a later change and hard to catch without a
  standing, repeatable check.
- **Alternatives considered**: Testing directly against a real (non-production) Firebase project
  for all integration tests (rejected as the default — slower, shared-state risk between test
  runs, and consumes quota; kept as an option for E2E only, not unit/integration).

## 15. Observability

- **Decision**: Unchanged in shape. Structured server-side logging via a thin `logger` utility
  (JSON-shaped log entries: level, event, requestId/uid where applicable, message) wrapping
  `console.*`. Errors thrown from domain services carry safe, user-facing messages separate from
  internal detail (including Firestore/Admin SDK error codes, which are never surfaced directly to
  the client — Constitution Principle 15). The app remains structured so Sentry (or an equivalent)
  can be added later with no business-logic changes; Google Cloud's operations suite (Cloud
  Logging/Error Reporting) is also a natural fit given the Firebase/Google Cloud project this app
  now runs against, and is noted as an alternative future option.
- **Rationale**: Satisfies "structured server-side logging" and "design so a monitoring platform
  can be added cleanly." Not materially changed by the Firebase migration beyond noting the
  Google Cloud ops-suite option.

## 16. SEO

- **Decision**: Unchanged. `generateMetadata` per route (home, shop, product, collection, about,
  contact) for titles/descriptions/canonical/Open Graph; a `sitemap.ts` and `robots.ts` generated
  from persisted product/category/collection data (now read via the Admin SDK from Firestore
  instead of Mongoose); JSON-LD `Product` structured data on product detail pages.
- **Rationale**: Directed by user and Constitution Principle 18. Purely a data-source swap —
  Firestore queries replace Mongoose queries as the source for sitemap/metadata generation with no
  change to the SEO approach itself.

## 17. Performance & querying

- **Decision**: Product/category/collection listing pages are Server Components using time-based
  revalidation plus explicit on-demand invalidation: admin product/category mutations call
  `revalidateTag`/`revalidatePath` for the affected catalog paths right after a successful write.
  Product listings are paginated using Firestore cursor-based pagination
  (`startAfter(lastDocSnapshot)`) rather than offset pagination or loading the full catalog at
  once. All images render through `next/image` with responsive `sizes`, and below-the-fold
  imagery uses native lazy loading. Firestore queries against `products` are backed by **composite
  indexes** (declared in `firestore.indexes.json`, deployed via the Firebase CLI, full list in
  `data-model.md`) covering every filter+sort combination the shop page and collection sections
  need (category filter × newest/price/popularity sort, New Arrivals, Best Sellers), plus a
  single-field index on `slug` (Firestore auto-indexes single fields; `slug` uniqueness is
  enforced at the application layer inside the create/rename transaction, since Firestore has no
  native unique-constraint feature).
- **Rationale**: Directed by user (pagination, indexed queries, revalidation + invalidation,
  next/image, minimal client JS) and Constitution Principle 17, adapted to Firestore's query and
  indexing model (composite indexes are the Firestore-native equivalent of MongoDB's secondary
  indexes for this feature's query needs).
- **Alternatives considered**: Offset-based pagination via `.offset()` (rejected — Firestore still
  charges for and reads every skipped document, so cursor-based pagination is both the idiomatic
  and the cost-correct choice).

## 17a. Product search strategy (documented, not a silent assumption)

- **Decision**: Firestore has **no native full-text search** — this is called out explicitly here
  so it is never silently assumed away. For the expected launch scale (low hundreds of products),
  shop search uses a lightweight prefix/keyword-array field (`searchTerms: string[]`, populated
  from tokenized, lowercased words of the product `name` and its category's `name` (denormalized
  into `searchTerms` at write time, since `categoryId` alone is not searchable text) — e.g.,
  "Rose Gold Hoop Earrings" → `["rose", "gold", "hoop", "earrings"]`) queried with Firestore's
  `array-contains-any`, matching any query word against the token set. This is adequate for a
  single-brand catalog of this size where product names are short and shoppers mostly search by
  product type/material/style words that map directly onto tokens.
- **Rationale**: Satisfies spec FR-009 (keyword search) without silently assuming Firestore can do
  something it cannot, and without over-building a search subsystem the launch scale doesn't need.
- **Alternatives considered**: A dedicated search service (Algolia, Typesense, Meilisearch) —
  explicitly **not required for launch**, but the catalog design keeps this swap-in-place: search
  reads happen through one `searchProducts()` domain function
  (`lib/domain/catalog/product.service.ts`), so replacing the `searchTerms` query with a call to
  an external search index later is a localized change, not a rework of the catalog or its
  Firestore schema. This is the documented extensibility seam if the catalog outgrows
  keyword-array search.

## 17b. Dashboard statistics strategy (avoiding full-collection scans as data grows)

- **Decision**: Dashboard numbers are computed from three different mechanisms, each chosen for
  the specific field's growth pattern and freshness need:
  - **Total sales** and **total orders** (both must exclude cancelled orders and grow
    unboundedly with store activity) are maintained as a **denormalized summary document**,
    `stats/summary` (`{ totalSales: number, totalOrders: number }`), updated **transactionally**
    inside the same transaction that creates an order (`+= order.total`, `totalOrders += 1`) and
    inside the same transaction that cancels one (`totalSales -= order.total`,
    `totalOrders -= 1`). Reading the dashboard total is then a single-document read, regardless of
    how many orders the store has accumulated — it never scans the `orders` collection.
  - **Total registered customers** and **total products** use Firestore **aggregation queries**
    (`count()`) directly against `users` (filtered `role == "CUSTOMER"`) and `products`. These
    collections grow far more slowly (admin- or registration-driven, not per-transaction) and
    aggregation `count()` queries are computed server-side without transferring documents, so a
    direct count stays cheap and always exactly correct without needing a second denormalized
    counter to keep in sync.
  - **Recent orders** is a simple `orders` query ordered by `createdAt desc` with a small
    `limit()` (e.g., 10) — bounded and cheap regardless of collection size, backed by the
    single-field auto-index on `createdAt`.
  - **Best-selling products** reads `products` ordered by `salesCount desc` (filtered
    `availability == true`) with a small `limit()`, backed by the `isBestSeller`-adjacent
    composite index (data-model.md) — `Product.salesCount` is itself already a denormalized,
    transactionally-maintained counter (incremented/decremented on order creation/cancellation,
    data-model.md), so ranking is always a bounded top-N read, never a scan of `orders`.
- **Rationale**: Directly addresses "avoid repeatedly scanning the entire orders collection as
  store data grows" using the denormalized-counter and aggregation-query options the brief called
  out, applied where each fits: a summary document for figures that must aggregate an unbounded,
  fast-growing collection (orders), and cheap direct aggregation for figures over smaller,
  slower-growing collections (customers, products) where a second denormalized counter would just
  be another thing to keep consistent for no real benefit.
- **Alternatives considered**: Aggregation `sum()`/`count()` queries directly against `orders`
  for total sales/orders too (rejected as the primary mechanism — while Firestore aggregation
  queries don't transfer documents to the client, they still scan every matching document
  server-side, so cost and latency would grow linearly with total order history; the summary
  document makes dashboard reads O(1) regardless of scale); a scheduled Cloud Function that
  recomputes stats periodically (rejected — introduces eventual-consistency lag on a page whose
  entire purpose is showing the admin current figures, whereas the transactional summary document
  is always exactly correct the moment an order is created or cancelled).

## 18. Accessibility

- **Decision**: Unchanged. Semantic landmark structure, all form inputs paired with `<label>`,
  visible focus rings via Tailwind `focus-visible` utilities, accessible dialog/menu primitives
  with correct focus trapping, `prefers-reduced-motion` gating for non-essential animation, and an
  accessible mobile hamburger nav with `aria-expanded` and full keyboard operability.
- **Rationale**: Directed by user and Constitution Principle 16. Entirely independent of the
  database/auth provider.

## 18a. Responsive breakpoint, product-grid, and admin-table strategy (strengthened — spec FR-050–FR-050h)

- **Decision**: A **mobile-first, fluid** responsive approach using Tailwind's default breakpoint
  scale as the concrete, representative reference points for an otherwise continuous range of
  widths (spec Assumptions: these are representative checkpoints, not a fixed enumerated device
  list):

  | Breakpoint | Min width | Representative devices |
  |---|---|---|
  | *(base, no prefix)* | 0px | Small smartphones |
  | `sm` | 640px | Large smartphones |
  | `md` | 768px | Tablets / iPad portrait |
  | `lg` | 1024px | iPad landscape, small laptops |
  | `xl` | 1280px | Standard laptops, desktops |
  | `2xl` | 1536px | Large desktop monitors |

  All styling is written mobile-first (unprefixed Tailwind utilities target the smallest screens;
  `sm:`/`md:`/`lg:`/`xl:`/`2xl:` prefixes progressively enhance from there), per Constitution
  Principle 3 and spec FR-050.

  **Product grid** (spec FR-050a): `grid-cols-2` at base, `sm:grid-cols-2`, `md:grid-cols-3`
  (tablet), `lg:grid-cols-3` or `xl:grid-cols-4` (laptop/desktop), holding at 4 columns with a
  `max-w-*` constrained content container at `2xl` rather than growing to 5+ columns or
  letting individual cards stretch — "use the available space elegantly" (spec FR-050a) is
  satisfied by capping content width and increasing whitespace/margins at very large viewports,
  not by unbounded column growth.

  **Admin data tables** (spec FR-050e): below `md`, wide tables (orders, products, customers)
  render as a **responsive card list** (one card per row, key fields stacked as label/value
  pairs) instead of a fixed-column table; at `md` and above, the full table renders, with
  horizontal scrolling — if any remains necessary for a very data-dense table — confined to a
  `overflow-x-auto` wrapper around the table element itself, never the page (spec FR-050g).
  Statistic cards on the dashboard use a responsive grid (`grid-cols-1` at base up to
  `grid-cols-4`/`lg:grid-cols-4` or similar) so they stack on phones and arrange in a row on
  larger screens.

  **Cart/checkout line items** (spec FR-050d): below `md`, a cart/order line renders as a
  stacked card (image, name, options, quantity stepper, line total each on their own row within
  the card) instead of a table row; at `md` and above it may render as a compact table row.

  **Images** (spec FR-050f): every product image uses `next/image` with a `sizes` attribute
  matching the grid's actual rendered width at each breakpoint (e.g.,
  `sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"` for
  a grid card), so the browser requests an appropriately sized asset rather than always
  downloading the largest variant; `next/image` also serves density-aware (`1x`/`2x`) variants
  automatically for high-density displays, and every image is rendered inside an aspect-ratio-
  constrained container (Tailwind `aspect-*` utilities) so it can never overflow its layout slot
  regardless of the source image's native dimensions.

  **Touch targets and no-horizontal-overflow** (spec FR-050b, FR-050g, SC-008a): interactive
  controls (buttons, quantity steppers, form inputs, nav links) maintain a minimum touch target
  size on phone-width viewports (a `min-h-*`/`min-w-*` utility applied via the shared `Button`/
  `Input` primitives, research.md §19, so the guarantee lives in one place rather than being
  re-applied per page); the root layout avoids any fixed-width element wider than `100vw` (no
  un-constrained `min-w` on flex/grid children, tables wrapped in their own scroll container per
  above) so ordinary pages never produce page-level horizontal scrolling.
- **Rationale**: The brief explicitly strengthens "mobile-first" from a general principle
  (Constitution Principle 3, already adopted) into concrete, testable guidance per storefront area
  and for the Admin Dashboard specifically (spec FR-050–FR-050h). Tailwind's default breakpoint
  scale is the natural fit since Tailwind is already the styling system (research.md §1), needs no
  extra configuration, and its five breakpoints map cleanly onto the six requested device
  categories (a "large desktop monitor" is `2xl` behavior — capped content width — applied on top
  of the `xl` layout, not a seventh breakpoint). Documenting concrete column counts, table
  strategy, and image-sizing rules here means the "elegant," "natural," and "appropriate mobile
  presentation" language in the brief resolves to specific, implementable, testable behavior
  rather than being left for implementation to interpret differently per page.
- **Alternatives considered**: A custom (non-Tailwind-default) breakpoint set tuned to exact
  device widths (e.g., 375px for iPhone, 768px for iPad) (rejected — the brief explicitly asks
  for fluid adaptation across a *range*, not fixed device-specific breakpoints, and Tailwind's
  defaults already sit at sensible transition points that cover that range well); horizontal
  scroll for admin tables at every width instead of a responsive card alternative (rejected —
  explicitly identified as the thing to avoid on the whole page, and a table-confined scroll on a
  data-dense table is only acceptable as a fallback, not the default mobile presentation, per spec
  FR-050e).

## 19. Design system / brand tokens

**Revision note (2026-08-26)**: The brand palette itself changed (Constitution Principle 2,
amended to v2.0.0) — deep burgundy/wine red + elegant metallic gold + cream/ivory/beige replaces
the previous chocolate/dark-brown + champagne/rose-gold palette. This is a visual-identity-only
change: the token *mechanism* (Tailwind CSS custom properties, semantic names, no arbitrary
per-component color values), the typography pairing, and the reusable primitive set are all
unchanged from the original design-system decision — only the color values the tokens resolve to
are updated.

- **Decision**: Tailwind CSS theme tokens (CSS custom properties, defined once in `app/globals.css`
  and consumed everywhere else — no component hardcodes a raw color value) for the official ELORA
  JEWELLERY palette:

  | Token | Role |
  |---|---|
  | `--brand-burgundy` | Primary brand color — major backgrounds, navigation, footer, selected surfaces, premium sections |
  | `--brand-burgundy-dark` | Deeper burgundy for pressed/active states and high-emphasis surfaces |
  | `--brand-burgundy-light` | Lighter burgundy tint for subtle surfaces/borders on light backgrounds |
  | `--brand-gold` | Accent — borders, icons, highlights, buttons, decorative details, hover accents; refined metallic gold, never bright yellow |
  | `--brand-gold-muted` | A quieter, lower-emphasis gold for restrained detailing (e.g., admin screens) so gold reads as premium accent, not decoration overload |
  | `--brand-cream` | Primary light/secondary background |
  | `--brand-ivory` | Secondary light background variant (product card surfaces, alternating sections) |
  | `--brand-beige` | Tertiary light background/border tone |
  | `--text-primary` | Deep burgundy or very dark neutral text, used on light (cream/ivory/beige) backgrounds |
  | `--text-on-dark` | Cream/ivory text, used on burgundy backgrounds |
  | `--border-luxury` | The gold-toned border treatment used for premium emphasis (cards, dividers, form focus rings) |

  These are exposed as Tailwind theme colors (`bg-brand-burgundy`, `text-text-primary`, etc.) so
  every component references a semantic token, never a raw hex/rgb value. Typography remains an
  elegant serif/display heading face paired with a refined sans body face, both loaded via
  `next/font` for performance (unchanged from the original decision). Reusable primitives
  (`Button`, `Input`, `Card`, `Badge`, `Dialog`, `ProductCard`, `Price`, `EmptyState`, `Skeleton`,
  `FormError`) live under `components/ui/` and are the only place these tokens are consumed
  directly — feature components use the primitives, not the tokens, keeping the palette
  centralized and swappable in one file if it is ever revised again.

  **Per-surface application** (guidance for the primitives/pages that consume these tokens,
  matching the approved brand direction):
  - **Home / hero**: alternating deep-burgundy luxury sections and cream/ivory light sections,
    with refined gold detailing (borders, small icons, dividers) — never gold as a large fill.
    The official logo is integrated into the hero with clear contrast against its surrounding
    surface (light logo lockup on burgundy, or the logo's native colors on cream — never
    recolored, per Constitution Principle 2).
  - **Navigation / footer**: burgundy as the primary surface, cream/ivory text, subtle gold
    accents (active-state underline, icon accents, hover) — explicitly not overly decorative;
    gold stays a detail, not a dominant field.
  - **Product cards**: cream/ivory (light neutral) card surfaces, burgundy typography for
    name/price, subtle gold used only for small details (a thin border on hover, a badge accent)
    — cards must not be "overloaded with gold."
  - **Buttons**: primary buttons use `--brand-burgundy` background with `--text-on-dark`
    (cream/light) text; secondary/premium-accent buttons use a `--brand-gold` border/icon with
    burgundy or dark text, reserving solid gold fills for small, deliberate emphasis rather than
    large clickable areas. All button states are checked against WCAG contrast minimums
    (Constitution Principle 16) before being finalized during implementation.
  - **Admin dashboard**: usability takes priority over decoration — light cream/ivory working
    surfaces for tables and forms, burgundy for navigation/header/accent areas, gold used only
    restrainedly (a thin accent line, a small icon treatment) via `--brand-gold-muted` rather than
    the full-emphasis `--brand-gold` used on storefront marketing surfaces; data tables and
    operational screens are not decorated further than that.
  - **Official logo**: the logo asset supplied by the project owner is used exactly as provided —
    never regenerated, never automatically recolored to match the token palette — per Constitution
    Principle 2; if the logo's native colors sit awkwardly against a given surface, the surface
    (light vs. burgundy background choice, spacing, a subtle contrast plate behind it) is adjusted
    around the logo, not the other way around.
- **Rationale**: Directed by user (Constitution Principle 2, amended) — burgundy/gold/cream is now
  the official palette, replacing chocolate/rose-gold. Semantic tokens (rather than raw color
  values scattered through components) mean this kind of brand-identity revision stays a one-file
  change instead of a component-by-component find-and-replace, satisfying Constitution Principle
  11 (maintainability) as well as Principle 2. Exact accessible color values (specific hex/OKLCH
  numbers for each token) are left to be finalized during implementation, as directed, provided
  they remain visually consistent with Burgundy + Gold + Cream and meet contrast requirements
  (Principle 16).
- **Alternatives considered**: Hardcoding the new palette's specific colors directly in each
  component (rejected — exactly the "scattered arbitrary color values" the brief explicitly asked
  to avoid, and would make a future palette revision far more error-prone); a single flat
  `brand-primary`/`brand-accent` token pair without the burgundy-dark/light and gold/gold-muted
  gradations (rejected — collapses the "premium sections vs. admin restraint" and
  "hover/active state" distinctions the brief explicitly calls for into one value each, which
  would either make admin screens too decorative or storefront accents too flat).

## 20. Official logo asset

- **Decision**: Unchanged, and now also the source for every PWA icon (§23a). The official ELORA
  JEWELLERY logo file(s), once supplied by the project owner, are stored under `public/brand/` and
  referenced by a single shared `<Logo />` component so every usage (nav, footer, admin sidebar,
  auth pages, favicon/OG image, and every installed-app icon size/variant) points at one asset. No
  logo is generated as part of this plan or any later implementation step, and no icon derivation
  step alters the logo artwork itself — only the surrounding canvas (§23a).
- **Rationale**: Directed by user and Constitution Principle 2 (non-negotiable). Independent of
  the data layer.

## 21. First administrator creation

- **Decision**: A dedicated server-side bootstrap script (`scripts/create-admin.ts`, run via
  `npm run create-admin`) reads `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` from the
  environment, uses the **Firebase Admin SDK** to create (or fetch, if already present) the
  corresponding Firebase Authentication user, sets the `role: "ADMIN"` **custom claim** on that
  user via `auth.setCustomUserClaims(uid, { role: "ADMIN" })`, and mirrors a `role: "ADMIN"` field
  onto the matching `users/{uid}` Firestore document. There is no public "register as admin" UI
  route.
- **Rationale**: Directed by user; keeps admin provisioning out of any customer-facing surface,
  satisfying Principle 6. Adapted from the original Mongoose-`upsert` approach to Firebase's
  Admin-SDK user-creation + custom-claim mechanism, with the same operational shape (one
  idempotent script, env-var-driven, run once per environment).

## 22. Firestore Security Rules — least-privilege, per collection (new — no MongoDB equivalent)

- **Decision**: Every **write** to every business collection happens exclusively through the
  Firebase Admin SDK on the server (Server Actions / Route Handlers) — sensitive commerce logic
  (pricing, inventory, order creation, admin mutations, order-status changes) never depends on a
  direct browser write, full stop. **Reads** are scoped per collection on a least-privilege basis,
  since the Admin SDK's exclusivity is a write-path guarantee, not a reason to leave read rules
  needlessly blank:

  | Collection | Client read | Client write |
  |---|---|---|
  | `products`, `categories`, `collections` | **Public** (`allow read: if true`) — public catalog data, no reason to gate it | Denied — all catalog writes are admin Server Actions |
  | `deliveryRegions`, `deliveryLocations` | **Public** (`allow read: if true`) — the location selector and checkout must read the current supported-location list; the app's own reads still go through the Admin SDK per §2, this is a defense-in-depth/future-extensibility rule as above | Denied — all region/location writes are admin Server Actions (§40); `deliveryRegions` writes additionally re-validate the document ID is one of the two fixed values, never `create`/`delete` |
  | `users/{uid}` | Owner-only (`request.auth.uid == uid`) | Denied — profile edits go through `updateProfileAction` |
  | `wishlists/{uid}` | Owner-only | Denied — all mutations go through the wishlist Server Actions |
  | `carts/{uid}` | Owner-only | Denied — all mutations go through the cart Server Actions |
  | `orders/{orderId}` | Owner-only, scoped to `resource.data.userId == request.auth.uid` (a customer can read her own orders; admin listing/search still goes through the Admin SDK, which is unaffected by this rule) | Denied — order creation/status changes are exclusively server-side |
  | `guestCarts/{guestCartId}`, `counters/*`, `stats/summary` | Denied — no legitimate client-side reason to read these directly (guest cart access is mediated entirely by the server via the signed cookie; counters/stats are internal) | Denied |

  Firebase Storage Security Rules (§11) are the one place client-side **writes** are intentionally
  allowed, scoped narrowly to `products/**`, gated on the `ADMIN` custom claim, and further
  restricted by content-type and size checks.

  **This table intentionally does not change how the application itself reads data** — Server
  Components and Server Actions still read exclusively via the Admin SDK, as documented in §2, for
  consistency and testability. The public/owner-scoped read rules above exist as a defense-in-depth
  backstop and as a documented extensibility seam (e.g., a future real-time cart-sync-across-tabs
  UI could read directly via the client SDK without a rules change), not as an active read path
  this plan's UI relies on today.

  **Reminder carried through every layer of this plan**: the Firebase Admin SDK runs in a trusted
  service-account context and **bypasses Firestore Security Rules entirely** — rules constrain
  only the client SDK. Server-side authorization (the `ADMIN`/`CUSTOMER` claim check, §9) and
  server-side validation (Zod, Constitution Principle 13) are therefore not optional
  "nice-to-haves" layered on top of rules; they are the actual enforcement mechanism for every
  Admin-SDK code path, and rules alone would provide zero protection against a bug in that
  server-side code.
- **Rationale**: This is a genuinely new artifact required by the Firebase migration (MongoDB has
  no equivalent concept, since a MongoDB deployment is never reachable directly from a browser in
  the first place). Scoping reads per collection (public catalog / owner-only personal data /
  fully denied internal data) rather than a single blanket deny-all is the least-privilege
  reading of "public catalog reads where appropriate, authenticated customer profile access,
  wishlist access, customer-specific data, administrative data" — each category gets the
  narrowest rule that matches its actual sensitivity, while every write path stays exclusively
  server-side regardless of what the read rules allow.
- **Alternatives considered**: A single default-deny-everything rule set for all collections
  (viable, simpler to write, and still technically "least privilege" for a system that never
  issues client reads) — revised away from in this pass specifically because the brief asked for
  differentiated rules per data-sensitivity category rather than one blanket rule, and the
  per-collection table above costs nothing extra at runtime while being a more accurate, more
  auditable expression of actual data sensitivity.

## 23. Progressive Web App — manifest & platform metadata (new — spec FR-053–FR-056)

- **Decision**: The web app manifest is generated by Next.js App Router's built-in metadata-route
  convention, `app/manifest.ts` (returns a `MetadataRoute.Manifest` object, served at
  `/manifest.webmanifest`) — no extra dependency is needed for the manifest itself. It declares:
  `name: "ELORA JEWELLERY"`, a `short_name` (e.g., "ELORA"), a `description`, `start_url: "/"`,
  `scope: "/"`, `display: "standalone"`, `theme_color` and `background_color` set to specific
  values from the burgundy/cream design tokens (research.md §19 — e.g., `--brand-burgundy` for
  `theme_color`, `--brand-cream` for `background_color`), and the icon set from §23a. Complementary
  per-platform metadata is set via Next.js's `metadata`/`viewport` exports in the root layout:
  `appleWebApp: { capable: true, statusBarStyle: "default"/"black-translucent" as fits the
  burgundy theme, title: "ELORA JEWELLERY" }` for iOS/iPadOS home-screen launch behavior, and a
  `<meta name="theme-color">` (Chromium/Android/Windows) reflecting the same burgundy value so the
  OS/browser chrome (where still shown) and any installed-app title bar tint match the brand.
- **Rationale**: Directed by user (valid manifest with the listed fields, platform metadata for
  iOS/iPadOS/Android/Windows/macOS). Using Next.js's native metadata-route support keeps this
  entirely within the existing framework (no new runtime dependency), and centralizing the
  theme/background colors as references to the same design tokens used everywhere else (rather
  than separate hardcoded values) guarantees the manifest can never drift from the approved
  Burgundy + Gold + Cream/Ivory palette if that palette is ever revised again (the same rationale
  as the semantic token system itself, research.md §19).
- **Alternatives considered**: A static `public/manifest.json` file (viable, but the App Router
  metadata-route convention is preferred since it's framework-idiomatic, type-checked, and can
  reference the same TypeScript design-token constants the rest of the app uses rather than a
  hand-duplicated JSON color value).

## 23a. PWA icon strategy (new — spec FR-055, official-logo-only)

- **Decision**: All installed-app iconography is derived from the single official ELORA JEWELLERY
  logo asset (research.md §20) — never a separate generated mark. Required variants, all generated
  once from that source asset and stored under `public/icons/`:
  - Standard icons: 192×192 and 512×512 PNG (the two sizes required by the installability
    criteria on Chromium-based browsers/Android).
  - A **maskable** 512×512 variant (`purpose: "maskable"` in the manifest's `icons` array): the
    logo is placed within the maskable "safe zone" (roughly the center 80% of the canvas, per the
    W3C maskable-icon guidance) with the official brand cream/burgundy as the canvas background —
    this adapts only the surrounding canvas/padding, never the logo artwork itself, satisfying the
    explicit "preserve the official logo, adapt only the canvas" requirement.
  - Apple Touch Icon: 180×180 PNG at `public/icons/apple-touch-icon.png`, referenced via
    `app/apple-icon.png` (Next.js App Router icon convention) or an explicit `<link rel="apple-
    touch-icon">` in the root layout — iOS/iPadOS does not read the web manifest's icon list for
    home-screen icons, so this dedicated tag is required in addition to the manifest.
  - Favicon/browser icons: a multi-resolution `favicon.ico` plus a 32×32/16×16 PNG fallback via
    Next.js's `app/icon.png` convention, and an SVG favicon variant where the logo's vector source
    allows one (sharpest at any size, smallest file).
- **Rationale**: Directed by user ("appropriate standard and maskable icon sizes," "Apple Touch
  Icon," "favicon/browser icons," "do not generate or substitute a different logo," "adapt only
  the icon canvas"). Documenting the exact required variants here means implementation has a
  concrete checklist rather than discovering platform icon requirements ad hoc.
- **Alternatives considered**: Relying on the manifest's icon list alone for iOS (rejected — iOS
  Safari does not use the manifest for home-screen icons at all; the Apple Touch Icon tag/file is
  mandatory for a correct iOS icon, not optional polish).

## 24. Service worker & caching strategy (new — spec FR-061/FR-062, security-critical)

- **Decision**: A production service worker is generated via **Serwist** (the actively-maintained,
  App-Router-compatible successor to `next-pwa`, itself built on Workbox), configured with an
  explicit **allowlist** approach rather than a broad catch-all cache:
  - **Precached** (build-time, versioned): the static application shell (JS/CSS bundles Next.js
    already content-hashes), the official brand/icon assets (`public/brand/`, `public/icons/`),
    self-hosted font files (`next/font` output), and the dedicated `/offline` fallback route
    (§25).
  - **Runtime-cached, stale-while-revalidate, short-lived**: genuinely static/public marketing
    content only — the About page's static text/imagery and similar non-commerce content — never
    a page that renders live pricing/stock/cart/account data.
  - **Never intercepted or cached, always network** (explicit exclusions in the service worker's
    routing config, not just "we happened not to add a rule"): every Server Action invocation (all
    POST requests — the Cache API cannot cache non-GET requests even accidentally, but the
    exclusion is still made explicit for clarity), every Route Handler under `/api/**`, and every
    page whose content depends on live Firestore data — shop/category listings, product detail,
    cart, checkout, order confirmation, account/order-history, and the entire `/admin/**` surface.
    These routes are served fresh from the network on every request, exactly as in the
    non-installed browsing experience; if the network is unavailable, the navigation fallback
    (§25) is shown instead of a stale cached copy of commerce data.
  - **Cache versioning**: the service worker's cache name embeds the current build/version
    identifier; on activation, any cache from a previous version is deleted, so a redeployed
    price/stock change is never masked by an old asset cache surviving past its deploy.
  - **Disabled in local development**: Serwist's service worker registration is disabled when
    running `next dev`, so a developer's local iteration is never affected by a stale cache; PWA
    behavior (including caching) is only active in a production build (`next build && next
    start`) or an actual deployment, which is also how it must be validated (quickstart.md).
- **Rationale**: Directly satisfies the brief's explicit, security-critical instruction: caching
  may only ever cover safe static assets, and authoritative commerce data (prices, stock, Sold
  Out, cart validation, checkout totals, orders, customer/admin data) must always go through the
  live Firebase/server-side path (Constitution Principles 7, 9, 10, 15). An allowlist (only
  explicitly-listed safe things are cached) rather than a denylist (cache everything except a
  list of exclusions) is the safer default for a commerce app — a new page added later is
  network-only by default until someone deliberately opts it into caching, rather than silently
  becoming cacheable by omission.
- **Alternatives considered**: `next-pwa` (rejected — effectively unmaintained and has known
  compatibility gaps with the App Router this project already commits to, research.md §1);
  a hand-written service worker with no Workbox/Serwist tooling (rejected — reimplementing cache
  versioning, precache manifest generation, and routing strategies by hand is significant
  unnecessary risk for a security-sensitive component when a well-tested library does it
  correctly); a broad "cache everything, exclude known-sensitive paths" denylist strategy
  (rejected — precisely the safer-by-default reasoning above argues against it for a store where
  a caching bug could show stale prices or stock).

## 25. Offline fallback experience (new — spec FR-061)

- **Decision**: A dedicated, statically-rendered `/offline` route — branded with the ELORA
  Burgundy + Gold + Cream identity (research.md §19), the official logo, and a clear message
  ("You're offline — reconnect to continue shopping") — is precached by the service worker (§24)
  and configured as Serwist's navigation fallback: when a navigation request fails due to no
  connectivity, the browser shows this page instead of the platform's generic offline error.
  Safe static content that was already precached (brand assets, shell) can still render around
  this message; nothing that requires live data is shown.
- **Rationale**: Directed by user ("professional ELORA-branded offline/fallback experience,"
  "clearly communicate when live commerce operations require connectivity"). A dedicated
  precached route is the standard Workbox/Serwist pattern for a reliable offline fallback (it
  must itself be available offline, so it has to be precached, not fetched on demand).

## 26. Install prompt UX & platform detection (new — spec FR-058–FR-060)

- **Decision**: A small client-side `InstallPrompt` component (`components/pwa/InstallPrompt.tsx`)
  listens for the `beforeinstallprompt` event (fired by Chromium-based browsers — Chrome/Edge on
  Android, Windows, and macOS — when the app is installable and hasn't been installed yet),
  stores the deferred event, and renders the "Install ELORA JEWELLERY App" call-to-action only
  once that event has fired — never a button that does nothing if the platform never offers the
  capability. Installed-state and platform are detected via
  `window.matchMedia('(display-mode: standalone)')` (covers Chromium/Windows/macOS/Android once
  installed) and `navigator.standalone` (the iOS-specific equivalent); if either indicates the app
  is already running standalone, no install UI is shown at all. On iOS/iPadOS Safari — which does
  not fire `beforeinstallprompt` — user-agent/platform detection instead renders a small,
  dismissible instructional panel ("Tap the Share icon, then 'Add to Home Screen'") rather than a
  non-functional install button, directly per spec FR-059. A dismissal (either platform's prompt)
  is recorded in `localStorage` with a timestamp, and the prompt is not shown again for a cooldown
  period (e.g., 14 days) — satisfying "avoid repeatedly showing installation prompts" without
  permanently hiding it the moment a shopper closes it once.
- **Rationale**: Directed by user (unobtrusive install option; accurate manual instructions on
  iOS; suppress when already installed/unsupported/recently dismissed). `beforeinstallprompt` and
  `display-mode: standalone`/`navigator.standalone` are the standard, documented browser APIs for
  exactly this purpose — this is not custom detection logic invented for this plan.
- **Alternatives considered**: Showing a generic "Add to your home screen" message on every
  platform regardless of actual capability (rejected — the brief explicitly requires the UI to
  "gracefully adapt based on installation capability," and a one-size message would be actively
  wrong advice on platforms with a real one-tap install button, or falsely imply one-tap install
  exists on iOS).

## 27. PWA testing strategy (extends §14 — spec "TESTING")

- **Decision**: In addition to the existing Vitest/Playwright/Emulator-Suite strategy (§14),
  PWA-specific coverage is added at two layers:
  - **Playwright**: a manifest-validity check (fetches `/manifest.webmanifest`, asserts required
    fields and the burgundy/cream theme/background colors); a service-worker-registration check
    (confirms `navigator.serviceWorker` registers successfully in a browser context that supports
    it); an offline-fallback check (Playwright's `context.setOffline(true)`, navigate, assert the
    branded `/offline` page renders); an install-prompt-visibility check (simulates
    `beforeinstallprompt` in a Chromium context, asserts the install CTA appears; asserts it does
    **not** appear when `display-mode: standalone` is simulated); a standalone-mode responsive
    check (re-runs the mobile/tablet/desktop responsive pass, research.md §18a, with
    `display-mode: standalone` emulated); and — the security-critical case — a check that, after
    service worker registration, a live product page still reflects a stock/price change made
    directly in Firestore between two page loads (proving the page was served fresh, not from a
    stale cache).
  - **Lighthouse** (via `lighthouse-ci`/`@lhci/cli`, run in CI against a built preview
    deployment): asserts the PWA-related audit category (installability, manifest validity,
    service worker presence, themed splash screen/icons) passes, as an independent cross-check
    beyond the hand-written Playwright assertions above.
- **Rationale**: Directed by user ("extend the testing strategy," "Lighthouse/PWA-related checks
  ... in addition to the existing Playwright testing strategy"), and Constitution Principle 19
  (testing proportional to business risk) — the stale-cache-showing-wrong-price scenario is
  exactly the kind of subtle regression a security-sensitive caching layer can introduce silently,
  so it gets an explicit, standing test rather than being left to manual spot-checking.
- **Alternatives considered**: Lighthouse only, no Playwright PWA coverage (rejected — Lighthouse
  audits the manifest/service-worker's *presence* and basic correctness well, but does not verify
  this app's specific business-critical guarantee that authoritative data is never served stale;
  that needs a hand-written functional test).

## 28. Centralized Instagram/WhatsApp configuration (new — spec FR-006a/FR-006b)

- **Decision**: One typed config module, `lib/config/social.ts`, exports a single
  `getSocialConfig()` reading three environment variables — `NEXT_PUBLIC_INSTAGRAM_URL`,
  `NEXT_PUBLIC_WHATSAPP_PHONE` (E.164 format, e.g. `+15551234567`), and
  `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE` (optional) — and returns
  `{ instagramUrl: string | null, whatsappPhone: string | null, whatsappDefaultMessage: string }`.
  Every Instagram/WhatsApp control anywhere in the app (`Navbar`, `Footer`, `FloatingWhatsApp`)
  imports and calls this single function — none of them reads an env var directly or holds its
  own copy of a URL/number. `NEXT_PUBLIC_*` is required (not a server-only var) because these links
  are rendered/clicked entirely client-side (an `<a href>`/`window.open`, not a server round-trip)
  and carry no secret — the same reasoning already applied to the Firebase client config
  (research.md §2). Two small pure helpers live alongside it: `buildInstagramHref()` (returns the
  configured URL unmodified — Instagram's own universal link already handles app-vs-browser
  handoff, §29) and `buildWhatsAppHref(message?: string)` (returns
  `https://wa.me/<digitsOnlyPhone>?text=<encodeURIComponent(message ?? defaultMessage)>` when a
  phone is configured, `null` otherwise).
- **Rationale**: Directed by user — "centralized configuration," "do not scatter these values
  throughout multiple UI components," "the store owner must be able to configure" these three
  values. A single config module with a single read function is the smallest structure that
  makes "every consumer reads from one place" structurally true rather than a convention someone
  could accidentally violate later (Constitution Principle 11). `NEXT_PUBLIC_*`-prefixed env vars
  are the Next.js-idiomatic way to expose a non-secret value to client components without an extra
  Server Action round-trip just to fetch a link.
- **Alternatives considered**: Storing these values in Firestore (e.g., a `settings/social`
  document editable from the admin panel) instead of environment variables (a reasonable future
  enhancement — noted as such — but not required here: the brief asks for "centralized
  configuration/environment settings," and env vars satisfy that directly with zero new
  admin-surface or Firestore-document work; if the store owner later wants to self-serve edit
  these without a redeploy, migrating `getSocialConfig()`'s implementation to read Firestore
  instead of `process.env` is a localized, single-file change precisely because every consumer
  already goes through that one function).

## 29. Instagram/WhatsApp link behavior — app handoff, safety, PWA standalone (spec FR-006c/FR-006d/FR-006f)

- **Decision**: Both links render as plain anchor tags (`<a href={...} target="_blank" rel="noopener
  noreferrer">`), not custom JavaScript click handlers — this is deliberate:
  - **Instagram**: `href` is the configured profile URL (e.g.,
    `https://www.instagram.com/elorajewellery`). Instagram's own iOS/Android apps register as the
    handler for `instagram.com` universal/app links at the OS level, so a plain anchor already
    "allows the Instagram app to handle the link when available, otherwise open in the browser" —
    exactly the required behavior — with no custom user-agent sniffing or deep-link scheme needed.
  - **WhatsApp**: `href` is a `https://wa.me/<phone>?text=<message>` link (the officially
    documented WhatsApp "click to chat" URL format). On a mobile device with WhatsApp installed,
    `wa.me` redirects into the WhatsApp app with the conversation and pre-filled message open; on
    desktop, it redirects to WhatsApp Web (or prompts to open the WhatsApp desktop app if
    installed) — satisfying "on mobile, open WhatsApp when supported; on desktop, use the
    appropriate WhatsApp Web experience" without any platform-detection code, because `wa.me`
    itself handles that routing.
  - **Safety**: `rel="noopener noreferrer"` on both — the opened destination gets no `window.opener`
    reference back into the ELORA app (preventing a tab-nabbing-style issue) and no referrer
    leakage — satisfying "open external links safely."
  - **PWA standalone mode**: `target="_blank"` on an external-domain link from an installed,
    standalone-display-mode PWA hands off to the platform's normal external-link behavior (opening
    the destination app or the system browser) without navigating the installed app's own window
    away from the store — the installed app's standalone context is left running, satisfying "do
    not break standalone PWA navigation when opening external social/contact destinations."
- **Rationale**: Directed by user (app handoff where available, safe external links, correct PWA
  standalone behavior). Using the web-standard mechanisms each platform already provides
  (universal links, `wa.me`, `rel="noopener noreferrer"`, `target="_blank"`) means this behavior
  works correctly with zero custom platform-detection code to write, test, or maintain — the
  platforms already solve exactly this problem for any web link shaped this way.
- **Alternatives considered**: Custom user-agent sniffing to construct a native
  `instagram://` / `whatsapp://` deep-link scheme with a JS-based fallback timer to the web URL
  (rejected — this pattern is fragile across OS/browser versions, harder to test, and provides no
  behavioral improvement over the plain-anchor approach above, which the platforms already handle
  correctly).

## 30. Floating WhatsApp button — placement & non-interference (spec FR-006e)

- **Decision**: A single `FloatingWhatsApp` client component, rendered once from the storefront
  root layout (so it's not duplicated per page), fixed-positioned in a corner that keeps it clear
  of the app's other fixed/sticky elements at every breakpoint: it coordinates its own vertical
  offset with the mobile sticky Add-to-Cart bar (product detail pages) and the PWA install
  banner/cookie notice (§26) — those elements register their presence via a small shared
  `useReservedViewportInsets()` hook (or equivalent CSS custom-property offset) so the floating
  button shifts up rather than overlapping when one of them is visible, rather than both being
  independently hardcoded to guess safe positions. It is hidden entirely on the pages/steps where
  its presence would risk covering a primary action it must never obstruct per spec FR-006e (e.g.,
  it does not render inside the checkout form's active step). Sizing follows the same
  touch-target minimum used everywhere else (research.md §18a).
- **Rationale**: Directed by user — "must not cover important content," an explicit list of
  actions it must never interfere with, "remain touch-friendly," "work on mobile, tablet, laptop,
  desktop," "work when launched as an installed PWA." A single shared coordination mechanism
  (rather than each fixed element independently guessing pixel offsets) is what actually
  guarantees non-overlap as new fixed UI is added later, rather than relying on manual tuning that
  can silently break.
- **Alternatives considered**: A static, always-same-position floating button with no coordination
  logic (rejected — cannot guarantee it won't overlap the mobile Add-to-Cart bar or an install
  banner when both happen to be visible at once, which is exactly the failure mode the brief
  explicitly warns against).

## 31. WhatsApp-brand-consistent iconography (spec FR-006g — no bright WhatsApp green)

- **Decision**: The WhatsApp icon/action across all three placements (navbar, footer, floating
  button) uses the recognizable WhatsApp glyph (the speech-bubble/handset mark) rendered in the
  ELORA design tokens — typically cream/gold on a burgundy fill (or the inverse, burgundy-on-gold
  for the floating button's more prominent treatment) — rather than the platform's standard
  bright green (`research.md` §19's `--brand-gold`/`--brand-burgundy`/`--brand-cream` tokens,
  never a new one-off green token). The glyph shape alone remains standard/recognizable — only the
  color changes — so the action is still identifiable as "WhatsApp" at a glance despite the
  different palette, satisfying "remain understandable even when represented primarily by icons."
- **Rationale**: Directed by user explicitly ("do not use the standard bright WhatsApp green if it
  conflicts with the ELORA visual identity," "keep the interface consistent with Burgundy, Gold,
  Cream while still making the WhatsApp action recognizable") and Constitution Principle 2. Using
  the existing semantic tokens (rather than introducing a new color just for this icon) keeps the
  "no scattered arbitrary color values" guarantee from research.md §19 intact.
- **Alternatives considered**: The standard WhatsApp green (rejected — explicitly called out by
  the brief as a potential clash with the burgundy/gold/cream identity); a fully generic
  "message"/"chat" icon with no WhatsApp branding at all (rejected — the brief requires the action
  to be "recognizable as a WhatsApp contact action," which a generic chat icon would not
  guarantee).

## 32. Bilingual routing & i18n framework (new — spec FR-066–FR-085)

- **Decision**: **next-intl** (the App-Router-first, RSC-compatible i18n library) provides
  locale-prefixed routing: every existing storefront route moves under a dynamic `[locale]`
  segment — `app/[locale]/(storefront)/shop/...`, `app/[locale]/(storefront)/shop/category/
  [categorySlug]/...`, etc. — so every page has a real, distinct, crawlable URL per language
  (`/en/shop/category/bracelets`, `/ar/shop/category/bracelets`). A `middleware.ts` rule (layered
  onto the existing admin-guard middleware, research.md §9) detects the shopper's preferred locale
  (from the `NEXT_LOCALE` cookie if set, else the `Accept-Language` header, else the default `en`)
  and redirects an un-prefixed request to the correct `/en/...` or `/ar/...` URL. The **Admin
  Dashboard is intentionally not locale-prefixed** (`app/admin/...` stays exactly where it is) —
  it is an internal operational tool, not customer-facing, and the brief's bilingual requirement
  scopes to "the customer-facing website... relevant Admin Dashboard **content-management**
  interfaces" (i.e., the admin needs fields to *enter* Arabic content, not a translated admin UI
  chrome). Static UI strings (button labels, nav items, empty/loading/error states, etc.) live in
  next-intl JSON message catalogs, `messages/en.json` and `messages/ar.json`, loaded per-locale by
  the root `[locale]` layout.
- **Rationale**: Directed by user (full bilingual support, localized URL strategy, hreflang,
  sitemap handling, "must work with Next.js App Router and must not break existing product/
  category routing"). Locale-prefixed routing is the standard, SEO-correct pattern for this
  exact requirement (research.md §35 covers hreflang/sitemap specifics) — a single URL with a
  client-side-only language toggle cannot produce distinct indexable pages per language, which the
  brief explicitly requires ("avoid duplicate-content SEO problems," "localized URL strategy").
  next-intl is chosen over hand-rolling this because it is purpose-built for the App Router (RSC
  message loading, typed message keys, built-in `useTranslations`/`getTranslations` for Server and
  Client Components) and is the most widely adopted solution for exactly this Next.js version and
  routing pattern.
- **Alternatives considered**: A single URL per page with an in-memory/cookie-only language state
  and no route prefix (rejected — fails the explicit "localized URL strategy... hreflang...
  sitemap handling for localized pages" requirement, and search engines cannot index two language
  variants of the same URL as distinct pages); `next-i18next` (rejected — designed around the
  Pages Router's `getStaticProps`/`getServerSideProps` model, not a first-class fit for the App
  Router/Server Components this project already commits to); localizing the Admin Dashboard's own
  chrome too (rejected as unnecessary scope — the brief's own wording scopes admin bilingual work
  to *content management*, and localizing internal tooling adds real implementation cost for no
  approved requirement).

## 33. RTL/LTR implementation strategy (spec FR-069/FR-070)

- **Decision**: The root `app/[locale]/layout.tsx` sets `<html lang={locale} dir={locale === "ar"
  ? "rtl" : "ltr"}>` — the single source of truth both native CSS logical properties and screen
  readers rely on. Tailwind is used with **logical (direction-aware) spacing/positioning
  utilities** (`ms-*`/`me-*` margin-inline-start/end, `ps-*`/`pe-*` padding-inline-start/end,
  `start-*`/`end-*` positioning) throughout every component touched by this feature and, over
  time, retrofitted into existing components — rather than physical `ml-*`/`mr-*`/`left-*`/
  `right-*` utilities, which do not flip automatically under `dir="rtl"`. A small
  `<DirectionalIcon>` wrapper (in `components/ui/`) flips genuinely directional icons (chevrons,
  arrows, "next/back") via a `[dir="rtl"] &` CSS rule or an explicit `flip` prop; the official
  `<Logo />` (research.md §20) and all product/jewelry photography are explicitly **excluded**
  from any such flipping, per spec FR-070.
- **Rationale**: Directed by user ("proper RTL layout," "do NOT implement Arabic by translating
  text while leaving the interface incorrectly LTR," an explicit list of every surface RTL must
  cover, "do not incorrectly mirror... logo... imagery"). Logical properties are the
  standards-based mechanism the CSS/Tailwind ecosystem provides specifically so one component
  doesn't need two hand-written layout variants (LTR and RTL) — writing physical-direction
  utilities and manually overriding them per direction would be exactly the kind of scattered,
  error-prone duplication Constitution Principle 11 warns against.
- **Alternatives considered**: A wholesale mirrored RTL stylesheet maintained separately from the
  LTR one (rejected — doubles the styling surface to maintain and is the classic source of RTL
  bugs when the two drift out of sync); mirroring all imagery automatically via a blanket
  `transform: scaleX(-1)` under `dir="rtl"` (rejected — explicitly prohibited by the brief for the
  logo and product photography, and there is no correct default here since mirroring is only ever
  appropriate for a handful of directional icons, never brand/product imagery).

## 34. Bilingual content strategy: static UI strings vs. Firestore `LocalizedString` (spec FR-071, FR-074–FR-076)

- **Decision**: Two clearly separated content sources, matching data-model.md's split:
  1. **Static UI chrome** (navigation labels, buttons, empty/loading/error states, form labels,
     validation messages, PWA install/offline copy, footer link labels) lives in the next-intl
     JSON message catalogs (§32) — developer-maintained, part of the codebase, covered by normal
     code review.
  2. **Dynamic store content** (product name/description/material/option labels, category name/
     description, homepage showcase title/subtitle/CTA) lives in Firestore as `LocalizedString`
     fields (data-model.md) — store-owner/admin-maintained through the Admin Dashboard, never
     touched by a code deploy.
  Neither path uses automatic machine translation at render time, per the brief's explicit
  instruction; both `en` and `ar` values for dynamic content are whatever the admin enters. When a
  `LocalizedString.ar` is `null`/empty, every consumer falls back to `.en` (data-model.md, "Shared
  type: `LocalizedString`").
- **Rationale**: Directed by user (translate the complete storefront; product/category content
  admin-entered, not machine-translated; clearly distinguish Arabic/English admin fields). Keeping
  static chrome out of Firestore avoids an unnecessary database read for text that never changes
  per-store-owner-content-edit; keeping dynamic content out of the message catalogs avoids
  redeploying the application every time a product description changes — each content type uses
  the mechanism suited to how often and by whom it changes.
- **Alternatives considered**: Storing everything (including static UI chrome) in Firestore for a
  "fully CMS-driven" experience (rejected as unnecessary scope — the brief does not ask for
  admin-editable navigation labels, and it would add a Firestore read plus admin-UI surface for
  content that is, in practice, developer-authored copy); storing dynamic content in the message
  catalogs instead of Firestore (rejected — message catalogs are static, deployed files; a
  catalog can't hold one entry per product, and editing it would require a code deploy for a
  routine content change, defeating spec FR-001d/FR-074's "maintainable without source-code
  edits" requirement).

## 35. Bilingual SEO: hreflang, canonical, sitemap (spec FR-082)

- **Decision**: Each localized page (`generateMetadata`, research.md §16) emits its own
  `<title>`/description in that locale, a `canonical` link pointing at its own locale-prefixed
  URL (never at the other language's URL — the two are genuinely distinct, indexable pages, not
  duplicates needing canonicalization to one), and `alternates.languages` entries
  (`hreflang="en"`, `hreflang="ar"`, and `hreflang="x-default"` pointing at the English version)
  linking the `en`/`ar` counterparts of the same underlying page. `app/sitemap.ts` (research.md
  §16) emits both locale variants of every URL (home, shop, every category page, every product
  page, about/contact/legal pages) as separate `<url>` entries connected via the sitemap's
  `xhtml:link rel="alternate" hreflang="..."` annotations. `app/robots.ts` is unaffected — both
  locale trees remain crawlable.
- **Rationale**: Directed by user ("plan localized page titles/meta descriptions/product/category/
  homepage metadata... canonical strategy... hreflang... sitemap handling for localized pages...
  avoid duplicate-content SEO problems"). `hreflang` + per-locale canonical is the standard,
  documented pattern search engines use to understand that `/en/shop/category/rings` and
  `/ar/shop/category/rings` are language variants of one logical page rather than duplicate or
  unrelated content.
- **Alternatives considered**: A single canonical URL for both languages (e.g., always pointing at
  the English version) — rejected, since that would tell search engines the Arabic page is
  non-canonical duplicate content and suppress it from Arabic-language search results entirely,
  directly undermining the point of offering Arabic in the first place.

## 36. Language persistence (spec FR-068)

- **Decision**: next-intl's routing middleware (§32) sets the `NEXT_LOCALE` cookie (`httpOnly:
  false` so client navigation can read it too, `SameSite=Lax`, long-lived) whenever a shopper
  visits a locale-prefixed URL — this is the same mechanism that redirects an un-prefixed request
  to the right locale on a later visit. No Firestore field is required for this (a registered
  customer's language preference is a browser/device-scoped convenience, not account data that
  needs to follow her to a different device — consistent with how most bilingual e-commerce sites
  treat language choice). Because the installed PWA (research.md §23–§27) is served from the same
  origin and the cookie is a normal HTTP cookie, the preference persists in installed/standalone
  mode exactly the same way it does in the browser, satisfying spec FR-068's "installed PWA mode
  where appropriate" without any PWA-specific code.
- **Rationale**: Directed by user ("persist the selected preference... after refresh... across
  relevant sessions... in installed PWA mode where appropriate," "do not ask the customer to
  select a language again on every page"). A cookie is the simplest mechanism that satisfies every
  listed persistence point without adding a new Firestore write path or `users/{uid}` field for a
  UI preference.
- **Alternatives considered**: Storing `preferredLocale` on the `User` document (data-model.md)
  (rejected as unnecessary for the approved requirement — it would only matter for a customer
  switching devices and expecting her language to follow her, which the brief does not ask for
  ("across relevant sessions" is satisfied by the persistent cookie already); noted here as a
  documented, easy future enhancement if ever requested, not a gap in the current scope).

## 37. WhatsApp greeting localization (spec FR-080 — extends research.md §28)

- **Decision**: `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE` (research.md §28) becomes two env vars,
  `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_EN` and `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_AR`
  (`_AR` optional — falls back to the English message if unset, same fallback pattern as every
  other `LocalizedString`). `getSocialConfig()`'s shape becomes
  `whatsappDefaultMessage: { en: string; ar: string | null }`, and `buildWhatsAppHref(locale,
  message?)` selects the greeting matching the shopper's current locale (falling back to `en`)
  when no explicit override message is passed.
- **Rationale**: Directed by user ("the configurable WhatsApp greeting should support
  localization... use the currently selected language when constructing the pre-filled greeting").
  Keeps the existing centralized-configuration guarantee (research.md §28 — one source, no
  scattered copies) while adding the second language as an equally-configurable, equally-optional
  value, consistent with how every other bilingual field in this revision treats Arabic as
  optional/nullable with an English fallback.
- **Alternatives considered**: A single greeting message translated at click-time via the UI
  message catalog instead of a configurable env var (rejected — the brief explicitly asks for the
  greeting itself, not just the surrounding UI chrome, to remain part of the store owner's
  configurable contact settings, consistent with FR-006a's "configurable... so the real store
  information can be added later").

## 38. Homepage category showcase content & imagery management (spec FR-001a–FR-001d)

- **Decision**: The `categoryShowcases` Firestore collection (data-model.md) holds each showcase's
  bilingual title/subtitle/CTA text and image references; **Firebase Storage**
  (`showcases/{showcaseId}/{imageId}`, mirroring the existing `products/{productId}/{imageId}`
  convention from research.md §11) holds the actual desktop/mobile image files, uploaded by an
  admin through the same **direct-to-Firebase-Storage** pattern already used for product images —
  Storage Security Rules restrict writes under `showcases/**` to the `ADMIN` custom claim, exactly
  like `products/**`. The homepage reads all four showcases (one per core category) via the
  `isActive ASC, displayOrder ASC` index (data-model.md) as a Server Component, alongside a live,
  category-scoped product query for each showcase's "Featured {Category}" strip (data-model.md,
  `categoryShowcases` "Relationships").
- **Rationale**: Directed by user ("maintainable without rewriting application code... Firestore-
  backed or centralized managed-content strategy... Firebase Storage for uploaded category
  showcase imagery... admin should have a maintainable way to update... without requiring
  source-code edits"). Reusing the exact product-image pattern (research.md §11) for showcase
  images means no new upload/security-rule mechanism has to be designed — the same `ImageUploader`
  component, signing-free direct-upload approach, and admin-only Storage Rule shape apply with
  only the storage path and the consuming Firestore collection changed.
- **Alternatives considered**: Hardcoding the four showcases' images/copy as static imports in the
  codebase (rejected — explicitly disallowed by the brief: "must be maintainable without
  rewriting application code"); a generic un-typed "site settings" Firestore document holding
  arbitrary homepage content (rejected — a dedicated, schema-validated `categoryShowcases`
  collection is more consistent with how every other admin-managed entity in this project is
  modeled, and keeps Zod validation meaningful).

## 39. Bilingual testing strategy (extends §14/§27 — spec "TESTING")

- **Decision**: Playwright test coverage is extended along two axes that multiply across the
  existing critical-flow tests rather than replacing them: **language** (English/LTR run,
  Arabic/RTL run of the same guest-purchase and checkout flows) and **the new homepage showcase
  content** (each of the four showcases renders, links correctly, and its featured-products strip
  is category-pure and Sold-Out-aware). Locale is set via the locale-prefixed URL itself
  (`/ar/...` vs `/en/...`, research.md §32), so existing Playwright specs are parameterized to run
  once per locale rather than needing entirely separate test files. A dedicated RTL visual/DOM
  check asserts `document.documentElement.dir === "rtl"` and that a representative directional
  icon is mirrored, on the Arabic run only.
- **Rationale**: Directed by user's explicit test list (English/Arabic storefront, language
  switching/persistence/refresh/PWA persistence, per-language mobile/desktop layout, Arabic/
  English checkout, localized validation/errors/SOLD OUT/order statuses, product/category
  translation rendering, bilingual admin editing, localized WhatsApp greeting, localized SEO
  metadata, RTL regression; plus the showcase-specific list). Parameterizing existing specs by
  locale (rather than duplicating every spec file) keeps the suite maintainable as flows evolve —
  a checkout behavior change only needs fixing in one spec, which then runs correctly in both
  languages, rather than two specs that can silently drift apart.
- **Alternatives considered**: Fully separate Arabic-only and English-only test suites (rejected —
  doubles the maintenance surface for every future flow change with no benefit over
  parameterization); testing only English, treating Arabic as "the same code path, trust it"
  (rejected — RTL layout and bilingual data are exactly the kind of thing that regresses silently
  without a standing check, per Constitution Principle 19).

## 40. Delivery-region model: two fixed regions, open-ended locations (spec FR-086, FR-089)

- **Decision**: `deliveryRegions` holds exactly two documents with **deterministic, hand-chosen
  document IDs** — `west-bank` and `inside-1948` — rather than Firestore auto-IDs. The two-region
  business rule ("must be limited to... do NOT show a worldwide country selector") is enforced
  structurally: the selector UI, the checkout Zod schema, and the order-creation transaction all
  validate `regionId` against this fixed two-value set (a literal union type,
  `"west-bank" | "inside-1948"`, not an open Firestore query), so there is no code path that could
  ever present or accept a third region. `deliveryLocations` (cities/areas within a region), by
  contrast, is a genuinely open-ended, admin-managed collection — same shape and management
  pattern as `categories` (research.md §"Categories" in data-model.md) — since the brief is
  explicit that the *city/area* list must be maintainable without a code change, while the
  *region* list must not silently grow.
- **Rationale**: Directed by user (two named regions only, no worldwide selector, but a
  maintainable, admin-configurable city/area list). Mirroring the existing `categories`
  admin-management pattern (research.md, data-model.md `categories`) for locations reuses an
  already-approved, already-understood mechanism (bilingual `LocalizedString` name,
  `isActive`/`displayOrder`, admin CRUD via a Server Action) rather than inventing a new one.
- **Alternatives considered**: Making `deliveryRegions` itself an open admin-editable collection
  like `deliveryLocations` (rejected — the brief is explicit and repeated: "must be limited to,"
  "do NOT show a worldwide country selector" — treating the region set as freely admin-extensible
  would make it trivial to accidentally turn this into exactly the worldwide selector the brief
  prohibits); a single flat `deliveryLocations` collection with a `region` string field and no
  `deliveryRegions` collection at all (rejected — the region names/order are still customer-facing
  bilingual content worth managing consistently with everything else, and a tiny two-document
  collection costs nothing extra).

## 41. Location selector UI & persistence (spec FR-087, FR-090, research.md §36 extended)

- **Decision**: A `LocationSelector` client component, opened from a Navbar/Header control,
  renders an accessible modal on desktop and a bottom-sheet/full-height drawer on mobile
  (`components/ui/Dialog` primitive, research.md §19, already responsive-capable) — two-step
  flow: pick a region, then search/pick a city within it (or search across the currently selected
  region only, per spec FR-088). Persistence mirrors the existing language-cookie pattern
  (research.md §36): an `elora_location` cookie (non-httpOnly, `SameSite=Lax`, long-lived) stores
  the selected `regionId`/`locationId` for guests, read by Server Components to prefill checkout;
  for a signed-in customer, selecting a location also updates `users/{uid}.profile.address.
  regionId`/`locationId` (data-model.md) via the existing `updateProfileAction` pattern, so her
  preference follows her account the same way her profile already does — no new persistence
  mechanism is introduced beyond what research.md §36 already established for language.
- **Rationale**: Directed by user (accessible from Navbar, premium modal/drawer feel, remembers
  selection, changeable later, guest-safe persistence, optional profile association for
  registered customers). Reusing the cookie pattern from §36 avoids a second, parallel
  preference-persistence mechanism; reusing `Dialog` avoids a second modal implementation.
- **Alternatives considered**: `localStorage`-only persistence (rejected as the sole mechanism —
  unlike a cookie, it isn't visible to the Server Component that renders the checkout page's
  prefilled value on first load, forcing an extra client-side round trip); a dedicated
  `preferredLocationId` field on `User` separate from `profile.address` (rejected — redundant with
  the address object already being the natural place this belongs, per data-model.md).

## 42. Checkout integration & server-side revalidation (spec FR-091–FR-093)

- **Decision**: The checkout Zod schema (`checkoutSchema`, research.md, `lib/validation/
  checkout.schema.ts`) gains required `regionId`/`locationId` fields (replacing the previous
  free-text `city` field — data-model.md `orders.delivery`). The checkout page prefills them from
  the persisted selection (§41) but the shopper can change them there via the same
  `LocationSelector` (or a lighter inline variant). Inside the existing order-creation transaction
  (research.md §3), immediately alongside the stock/price re-validation, the transaction reads the
  authoritative `deliveryLocations/{locationId}` document and rejects the whole transaction if it
  doesn't exist, its `regionId` doesn't match, or `isActive !== true` — returning a field-level
  error the checkout UI displays as a clear, localized "this area isn't currently supported"
  message rather than a generic failure.
- **Rationale**: Directed by user ("validate the selected delivery location server-side... before
  order creation," "do not create an order with an unsupported delivery location," "do not
  silently allow checkout" for an unsupported area) — this is the same authoritative-
  server-side-recheck principle already required for stock/pricing (spec FR-026), applied to
  delivery location, and folding it into the *same* transaction (rather than a separate
  pre-check) means there's no window between "location looked valid" and "order actually created"
  for it to become invalid.
- **Alternatives considered**: A separate, earlier validation Server Action called before
  `submitCheckoutAction` (rejected — introduces a check-then-act race identical in shape to the
  one stock validation already avoids by living inside the single order-creation transaction;
  keeping every authoritative check in one transaction is simpler and strictly safer).

## 43. Offline/PWA behavior for the location selector (spec FR-097, extends research.md §24)

- **Decision**: The selector's cookie-persisted selection and the `deliveryLocations` list used to
  populate it follow the same caching allowlist boundary already established in research.md §24:
  the *cookie value* (an opaque ID, not sensitive commerce data) may be read and displayed while
  offline exactly like the language cookie, but the `deliveryLocations`/`deliveryRegions` **data**
  itself is never part of the service worker's precache/runtime-cache allowlist — it is always a
  live Firestore read via a Server Component, and checkout's location revalidation (§42) always
  requires the network round-trip the existing offline-checkout-blocked behavior (spec FR-063)
  already guarantees. No new PWA mechanism is introduced.
- **Rationale**: Directed by user ("do not allow cached/offline location data to override
  authoritative checkout eligibility... final delivery support must be revalidated online before
  order creation"). This is a direct application of the existing, already-approved PWA caching
  boundary (research.md §24) to one more piece of commerce-adjacent data, not a new rule.

## 44. Bilingual location search (extends research.md §17a)

- **Decision**: `deliveryLocations.searchTerms` (data-model.md) follows the exact same pattern as
  `products.searchTerms` (research.md §17a) — lowercase tokens derived from both `name.en` and
  `name.ar` at write time, queried via `array-contains-any` scoped to the selected `regionId`. No
  new search mechanism is introduced.
- **Rationale**: Directed by user ("search must work in Arabic and English"). Reusing the
  already-approved bilingual-search pattern keeps the codebase consistent (Constitution Principle
  11) rather than introducing a second, differently-shaped search implementation for one more
  bilingual collection.

## 45. Excel export library & generation strategy (new — spec FR-099–FR-112)

- **Decision**: Use **ExcelJS** (`exceljs`, TypeScript-friendly, actively maintained) to generate
  real `.xlsx` (Office Open XML) files entirely server-side, inside a Route Handler, from data read
  via the Firebase Admin SDK at request time. For the Orders/Sales report types — the ones most
  likely to grow large as the store's order history accumulates — the handler uses ExcelJS's
  **streaming workbook writer** (`ExcelJS.stream.xlsx.WorkbookWriter`) over Firestore's cursor-
  based pagination (research.md §17), writing rows as they are read rather than materializing the
  entire dataset in memory before generating the file. Smaller, bounded report types (Products,
  Categories/Delivery Locations, SOLD OUT Products — all naturally capped by the store's actual
  catalog/location size) use the simpler in-memory `ExcelJS.Workbook` API. Every export is
  generated fresh on each request; nothing is cached or pre-generated, since Constitution
  Principle 7 requires every admin-facing figure to reflect live Firestore data.
- **Rationale**: ExcelJS produces a genuinely valid `.xlsx` file (not a CSV/HTML file wearing an
  `.xlsx` extension, spec FR-109), supports column headers/widths/number formats needed for a
  professional report, and its streaming writer directly addresses the "very large Orders/Sales
  export" edge case (spec Edge Cases) without introducing a background job queue or separate
  worker infrastructure — appropriate for this project's launch scale (plan.md "Scale/Scope": low
  hundreds of products, low thousands of orders/month), where even an unbounded Orders export
  comfortably fits a single Route Handler request/response cycle when streamed rather than
  buffered.
- **Alternatives considered**: `xlsx` (SheetJS community edition) — lacks a first-class streaming
  writer for large datasets and its community build has had past security-advisory history around
  parsing untrusted input (irrelevant here, since this feature never parses/imports a spreadsheet,
  but ExcelJS's more actively maintained release cadence was preferred regardless); a CSV export
  — rejected because the user explicitly asked for real `.xlsx` files with the formatting/multiple-
  report-type expectations a raw CSV can't express well (e.g., the Orders report's per-order,
  multi-line "products" detail); a background job/queue (e.g., generate the file async, notify the
  admin, store it in Firebase Storage for later download) — rejected as unnecessary complexity at
  this scale per Constitution Principle 20 ("incremental implementation," no speculative
  infrastructure); synchronous generation with a clear loading/progress indicator (spec FR-112)
  is simpler and sufficient.

## 46. Excel export access, routing, and no-import guarantee (new — spec FR-099–FR-112)

- **Decision**: Every export is served by a **Route Handler** (contracts/route-handlers.md), not a
  Server Action, because a Server Action cannot cleanly return a binary file with a
  `Content-Disposition: attachment` header for a browser-triggered download — this is exactly the
  "non-form client / conventional HTTP endpoint" case route-handlers.md already reserves Route
  Handlers for. Handlers live at `src/app/admin/api/export/[reportType]/route.ts` — inside the
  `/admin` segment (not locale-prefixed, research.md §32) — so `middleware.ts`'s existing
  `/admin/*` cookie-presence pre-filter (layer 1 of 3) already covers them "for free," and each
  handler additionally performs its own independent `requireAdmin()` check (layer 2 of 3, research
  .md §9) before touching Firestore or generating any file — a Route Handler is not wrapped by
  `admin/layout.tsx`'s guard (layouts don't wrap Route Handlers in the App Router), so this
  independent check is not optional. Report-specific server-validated filters (spec FR-108) are
  read from the request's query string and applied to the Firestore query itself, never used to
  post-filter an already-fetched full dataset. There is no corresponding upload/import endpoint
  anywhere in the application, and no code path reads an uploaded spreadsheet back into Firestore
  — the "no Excel import" requirement (spec FR-110) is satisfied structurally, by the simple
  absence of that capability, rather than by a runtime check that could be bypassed.
- **Rationale**: Reuses the existing three-layer authorization model and existing Route Handler
  convention rather than inventing a new transport or auth mechanism (Constitution Principle 11).
  Placing export routes under `/admin/api/**` rather than the general `/api/**` used by SEO/health
  endpoints keeps every admin-only HTTP surface physically grouped and covered by the same
  middleware pre-filter, reducing the chance a future admin-only Route Handler is added outside
  that pre-filter's matcher by mistake.
- **Alternatives considered**: A Server Action returning a base64-encoded file string for the
  client to decode and save — rejected as needlessly inflating response payload size (~33%
  overhead) and fighting against the platform's native file-download mechanics for no benefit;
  placing export routes under the general `/api/**` namespace — viable, but grouping them under
  `/admin/api/**` was preferred so they inherit the existing `/admin/*` middleware pre-filter
  automatically rather than needing their own matcher entry.

## 47. Special Offers data model & derivation (new — spec FR-113–FR-125)

- **Decision**: Extend `products/{productId}` (data-model.md) with four fields — `isOnSale`
  (boolean, admin-set), `salePrice` (integer minor units, nullable, required `< price` whenever
  set), `saleStartAt`/`saleEndAt` (nullable Timestamps). "Sale price" and the schedule are the only
  stored facts; the actual **offer status** — `DISABLED | SCHEDULED | ACTIVE | EXPIRED` — is never
  stored, always derived at read time from those four fields plus the current server time
  (`getOfferStatus(product, now)`), exactly mirroring the existing Sold Out derivation
  (`isSoldOut`, research.md/data-model.md "Sold Out derivation"). A second derived helper,
  `getEffectivePrice(product, now)`, returns `salePrice` only when the derived status is `ACTIVE`,
  otherwise `price` — this is the single function every price-displaying or price-charging code
  path calls, so it is structurally impossible for two surfaces to disagree about which price
  currently applies.
- **Rationale**: Directed by the same principle already established for Sold Out (Constitution
  Principle 10's spirit extended to pricing): a derived value can never drift out of sync with the
  facts it's derived from, whereas a separately-set "isCurrentlyOnSale" flag could be forgotten
  when a schedule boundary passes. Reusing the exact `isSoldOut` pattern (a small, pure,
  server-safe function reusable from both server code and Client Components) keeps the codebase
  consistent (Constitution Principle 11) rather than inventing a second derivation style.
- **Alternatives considered**: A scheduled Cloud Function that flips a stored `isOnSale` boolean at
  the exact start/end instant — rejected: this project deliberately has no serverless
  function/cron infrastructure beyond the Next.js app itself (plan.md's stack directive), and a
  purely time-derived read-time computation needs no such infrastructure at all, with zero
  propagation delay at the schedule boundary (a stored-and-flipped flag could lag by however often
  the function runs); a separate `offers/{offerId}` collection referencing a product — rejected as
  unnecessary indirection for a "one active offer per product" model (spec Assumptions) with no
  offer-specific fields beyond what fits naturally on the product itself.

## 48. Special Offers querying & Firestore query-shape limitation (new — spec FR-117)

- **Decision**: The homepage Special Offers section queries `products` filtered to
  `isOnSale == true AND availability == true`, ordered by `createdAt DESC` (reusing the existing
  `isOnSale ASC, availability ASC, createdAt DESC` composite index, the same pattern as
  `isNewArrival`/`isBestSeller`, data-model.md), then narrows the result to only those whose
  derived status (research.md §47) is actually `ACTIVE` in application code before rendering,
  capped to a small display count. This mirrors the existing, already-documented `searchTerms`
  query-shape workaround (research.md §17a) rather than introducing a new kind of exception.
- **Rationale**: Firestore permits range/inequality comparisons on at most one field per query
  (`saleStartAt <= now` and `saleEndAt >= now` are range comparisons on two *different* fields, so
  they cannot both be expressed as Firestore `where` clauses in the same query alongside the
  `isOnSale`/`availability` equality filters). Fetching the (small, `isOnSale`-scoped) candidate
  set and finishing the date-window check server-side, in the same request, is simple, correct, and
  entirely adequate at this project's launch scale (plan.md "Scale/Scope") — an admin is expected
  to have a handful of concurrently-enabled offers at most, not hundreds.
- **Alternatives considered**: Splitting `saleStartAt`/`saleEndAt` into a single derived
  `offerActiveFrom`/`offerActiveUntil` range pair recomputed on every admin save specifically to
  fit one Firestore range filter — rejected as needless duplication of the same two dates under a
  different name, adding a second place to keep in sync for zero real query-capability gain at this
  scale; denormalizing a boolean "currently active" flag maintained by a scheduled function —
  rejected for the same reason a Cloud Function was rejected in research.md §47.

## 49. Special Offers pricing consistency & authoritative re-validation (new — spec FR-118–FR-121)

- **Decision**: Every surface that displays a price for a product — `ProductCard`, `QuickView`,
  the product detail page, the Shop/category listing grids, the homepage sections, the cart, and
  checkout — calls the same `getEffectivePrice` (research.md §47) against a live-read `Product`,
  never a value cached from an earlier render or an earlier point in the shopper's session. The
  cart's server-side subtotal/total calculation (already established, Phase 6, spec "Price
  Security") and the order-creation transaction's server-side price recalculation (Phase 8) both
  call `getEffectivePrice` at their own read time — an offer that is removed or expires between a
  shopper adding an item to her cart and completing checkout is priced at whatever
  `getEffectivePrice` currently returns, never at a stale value, exactly like a stock or
  availability change already is (research.md §3, data-model.md "Stock integrity").
- **Rationale**: This is a direct, natural extension of the pricing-authority model this project
  already committed to for regular prices (Constitution Principle 9/10, spec FR-026) — a sale price
  is still just "the current authoritative price," so it is re-validated by exactly the same
  mechanism, not a parallel one.
- **Alternatives considered**: Snapshotting the effective price onto the `CartItem` at add-to-cart
  time and only re-validating it at checkout — rejected because it would let the *cart display*
  show a stale price between add-to-cart and checkout (spec FR-119 explicitly requires the cart
  view itself, not just the final order, to reflect the current price); this project already
  computes the cart's displayed subtotal/total live on every read (Phase 6) rather than storing it,
  so extending that same live computation to use `getEffectivePrice` costs nothing extra.
