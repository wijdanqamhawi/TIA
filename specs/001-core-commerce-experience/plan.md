# Implementation Plan: Core Commerce Experience

**Branch**: `001-core-commerce-experience` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-core-commerce-experience/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

**Revision note (2026-08-26)**: This plan was updated to replace the MongoDB/Mongoose data layer,
Auth.js/NextAuth authentication, and Cloudinary image storage with an all-Firebase stack (Cloud
Firestore, Firebase Authentication, Firebase Admin SDK, Firebase Storage), per an explicit stack
change. All architecture, routes, features, phases, and functional requirements are unchanged
except where a MongoDB/Auth.js/Cloudinary-specific detail required direct adaptation — each such
change is called out inline and detailed in `research.md`.

## Summary

Build the full ELORA JEWELLERY storefront and admin system as a single Next.js (App Router)
application: a mobile-first, luxury-branded customer journey (home → shop → product → cart →
guest-or-authenticated checkout with Cash on Delivery → order confirmation → account/order
history/wishlist) and a protected admin experience (products, orders, customers, dashboard
statistics) — all reading and writing one **Cloud Firestore** data layer via the **Firebase Admin
SDK**, with authentication via **Firebase Authentication**, product images via **Firebase
Storage**, server-computed pricing/inventory on every order, and a domain/service layer kept
separate from UI per the constitution's maintainability principle.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20+ (Next.js 15, App Router)

**Primary Dependencies**: Next.js, React, Tailwind CSS, `firebase` (client SDK, used only for the
Firebase Authentication sign-in/sign-up UI and direct-to-Storage admin image upload),
`firebase-admin` (server-side SDK for Firestore, Auth session verification, and Storage), Zod,
Vitest, Playwright, `serwist`/`@serwist/next` (production service worker generation for PWA
installability, research.md §24), `next-intl` (Arabic/English locale routing, message catalogs,
RTL/LTR support, research.md §32–§39), `exceljs` (server-only, admin-only `.xlsx` report
generation — including streaming output for large Orders/Sales exports — research.md §45–§46)

**Storage**: Cloud Firestore (Native mode), accessed only server-side via the Firebase Admin SDK;
Firebase Storage for product images; no separate database server or connection string to manage —
both are fully managed Firebase/Google Cloud services scoped to one Firebase project (see
`research.md` §2–3, §11)

**Testing**: Vitest (unit/integration, integration tests run against the Firebase Local Emulator
Suite), Playwright (E2E) — see `research.md` §14

**Target Platform**: Web, deployed to Vercel (Node.js runtime, since the Firebase Admin SDK
requires a Node.js — not Edge — runtime); responsive across iPhone, Android, tablet, laptop,
desktop; additionally installable as a Progressive Web App where the browser/platform supports it
(iPhone/iPad, Android phones/tablets, Windows, macOS, and other modern browsers) — the same
responsive Next.js application serves every mode, not a separate app (spec FR-053, research.md
§23–§27); fully bilingual (Arabic/English, RTL/LTR) via locale-prefixed routing (`/en/...`,
`/ar/...`) across the storefront and installed PWA — one application, two languages, never two
separate apps (spec FR-066–FR-085, research.md §32)

**Project Type**: Web application — single Next.js app (App Router) serving both the customer
storefront and the admin area from one codebase; no separate frontend/backend deployables

**Performance Goals**: Storefront listing/detail pages usable (interactive, correct data) within
normal broadband/4G expectations; product/category reads served by Firestore composite indexes;
catalog pages paginated via Firestore cursors rather than loading the full product set at once;
minimal client-side JS via Server Components by default

**Constraints**: All pricing/inventory/subtotal/total for an order MUST be recalculated
server-side at order-creation time — client-submitted totals are never trusted (spec FR-026,
Constitution Principle 9/10); admin authorization MUST be enforced server-side on every request,
independent of UI (Constitution Principle 6); the official ELORA logo asset MUST be used as-is,
never generated (Constitution Principle 2); order creation MUST be transaction-safe — satisfied by
a single Firestore transaction, which (unlike MongoDB) requires **no replica-set or special
cluster topology**; it works identically in every environment, including the local Firebase
Emulator Suite (research.md §3)

**Scale/Scope**: Initial launch scale for a single-brand jewelry storefront — expect low hundreds
of active products, low thousands of orders per month at launch; data model and indexing chosen
to not require rework at that scale, without over-engineering for scale not yet needed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status |
|---|---|---|---|
| 1 | Production-Ready E-Commerce | Single integrated Next.js app; storefront and admin share one live Firestore data layer via the Admin SDK (no mock screens) | **PASS** |
| 2 | Official Brand Identity | Logo stored once under `public/brand/`, referenced via shared `Logo` component; no generated logo; design tokens fixed to the required palette (research.md §19–20); every PWA icon variant (standard, maskable, Apple Touch Icon, favicon) is derived from that same single logo asset with only the surrounding canvas adapted, never the artwork (research.md §23a); the web app manifest's `theme_color`/`background_color` reference the same burgundy/cream tokens (research.md §23); Instagram/WhatsApp iconography reuses the same semantic tokens rather than the platform's default WhatsApp green (research.md §31); the official logo and product/jewelry photography are explicitly never mirrored under RTL (research.md §33), and every homepage category showcase (research.md §38) is built from ELORA's own imagery/copy, never another brand's assets (spec FR-001e) | **PASS** |
| 3 | Mobile-First Responsive UX | Tailwind's default mobile-first breakpoint scale mapped to the full requested device range — small/large smartphone, tablet, small/standard laptop, desktop, large desktop monitor (research.md §18a); concrete, testable rules per area: product grid column progression, admin data tables as responsive cards below `md`, cart/checkout stacked line items, image `sizes`/aspect-ratio constraints, touch-target minimums, and a page-level no-horizontal-overflow guarantee (spec FR-050–FR-050h); hamburger nav; every quickstart scenario re-run at mobile, tablet, and desktop widths, plus a pre-release manual device pass (research.md §14, quickstart.md). Responsive rules are verified in **both** Arabic/RTL and English/LTR (research.md §33, §39), and each homepage category showcase uses a distinct mobile image composition rather than a shrunk desktop banner (spec FR-001f) | **PASS** |
| 4 | Simple Customer Journey | Routes map 1:1 to Home → Shop → Product → Cart → Checkout → Order Confirmation, no extra mandatory steps (guest checkout supported) | **PASS** |
| 5 | Simple Admin Journey | `/admin` → Dashboard → Products/Orders/Customers, no extra surfaces | **PASS** |
| 6 | Secure Authentication and Authorization | Firebase Authentication owns credential storage/hashing entirely (app never touches a password or hash); every authenticated request is checked via Admin-SDK `verifySessionCookie`, never trusted from client state. Role lives as a Firebase **custom claim** (authoritative, embedded in the verified token) mirrored to `users/{uid}` for admin-panel querying only. Enforcement is three-layer: (1) `middleware.ts` does a cheap session-cookie *presence* pre-filter only, (2) every admin Server Action/Route Handler/`admin/layout.tsx` independently re-verifies the session and checks `role === "ADMIN"` via the Admin SDK — the actual authorization decision, (3) admin UI is hidden client-side as UX only. A normal customer manipulating client routes or calling an action directly still fails at layer 2. — research.md §8–9 | **PASS** |
| 7 | Real Data Persistence | Cloud Firestore is the sole, real, persistent store for every entity (users, products, categories, collections, carts, wishlists, orders, counters, stats, `deliveryRegions`, `deliveryLocations`) — all reads/writes go through the Admin SDK server-side; nothing in the storefront or admin renders from hardcoded data. `scripts/seed.ts` is explicitly dev/test-only and never runs as part of normal request handling. The PWA service worker's cache is explicitly **not** a data store for any of these entities — it is an allowlisted cache of static assets only, and every page showing product/cart/order/account/admin/delivery-location data is excluded from caching and always served from Firestore via the network (research.md §24, §43); a location cookie's opaque ID may be read offline, but the location data it refers to and its eligibility for checkout never are | **PASS** |
| 8 | Reliable Commerce State | Cart/wishlist are Firestore documents, not client/browser state: a guest's cart is `guestCarts/{guestCartId}` keyed by a signed httpOnly cookie, a registered customer's is `carts/{uid}`; both survive navigation and, for a registered customer, survive logout/login. A documented transactional merge (research.md §6) reconciles a guest cart into the account cart on sign-in, clamped to live stock, so nothing is silently lost or double-counted | **PASS** |
| 9 | Reliable Order Creation | Order creation is one Firestore **transaction** (research.md §3) that reads authoritative product data, verifies stock, **re-verifies the selected delivery region/location against live, active `deliveryLocations` data** (research.md §42, spec FR-092), computes pricing server-side, increments the order-number counter, writes the order document with every required field including a bilingual delivery-location snapshot (data-model.md), decrements stock, increments `salesCount`, updates the `stats/summary` counters (research.md §17b), and clears the cart — all-or-nothing, so a checkout can never leave a partially-recorded order, or one for an unsupported delivery area, the way an unguarded multi-step write could | **PASS** |
| 10 | Inventory Integrity | `stock >= 0` and `price > 0` are Zod-enforced before any write reaches Firestore (admin create/edit included, spec FR-036a); stock is re-validated at add-to-cart and again, authoritatively, inside the order-creation transaction immediately before it decrements — so a race between two checkouts for the last unit is resolved by the transaction, not by a stale client read, and `stock` can never go negative. "Sold Out" (spec FR-015a) is never a separately-set flag — it is always derived as `stock === 0` at read time (data-model.md), so it is structurally impossible for the Sold Out badge to disagree with the real stock number; a product automatically becomes non-purchasable the instant stock hits 0 and automatically becomes purchasable again the instant it's restocked, with no manual admin toggle either way. Cancellation restocks and decrements `salesCount` inside its own transaction, so stock and best-seller ranking never drift out of sync with reality | **PASS** |
| 11 | Maintainable Architecture | `lib/domain/*` (business logic, no Firebase/framework imports) stays separated from `actions/`/`app/api` (thin transport/validation wrappers) and `lib/firebase/*` (the only place Admin/client SDK calls are made); `lib/config/social.ts` is the single source every Instagram/WhatsApp control reads, so a real-value update or a palette/behavior change never requires touching more than one file (research.md §28); the shared `LocalizedString` shape (data-model.md) and the static/dynamic content split (research.md §34) keep bilingual text in exactly two well-defined places (message catalogs for UI chrome, Firestore for store content) rather than scattered per-component strings; the two-region delivery rule is enforced structurally by a fixed document-ID set rather than an open-ended admin list (research.md §40), while the city/area list within a region reuses the exact `categories` admin-management pattern rather than inventing a new one; Project Structure below | **PASS** |
| 12 | Type Safety | TypeScript throughout; every Firestore collection has a typed `FirestoreDataConverter<T>` (`lib/firebase/converters.ts`) so a read or write is always a typed domain object, never a raw, untyped `DocumentData`; Zod schemas double as runtime validation and, via `z.infer`, the compile-time types Server Actions accept | **PASS** |
| 13 | Input Validation | Zod schemas per domain area, enforced server-side in every Server Action/Route Handler (contracts/server-actions.md), independent of and in addition to Firestore/Storage Security Rules | **PASS** |
| 14 | Error Handling | Discriminated `{ ok, data } / { ok, error }` action result shape; loading/empty/error states planned per quickstart scenarios | **PASS** |
| 15 | Security | Firebase Admin SDK service-account credentials live only in server-only env vars, never bundled to the client; the public `NEXT_PUBLIC_FIREBASE_*` client config is safe to expose by Firebase's own design (it identifies the project, it does not authorize anything) and is backed by the least-privilege Firestore/Storage Security Rules in research.md §22, which also carry an explicit reminder that the Admin SDK bypasses those rules — so server-side authorization/validation is the real control, not a rules-as-a-safety-net assumption; Storage Rules additionally reject non-image content-types and oversized uploads at the platform layer; errors surfaced to users never include Firestore/Admin SDK error codes or stack traces (research.md §15); rate limiting planned for auth and checkout endpoints. The service worker's cache allowlist (research.md §24) is itself a security control — it structurally excludes auth secrets, Admin SDK credentials, checkout submissions, order mutations, and customer/admin responses from ever being cached, by only ever caching a fixed, explicit set of static assets rather than caching-by-default. Instagram/WhatsApp links open with `rel="noopener noreferrer"` (research.md §29), and neither URL/number is ever hardcoded — both are read exclusively from `lib/config/social.ts` (research.md §28), so no placeholder/fake destination can silently ship to production | **PASS** |
| 16 | Accessibility | Semantic landmarks, labeled inputs, `alt` text required per product image (data-model.md), focus-visible states, accessible dialog/menu primitives, reduced-motion gate (research.md §18); every Instagram/WhatsApp control (navbar, footer, floating button) carries an accessible name distinct from icon shape alone, a visible focus state, and a touch-friendly target size (spec FR-006g); the language switcher and every localized control meet the same bar, and `<html lang>`/`dir` update correctly and immediately on every language change (spec FR-083, research.md §33); the `LocationSelector` modal/drawer carries accessible dialog semantics, keyboard navigation, a labeled search input, and screen-reader-friendly selected-location feedback (spec FR-096) | **PASS** |
| 17 | Performance | `next/image`, cursor-based pagination, a full composite-index set matched to every filter+sort combination (data-model.md), tag/path revalidation with on-mutation invalidation, and — specifically to keep the admin dashboard fast as order history grows — a transactionally-maintained `stats/summary` document so total-sales/total-orders reads never scan the `orders` collection (research.md §17, §17a, §17b). PWA: a versioned, allowlisted service worker cache (precached static shell/brand assets/fonts only, research.md §24) speeds up repeat/installed-app loads without adding meaningful JS weight or risking stale commerce data | **PASS** |
| 18 | SEO | `generateMetadata` per route, `sitemap.ts`/`robots.ts` sourced from Firestore, product JSON-LD (research.md §16); every localized page carries its own locale-specific canonical URL plus `hreflang` alternates (`en`, `ar`, `x-default`), and the sitemap emits both locale variants of every URL rather than risking duplicate-content penalties (spec FR-082, research.md §35); delivery-location selection intentionally creates no new per-location public/indexed pages (spec FR-098) | **PASS** |
| 19 | Testing | Vitest unit tests for domain services/validation/order-status transitions (no I/O); Vitest integration tests run against the **Firebase Local Emulator Suite** (Auth + Firestore + Storage emulators) so database-backed workflows are tested against real Firestore/Auth/Storage semantics without touching a production project; Playwright E2E covers the critical customer/admin journeys — guest-checkout, wishlist, order-status, admin-product, authorization-boundary, invalid-checkout, and category-browsing flows — each run at representative mobile, tablet, and desktop viewports (research.md §14), plus a pre-release manual verification pass across representative iPhone/Android/tablet/laptop/desktop layouts (quickstart.md). PWA-specific coverage (research.md §27): manifest validity, service-worker registration, offline-fallback rendering, install-prompt visibility logic (including suppressed-when-installed), standalone-mode responsive re-check, and a dedicated test proving a live Firestore change is reflected on next load rather than served from a stale cache; Lighthouse CI as an independent PWA-audit cross-check. Instagram/WhatsApp coverage (quickstart.md): navbar/footer/floating-button destinations resolve to the centralized config, WhatsApp message pre-fill, no-fake-contact-info assertion, mobile accessibility, no horizontal overflow, floating-button non-interference, PWA-standalone handoff, and keyboard/label behavior. Bilingual coverage (research.md §39, quickstart.md): the critical customer/admin journeys are parameterized to run once per locale (English/LTR and Arabic/RTL), plus dedicated tests for language switching/persistence/refresh/PWA persistence, localized validation/errors/SOLD OUT/order statuses, bilingual admin product/category editing, localized WhatsApp greeting, localized SEO metadata, and the four homepage showcases (render, correct category link, category-pure featured products, Sold-Out-aware, responsive, RTL/LTR) | **PASS** |
| 20 | Incremental Implementation | 7-phase plan below, each phase independently verifiable before the next starts | **PASS** |
| 21 | No Silent Assumptions | Spec's two ambiguities were resolved via explicit user clarification, not silent invention; this plan's technical choices (including every MongoDB→Firebase adaptation) are all directed by the user's brief and recorded with rationale in `research.md` | **PASS** |
| 22 | Documentation | Phase 7 deliverable: README/docs covering setup, env vars, Firebase project setup (Auth/Firestore/Storage), Security Rules deployment, admin creation, product management, test order, deployment, domain/DNS, production checklist, **and PWA documentation** (manifest/icon/service-worker configuration, iOS/iPadOS/Android/desktop installation instructions, offline limitations, PWA testing/Lighthouse) | **PASS** (planned, not yet written — tracked as explicit Phase 7 tasks) |
| 23 | Quality Over Shortcuts | No phase skips validation/accessibility/security to move faster; Complexity Tracking below is empty (no shortcuts taken that require justification) | **PASS** |

**Initial gate result**: PASS — no violations requiring the Complexity Tracking table.

*(Re-checked after Phase 1 design below.)*

## Project Structure

### Documentation (this feature)

```text
specs/001-core-commerce-experience/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── server-actions.md
│   └── route-handlers.md
├── checklists/
│   └── requirements.md
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
elora/
├── middleware.ts                     # Composed: next-intl locale routing/redirect (research.md §32) + the lightweight admin session-cookie presence check for /admin/* (defense layer 1 of 3, research.md §9) — admin is NOT locale-prefixed
├── firebase.json                     # Emulator Suite config, Storage rules pointer, Firestore rules/index pointers
├── firestore.rules                   # Default-deny Security Rules for all business collections (research.md §22)
├── firestore.indexes.json            # Composite index definitions (data-model.md)
├── storage.rules                     # Admin-only write rules for `products/**` and `showcases/**` (research.md §11, §38)
├── serwist.config.ts                 # Service worker precache/runtime-caching allowlist config (research.md §24)
├── messages/
│   ├── en.json                       # Static UI-chrome translation catalog — English (research.md §32, §34)
│   └── ar.json                       # Static UI-chrome translation catalog — Arabic
├── public/
│   ├── brand/                        # Official ELORA logo asset(s) — never generated, never mirrored for RTL
│   └── icons/                        # PWA icons derived from the official logo only (research.md §23a): 192/512 standard, 512 maskable, apple-touch-icon.png
├── scripts/
│   ├── seed.ts                       # Dev/test-only sample data (categories incl. bilingual names, category showcases, collections, products incl. bilingual content, dev customer/admin) via the Admin SDK
│   └── create-admin.ts               # Bootstraps the first ADMIN user (Admin SDK user + custom claim, research.md §21)
├── src/
│   ├── app/
│   │   ├── [locale]/                 # next-intl dynamic locale segment — "en" | "ar" (research.md §32); wraps the ENTIRE customer-facing storefront, not the admin area
│   │   │   ├── layout.tsx            # Sets <html lang={locale} dir={ltr|rtl}>, loads the locale's message catalog, mounts Nav + Footer + LanguageSwitcher + InstallPrompt + FloatingWhatsApp (research.md §33)
│   │   │   ├── (storefront)/
│   │   │   │   ├── page.tsx          # Home — Hero → 4× (CategoryShowcase + Featured strip) → Featured Categories → New Arrivals/Best Sellers/Special Offers → Brand section (spec FR-001)
│   │   │   │   ├── shop/
│   │   │   │   │   ├── page.tsx      # Catalog: search/filter/sort/pagination + category switcher (all products or one category)
│   │   │   │   │   ├── category/
│   │   │   │   │   │   └── [categorySlug]/page.tsx  # Dedicated per-category page — Bracelets/Rings/Earrings/Watches (spec FR-007a, research.md §1a); `categorySlug` stays language-independent
│   │   │   │   │   └── [slug]/page.tsx   # Product detail
│   │   │   │   ├── collections/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [slug]/page.tsx
│   │   │   │   ├── about/page.tsx
│   │   │   │   ├── contact/page.tsx
│   │   │   │   ├── shipping-delivery/page.tsx   # Footer destination (spec FR-006); placeholder content pending store-provided policy text
│   │   │   │   ├── returns-exchange/page.tsx    # Footer destination (spec FR-006); placeholder content pending store-provided policy text
│   │   │   │   ├── privacy-policy/page.tsx      # Footer destination (spec FR-006); placeholder content pending store-provided policy text
│   │   │   │   ├── terms-conditions/page.tsx    # Footer destination (spec FR-006); placeholder content pending store-provided policy text
│   │   │   │   ├── cart/page.tsx
│   │   │   │   ├── checkout/page.tsx     # RTL-correct form layout in Arabic (research.md §33); authoritative pricing unaffected by locale (spec FR-077); region/city prefilled from the persisted location selection, still reviewable (spec FR-091)
│   │   │   │   ├── order-confirmation/[orderNumber]/page.tsx
│   │   │   │   ├── wishlist/page.tsx
│   │   │   │   ├── account/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── orders/
│   │   │   │   │       ├── page.tsx
│   │   │   │   │       └── [orderNumber]/page.tsx
│   │   │   │   ├── login/page.tsx        # Client Component: Firebase Auth client SDK sign-in + calls createSessionAction
│   │   │   │   └── register/page.tsx     # Client Component: Firebase Auth client SDK sign-up + calls createSessionAction
│   │   │   └── offline/page.tsx      # Branded offline fallback, precached by the service worker (spec FR-061, research.md §25); a single stable precache URL — reads the `NEXT_LOCALE` cookie client-side to pick its message set rather than being locale-prefixed itself, since a service-worker navigation fallback needs one fixed URL
│   │   ├── admin/                    # Deliberately NOT under [locale] — internal tool, English-only chrome (research.md §32); the *content it manages* is bilingual
│   │   │   ├── layout.tsx            # Server-side admin guard via Admin SDK (defense layer 2) + admin shell
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── products/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx      # Includes ImageUploader (direct-to-Firebase-Storage); English/Arabic fields clearly distinguished (spec FR-075)
│   │   │   │   └── [id]/edit/page.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── customers/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── categories/
│   │   │   │   └── page.tsx          # Category management: view, edit bilingual name/description, activate/deactivate, reorder (spec FR-046a, FR-076; remediation finding F3) — never creates/deletes a category, only mutates the seeded Bracelets/Rings/Earrings/Watches (+ any future) records
│   │   │   ├── showcases/
│   │   │   │   └── page.tsx          # Homepage category showcase management: bilingual title/subtitle/CTA, desktop/mobile image upload, display order, active toggle, per showcase (spec FR-001d)
│   │   │   ├── locations/
│   │   │   │   └── page.tsx          # Delivery-location management: two fixed regions (relabel/reorder only), add/edit/activate/deactivate/reorder cities within each region (spec FR-094, research.md §40)
│   │   │   ├── exports/
│   │   │   │   └── page.tsx          # Export to Excel screen: report-type picker (Orders/Products/Inventory/Customers/Sales/Best Sellers/SOLD OUT/Delivery Locations) + per-report filter controls, admin-only (spec FR-099–FR-112)
│   │   │   └── api/
│   │   │       └── export/
│   │   │           └── [reportType]/route.ts   # Admin-only `.xlsx` generation (GET), one handler per report type via `reportType`; re-verifies `requireAdmin()` independently (Route Handlers aren't wrapped by admin/layout.tsx) — contracts/route-handlers.md, research.md §45–§46
│   │   ├── api/
│   │   │   └── health/route.ts
│   │   ├── sitemap.ts                # Emits both /en/... and /ar/... entries with hreflang alternates (research.md §35)
│   │   ├── robots.ts
│   │   ├── manifest.ts               # Web app manifest metadata route (spec FR-054, research.md §23)
│   │   ├── icon.png                  # Favicon source (Next.js icon convention, from the official logo)
│   │   ├── apple-icon.png            # Apple Touch Icon (spec FR-055, research.md §23a)
│   │   └── globals.css               # Design tokens (brand palette, fonts); logical (direction-aware) utility conventions (research.md §33)
│   ├── actions/                      # Thin Server Actions — validate + call domain services (contracts/server-actions.md)
│   │   ├── auth.actions.ts           # createSessionAction, logoutAction
│   │   ├── account.actions.ts
│   │   ├── cart.actions.ts
│   │   ├── wishlist.actions.ts
│   │   ├── checkout.actions.ts
│   │   └── admin/
│   │       ├── product.actions.ts    # Bilingual name/description/material/options (research.md §34)
│   │       ├── category.actions.ts   # updateCategoryAction (bilingual name/description, isActive/displayOrder — remediation finding F3, spec FR-076)
│   │       ├── category-showcase.actions.ts  # updateCategoryShowcaseAction, attachShowcaseImageAction (spec FR-001d, research.md §38)
│   │       ├── delivery-location.actions.ts  # updateDeliveryRegionAction, createDeliveryLocationAction, updateDeliveryLocationAction, deleteDeliveryLocationAction (spec FR-086–FR-098, research.md §40)
│   │       ├── order.actions.ts
│   │       └── media.actions.ts      # attachUploadedImageAction, reorder/remove
│   ├── lib/
│   │   ├── firebase/                 # The ONLY place Firebase SDK calls are made; thin wrappers, no business logic
│   │   │   ├── client.ts             # Firebase client SDK init (Auth + Storage only; used in Client Components)
│   │   │   ├── admin.ts              # Cached Firebase Admin SDK app instance (research.md §2)
│   │   │   ├── firestore.ts          # Trusted server-side Firestore helpers (typed collection refs + converters, research.md §2)
│   │   │   ├── auth.ts               # createSessionCookie / verifySessionCookie wrappers (research.md §8)
│   │   │   ├── guards.ts             # requireUser(), requireAdmin() — server-side session+claim checks (research.md §9)
│   │   │   └── storage.ts            # Admin-SDK Storage helpers (delete object on image removal, research.md §11)
│   │   ├── i18n/
│   │   │   ├── routing.ts            # next-intl locale list ("en" | "ar"), default locale, pathname config (research.md §32)
│   │   │   └── request.ts            # next-intl per-request config (message loading for Server Components)
│   │   ├── domain/                   # Business logic — no framework/UI/Firebase imports; calls lib/firebase/* only through injected data-access functions
│   │   │   ├── catalog/              # Includes categoryShowcase.service.ts (spec FR-001b — category-scoped featured-product query, research.md §38)
│   │   │   ├── delivery/             # deliveryLocation.service.ts — bilingual search query, region validation helper reused by checkout (spec FR-086–FR-098, research.md §40, §44)
│   │   │   ├── cart/
│   │   │   ├── wishlist/
│   │   │   ├── checkout/
│   │   │   │   └── payment/          # Payment method abstraction (research.md §10)
│   │   │   ├── orders/
│   │   │   └── admin/                # Includes export.service.ts — per-report-type Firestore reads shared by the /admin/api/export/[reportType] Route Handler; reuses the exact dashboard-stats/Sold-Out-derivation logic already in this folder rather than recomputing figures a second, differently way (spec FR-105–FR-106, research.md §45)
│   │   ├── validation/               # Zod schemas, one file per domain area; localizedString.schema.ts shared by product/category/showcase/delivery-location schemas (data-model.md); deliveryLocation.schema.ts (regionId restricted to the two fixed values)
│   │   ├── config/
│   │   │   └── social.ts             # getSocialConfig(), buildInstagramHref(), buildWhatsAppHref(locale, message?) — the ONLY source every Instagram/WhatsApp control reads (spec FR-006a, FR-080, research.md §28, §37)
│   │   └── utils/
│   │       ├── slugify.ts
│   │       ├── currency.ts
│   │       ├── logger.ts
│   │       └── rate-limit.ts
│   ├── components/
│   │   ├── ui/                       # Button, Input, Card, Badge, Dialog, Skeleton, EmptyState, FormError, Price, DirectionalIcon.tsx (RTL-aware chevrons/arrows, research.md §33)
│   │   ├── storefront/                # Nav (+ Instagram/WhatsApp icons + LanguageSwitcher.tsx + LocationSelector.tsx trigger, spec FR-002/FR-003/FR-067/FR-086), Footer (+ Instagram/WhatsApp, spec FR-006), FloatingWhatsApp.tsx (spec FR-006e, research.md §30), LocationSelector.tsx (modal/drawer, bilingual region+city search, spec FR-087–FR-088, research.md §41), ProductCard, CategoryTile, CategoryShowcase.tsx (spec FR-001a, research.md §38), QuantitySelector, CartDrawer, Hero
│   │   ├── admin/                     # DataTable, StatCard, OrderStatusSelect, ImageUploader (Firebase Storage direct upload), BilingualField.tsx (paired EN/AR input, spec FR-075)
│   │   └── pwa/
│   │       └── InstallPrompt.tsx      # beforeinstallprompt capture + iOS manual-instructions fallback (spec FR-058–FR-060, research.md §26); localized copy (spec FR-081)
│   └── types/                        # Shared DTO/domain types, incl. LocalizedString (data-model.md)
├── tests/
│   ├── unit/                         # domain services, validation schemas, order-status transitions
│   ├── integration/                  # Admin-SDK-backed workflows against the Firebase Local Emulator Suite
│   └── e2e/                          # Playwright — critical customer/admin flows (parameterized per locale, research.md §39) + PWA checks (manifest, SW registration, offline fallback, install-prompt logic, standalone responsive) + showcase checks
├── .env.example
└── package.json
```

**Structure Decision**: Single Next.js App Router project (`src/app`) with a clear feature/domain
split — `app/` stays UI-and-routing only, `actions/` is a thin validation+auth wrapper, and all
real business logic lives in `lib/domain/*`, satisfying Constitution Principle 11 without the
overhead of a separate backend service (no technical need for one — a single Vercel-deployed
Next.js app, backed by one Firebase project for Auth/Firestore/Storage, fully covers both
storefront and admin per the user's stack directive). The customer-facing storefront additionally
sits under an `app/[locale]/` dynamic segment (research.md §32) so it can serve Arabic and English
as distinct, indexable URL trees from the same codebase; the Admin Dashboard deliberately stays
outside that segment, since bilingual support is a customer-facing/PWA requirement, not a
requirement to translate the internal admin tool's own chrome.

## Implementation Phases (incremental delivery, Constitution Principle 20)

Each phase ends with its own quickstart-style verification before the next begins; `tasks.md`
(generated separately by `/speckit-tasks`) will break these into concrete, ordered tasks.

1. **Phase 1 — Foundation**: project scaffold, Tailwind design tokens/fonts, Firebase project
   setup (Auth/Firestore/Storage enabled), Admin SDK + client SDK initialization, default-deny
   Firestore/Storage Security Rules, Firebase Authentication setup (register/login/logout, session
   cookie exchange, role custom claim), middleware admin-guard pre-filter, base layout with
   logo/nav/footer shell (unpopulated content OK). Because it changes every subsequent route's
   file path, the **`app/[locale]/` i18n routing foundation** (next-intl install/config,
   locale-routing middleware, `messages/en.json`/`messages/ar.json` skeletons, the `<html lang/
   dir>` mechanism, research.md §32–§33) is established in this same phase, before any storefront
   page is built.
2. **Phase 2 — Catalog browsing**: Category/Collection seed + service layer (via Admin SDK, now
   including bilingual `name`/`description`/`material`/option-label content and each category's
   `categoryShowcases` document — research.md §34, §38), Firestore composite indexes deployed,
   Home page sections **including the four large homepage category showcases and their
   category-scoped Featured-products strips** (spec FR-001a–FR-001c), Shop page (search/filter/
   sort/pagination), Product detail page, related products — all rendering correctly in both
   locales from the start, since the `[locale]` foundation already exists. This phase also seeds
   the two fixed `deliveryRegions` and an illustrative starting `deliveryLocations` list (research
   md §40) and builds the `LocationSelector` component (Navbar trigger, modal/drawer, bilingual
   region+city search, persistence via a cookie mirroring the language-persistence pattern —
   research.md §41), since it is a Navbar-level, catalog-adjacent capability with no dependency on
   cart/checkout existing yet.
3. **Phase 3 — Cart, wishlist, account basics**: guest (`guestCarts`) + registered (`carts`) cart
   with merge-on-login, wishlist (registered-only, guest-intent redirect), account profile
   view/edit — including associating a signed-in customer's selected delivery location with her
   profile (`profile.address.regionId`/`locationId`, data-model.md, spec FR-090).
4. **Phase 4 — Checkout & orders**: server-side pricing/stock recomputation, **server-side
   delivery-location revalidation against live `deliveryLocations` data** (research.md §42, spec
   FR-092–FR-093) folded into the same order-creation transaction, Firestore transactional order
   creation with a bilingual delivery-location snapshot, order-number generation via the counter
   document, order confirmation page, customer order history/detail, order status model. The
   checkout page prefills region/city from the Phase 2 selector's persisted selection while
   remaining reviewable/changeable (spec FR-091).
5. **Phase 5 — Admin**: dashboard statistics (Firestore aggregation queries), product CRUD (with
   paired English/Arabic fields, spec FR-075) + Firebase Storage image management (direct-to-
   Storage upload gated by Security Rules), category management (bilingual content + isActive/
   displayOrder, remediation finding F3), homepage category showcase management (bilingual title/
   subtitle/CTA + desktop/mobile image upload, spec FR-001d), **delivery-location management**
   (relabel/reorder the two fixed regions; add/edit/activate/deactivate/reorder cities within each
   — spec FR-094, research.md §40), order management + status transitions, customer management,
   and **admin-only Excel (`.xlsx`) export/reporting** for Orders, Products, Inventory/Stock,
   Customers, Sales, Best-Selling Products, SOLD OUT Products, and Delivery Locations, each
   generated server-side from live Firestore data with server-validated filters (spec
   FR-099–FR-112, research.md §45–§46) — a read-only reporting layer on top of data this phase's
   other admin surfaces already manage, never a second data store.
6. **Phase 6 — Content, SEO, accessibility, performance, PWA, and social-contact pass**:
   About/Contact/footer content wiring, metadata/sitemap/robots/JSON-LD sourced from Firestore,
   accessibility audit against `research.md` §18, caching/revalidation tuning, responsive audit
   against `research.md` §18a — and, building on that same responsive foundation, the PWA layer:
   web app manifest (`app/manifest.ts`), the full icon set derived from the official logo
   (standard, maskable, Apple Touch Icon, favicon — research.md §23a), the Serwist-configured
   service worker with its static-asset-only caching allowlist (research.md §24), the branded
   `/offline` fallback route (research.md §25), and the `InstallPrompt` component with its iOS
   manual-instructions fallback (research.md §26). This phase also wires up `lib/config/social.ts`
   (research.md §28) and the Instagram/WhatsApp navbar icons, footer links, and floating WhatsApp
   button (research.md §29–§31), since all three depend on the same responsive/PWA/design-token
   foundation this phase establishes. This phase also completes bilingual coverage of every
   remaining surface — checkout/order-status/error/empty/loading-state localization, localized
   SEO metadata with `hreflang`/canonical/sitemap handling (research.md §35), localized WhatsApp
   greeting (research.md §37), and localized PWA install/offline copy (spec FR-081) — since it is
   the natural point where content, SEO, accessibility, PWA, and social-contact work already
   converge on every page.
7. **Phase 7 — Testing, security hardening, deployment docs**: full Vitest (against the Firebase
   Local Emulator Suite) / Playwright suite against the quickstart scenarios — including the PWA
   test coverage from `research.md` §27 (manifest validity, service-worker registration, offline
   fallback, install-prompt logic, standalone-mode responsive re-check, stale-cache regression
   check) and a Lighthouse PWA-audit pass — plus the bilingual test matrix (research.md §39):
   existing critical-flow specs parameterized to run once per locale, RTL/LTR document-attribute
   checks, bilingual admin editing, and the four homepage showcases' category-purity/Sold-Out/
   responsive/RTL behavior — rate limiting on auth/checkout, Firestore/Storage Security Rules
   review, production documentation (Constitution Principle 22, including PWA setup, platform
   installation instructions, and bilingual/RTL notes), Vercel + Firebase (Firestore/Auth/Storage)
   production deployment. Also includes Excel export test coverage (spec FR-099–FR-112,
   research.md §45–§46): admin-only enforcement (a non-admin/unauthenticated request is rejected
   server-side and produces no file), generated-file validity and column/figure correctness against
   live Firestore data, each report-type filter, the empty-result-set case, and an explicit
   assertion that no Excel import/upload code path exists anywhere in the application.

## Post-Design Constitution Check

*Re-checked after Phase 1 design (`data-model.md`, `contracts/`, `quickstart.md`) above, and again
after the Firebase migration revision.*

No new entities, routes, or user-facing behavior were introduced by the Firebase migration beyond
what the Technical Context already declares. The migration replaced implementation mechanisms
only: Mongoose schemas → Firestore documents with typed converters; MongoDB unique indexes →
application-layer uniqueness checks (email delegated to Firebase Authentication, order numbers via
a transactional counter, slugs via a transactional conflict check); MongoDB transactions/replica
set → Firestore transactions (no infrastructure requirement); Auth.js credentials/database
sessions → Firebase Authentication + Admin-SDK-verified session cookies; Cloudinary signed uploads
→ Firebase Storage Security-Rules-gated direct upload. Each adaptation is recorded with rationale
in `research.md`. Firestore Security Rules (research.md §22) are a genuinely new artifact with no
MongoDB equivalent, added specifically to preserve the "server-side-only data access" guarantee in
Firestore's own terms.

**Second pass (this revision)**: three refinements were made to the Firebase design without
changing any feature, route, or requirement: (1) Security Rules were revised from a single
blanket deny-all to a least-privilege table scoped per collection (public catalog reads, owner-
scoped personal data, fully denied internal/admin data — research.md §22); (2) a `stats/summary`
document was added, maintained transactionally alongside order creation/cancellation, so dashboard
total-sales/total-orders reads stay O(1) as the `orders` collection grows rather than scanning it
(research.md §17b, data-model.md); (3) the product composite-index list was expanded to cover
every filter+sort combination the shop page actually issues (data-model.md), and Storage Security
Rules were made explicit about content-type/size validation (research.md §11). None of these add
a new user-facing capability or change a functional requirement — they harden and complete the
same design.

**Third pass (this revision — category/catalog organization)**: the core categories changed from
Necklaces/Earrings/Bracelets/Rings to **Bracelets/Rings/Earrings/Watches** (spec FR-007), and
category browsing gained real product-scope: (1) `Product.category` was renamed to `categoryId`
for clarity and to explicitly validate it references a real category document (spec FR-007d,
data-model.md); (2) `categories/{categoryId}` gained `displayOrder` and `isActive` fields (spec
FR-046a, data-model.md) plus an `isActive ASC, displayOrder ASC` index for ordered nav/homepage
rendering; (3) a new dedicated route family, `/shop/category/[categorySlug]`, was added (research
md §1a) alongside a category switcher on the existing `/shop` page (spec FR-007a/FR-007b) — this
is a new route, not a new architectural pattern, reusing the same Server Component + Firestore
composite-index approach every other catalog page already uses; (4) Sold Out (research.md §17b
scope unaffected) explicitly remains visible within its category page, not just the general shop,
per spec FR-015a's extended wording. This is additive catalog-organization scope, not a change to
Firebase architecture, checkout, cart, wishlist, admin architecture, or inventory logic.

**Fourth pass (this revision — strengthened responsive design)**: the general "mobile-first"
principle (already a PASS via Constitution Principle 3) was made concrete and testable across
every storefront area and the Admin Dashboard: a documented breakpoint scale mapped to the full
requested device range, explicit product-grid column guidance, an admin-table responsive-card
strategy (replacing implicit wide tables), explicit cart/checkout stacked-line-item behavior on
mobile, explicit image `sizes`/aspect-ratio/touch-target rules, and a page-level
no-horizontal-overflow guarantee (spec FR-050–FR-050h, research.md §18a). Testing gained explicit
mobile/tablet/desktop Playwright viewport coverage plus a pre-release manual device-verification
step (research.md §14). This is a strengthening of existing scope, not new features, routes, or
architecture — no other principle is affected.

**Fifth pass (this revision — installable PWA)**: the existing responsive Next.js storefront
gained installability, as an additive layer, not a separate application: a web app manifest and
platform metadata (research.md §23), a full icon set derived exclusively from the official logo
(research.md §23a — no new brand asset, Constitution Principle 2 unaffected), a Serwist-based
service worker whose caching is an explicit **allowlist of safe static assets only** — every page
or action touching prices, stock, Sold Out state, cart, checkout, orders, or account/admin data is
excluded and always served live from Firestore via the Admin SDK (research.md §24, directly
reinforcing Constitution Principles 7, 9, 10, and 15 rather than creating any tension with them),
a branded offline fallback route (research.md §25), and an install-prompt component that adapts to
platform capability — including iOS Safari's lack of a programmatic install API, represented
accurately rather than overpromised (research.md §26, spec FR-058–FR-060). Testing gained explicit
PWA coverage plus Lighthouse (research.md §27). No existing route, entity, business rule, or the
Burgundy + Gold + Cream identity changed.

**Sixth pass (this revision — Instagram & WhatsApp contact)**: three new customer-facing contact
touchpoints (navbar icons, footer links, and a floating WhatsApp button) were added on top of the
existing responsive/PWA/brand foundation, all reading from one new centralized config module,
`lib/config/social.ts` (research.md §28) — no component holds its own copy of a URL or phone
number. Link behavior (app handoff, safe external opening, correct behavior inside an installed
PWA's standalone window) relies entirely on standard web platform mechanisms — universal links,
the `wa.me` click-to-chat format, and `rel="noopener noreferrer"` — requiring no custom
platform-detection code (research.md §29). The floating WhatsApp button's placement is
coordinated against other fixed UI (mobile Add-to-Cart bar, PWA install banner) so it structurally
cannot cover a primary action (research.md §30), and its WhatsApp iconography reuses the existing
burgundy/gold/cream tokens rather than the platform's default green (research.md §31,
Constitution Principle 2). No real Instagram URL or WhatsApp number was invented — both remain
unconfigured placeholders in environment variables until the store owner supplies them, with every
consuming control designed to fail safely until then (spec FR-006b/FR-006h). No existing Firebase
architecture, commerce/inventory/Sold-Out/category logic, responsive requirement, or PWA behavior
changed.

**Seventh pass (`/speckit-analyze` remediation — findings F1–F6)**: a pre-implementation analysis
of `tasks.md` surfaced six findings, all now resolved in the planning artifacts:
- **F1 (HIGH, task ordering)**: the Instagram/WhatsApp phase previously preceded the phases it
  depended on (Footer, PWA install prompt). `tasks.md` is reordered so Footer is built alongside
  the Navbar (Phase 4) and PWA (Phase 12) precedes Instagram & WhatsApp (now Phase 13) — every
  cross-phase reference in `tasks.md` now points backward only.
- **F2 (MEDIUM)**: the admin product create/edit tasks now name the `availability` (storefront
  visibility) toggle explicitly, distinct from `isNewArrival`/`isBestSeller`/`stock`/derived Sold
  Out, per spec FR-038.
- **F3 (MEDIUM)**: a new `updateCategoryAction` (contracts/server-actions.md, "Admin —
  Categories") and a minimal `/admin/categories` page (added to Project Structure above) give
  admins a real write path for `isActive`/`displayOrder` — no direct Firestore editing required
  for normal category management. It creates/deletes nothing; the four core categories (and any
  future ones) remain seed/data-provisioned.
- **F4 (MEDIUM)**: Project Structure above now lists the four legal/informational routes
  (`shipping-delivery`, `returns-exchange`, `privacy-policy`, `terms-conditions`) that spec FR-006
  already required as footer destinations.
- **F5 (LOW)**: the final documentation task in `tasks.md` now explicitly names "project
  structure" and "dependency installation" alongside its other topics, so every item Constitution
  Principle 22 lists is named, not just implied.
- **F6 (LOW)**: the order-status transition-validator task in `tasks.md` now explicitly notes it
  builds on the cancellation/restock function from the earlier Inventory phase rather than
  duplicating it.

None of these findings required a spec, architecture, or brand-identity change — all six are
planning-artifact corrections.

**Eighth pass (this revision — homepage category showcases + Arabic/English bilingual support)**:
two substantial, additive feature areas were layered onto the approved architecture. (1) Four
large, full-width, admin-maintainable homepage category showcases (spec FR-001a–FR-001f) —
a new `categoryShowcases` Firestore collection plus Firebase Storage imagery, reusing the exact
product-image upload pattern (research.md §38) — sit between the existing Hero and the existing
Featured Categories/New Arrivals/Best Sellers/Special Offers/brand sections, none of which were
removed. Each showcase's "Featured {Category}" strip is a live, category-scoped query, so it can
never leak another category's products and always reflects current stock/Sold-Out state exactly
like the rest of the storefront. (2) Full Arabic/English bilingual support (spec FR-066–FR-085) —
locale-prefixed routing via `next-intl` (`app/[locale]/`, research.md §32), proper RTL/LTR via
`<html dir>` and logical CSS properties (research.md §33, with the official logo and product
photography explicitly never mirrored), a two-tier content strategy (static UI chrome in message
catalogs, dynamic store content as a new `LocalizedString` shape on `products`/`categories`/
`categoryShowcases`/`OrderItem`, research.md §34), and locale-aware SEO (`hreflang`/canonical/
sitemap, research.md §35). Every entity that gained bilingual fields keeps its identifier, slug/
URL, category relationship, price, stock, and order-status enum value strictly
language-independent (data-model.md, "Bilingual content never affects identity") — switching
language changes display text only, never checkout math, inventory truth, or Firestore identity.
The Admin Dashboard's own chrome remains English-only by design (research.md §32) — only the
*content* it manages (products, categories, showcases) is bilingual, matching the brief's explicit
scope ("relevant Admin Dashboard content-management interfaces"). No Firebase service, existing
route, existing business rule, PWA safeguard (research.md §24's caching allowlist is unaffected —
locale is just another URL segment, not a new data-sensitivity concern), or the Burgundy + Gold +
Cream identity changed. All 23 gates remain **PASS**. No entries are required in Complexity
Tracking.

**Ninth pass (this revision — customer delivery-region/location selector)**: a new, strictly
bounded catalog-adjacent capability was layered onto the approved architecture. Customers choose
their delivery location from **exactly two fixed regions** — West Bank and Inside/1948 Areas
(spec FR-086) — never a worldwide country selector; the two-region limit is enforced
**structurally**, via deterministic Firestore document IDs (`west-bank`, `inside-1948`) that the
admin update action can relabel/reorder but never create or delete (data-model.md, research.md
§40), rather than by a validation list an admin edit could silently expand. Within each region, an
open-ended, admin-maintainable `deliveryLocations` collection (bilingual `name`, unique-per-region
`slug`, bilingual `searchTerms` reusing the exact token-search pattern already used for products —
research.md §17a, §44) lets ELORA cover its real, evolving shipping footprint with **zero source
changes**, following the same admin-CRUD pattern already established for `categories`
(remediation finding F3) and `categoryShowcases`. The `LocationSelector` component (Navbar
trigger; a polished modal on desktop, a bottom-sheet/full-height drawer on mobile — spec FR-097)
persists the customer's choice the same way the language preference already persists (a cookie,
research.md §36, §41), optionally syncing to `profile.address.regionId`/`locationId` for signed-in
customers via the existing `updateProfileAction`. Checkout now collects `regionId`/`locationId`
instead of a free-text city, prefilled from that persisted selection but still reviewable/
changeable (spec FR-091), and — critically — the order-creation transaction re-verifies the
selection against **live** `deliveryLocations` data (region match + `isActive === true`) in the
exact same all-or-nothing transaction that already re-verifies stock and pricing (data-model.md,
"Authoritative delivery-location revalidation"; research.md §42); an unsupported or deactivated
location aborts the transaction with a clear, localized message and creates no order (spec
FR-092–FR-093), so a stale offline-cached selection can never silently produce an undeliverable
order (research.md §43 — `deliveryLocations` data itself is never part of the PWA caching
allowlist, research.md §24, even though the *cookie value* may be read while offline). Every
historical order snapshots a bilingual `delivery.regionName`/`locationName` at checkout time
(data-model.md), exactly like `OrderItem.productName`, so later admin relabeling or deactivating a
location never retroactively changes what a past order says. `regionId`/`locationId` join the
existing list of language-independent stable identifiers (data-model.md, "Bilingual content never
affects identity") — switching language never changes the underlying selected location. No public,
indexable per-location page is introduced (spec FR-098), so this feature adds no new SEO surface.
No existing Firebase service, route, business rule, PWA safeguard, or the Burgundy + Gold + Cream
identity changed. All 23 gates remain **PASS**. No entries are required in Complexity Tracking.

**Tenth pass (this revision — admin-only Excel export/reporting)**: an admin-only reporting layer
was added on top of the approved architecture — Orders, Products, Inventory/Stock, Customers,
Sales, Best-Selling Products, SOLD OUT Products, and Delivery Locations can each be downloaded as
a real `.xlsx` file (spec FR-099–FR-112). **Cloud Firestore remains the sole authoritative
production database** for every entity this feature touches; an export is generated fresh, on
demand, by reading current Firestore data via the Firebase Admin SDK (unaffected by, and never
itself a substitute for, the storage architecture in research.md §2, §22) and is never persisted,
cached, or read back into the system — there is no Excel **import** feature anywhere in this
application, so editing or re-uploading a downloaded report has zero effect on Firestore
(research.md §46, data-model.md "Excel export is derived, not stored"). Export is gated by the
exact same three-layer admin authorization already required of every other admin operation (spec
FR-101, Constitution Principle 6) — a Route Handler under `/admin/api/export/**`
(contracts/route-handlers.md) that independently re-verifies `requireAdmin()`, inheriting
`middleware.ts`'s existing `/admin/*` pre-filter for free — and never exposes Firebase Admin SDK
credentials to the client (spec FR-111, Constitution Principle 15). Sales and Best-Selling-Products
exports reuse the dashboard's existing statistics logic (research.md §17b) rather than recomputing
those figures a second, potentially-divergent way; the SOLD OUT export reuses the existing
`stock === 0` derivation (data-model.md) rather than introducing a second notion of "sold out."
`.xlsx` generation uses ExcelJS, including a streaming writer for the Orders/Sales report types so
a large order history doesn't require unbounded in-memory buffering (research.md §45) — no
background job queue or new infrastructure is introduced. No existing Firebase architecture,
commerce/inventory/Sold-Out/category/checkout/order logic, responsive/PWA/bilingual requirement, or
the Burgundy + Gold + Cream identity changed. All 23 gates remain **PASS**. No entries are required
in Complexity Tracking.

## Complexity Tracking

*No violations — table intentionally empty.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
