# Tasks: Core Commerce Experience (ELORA JEWELLERY)

**Input**: Design documents from `specs/001-core-commerce-experience/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, `.specify/memory/constitution.md`

**Revision note (this pass)**: Adds two approved feature areas on top of the prior
`/speckit-analyze`-remediated plan: (1) four large, full-width, admin-maintainable **homepage
category showcases** with category-scoped, Sold-Out-aware featured-product strips (spec
FR-001a–FR-001f); (2) complete **Arabic/English bilingual support** (spec FR-066–FR-085) —
locale-prefixed routing (`app/[locale]/`), RTL/LTR, a `LocalizedString` field shape threaded
through products/categories/showcases/order-item snapshots, bilingual admin editing, bilingual
checkout/SEO/PWA/social content. Every existing storefront route task's file path now lives under
`src/app/[locale]/(storefront)/...`; the Admin Dashboard (`src/app/admin/...`) is **not**
locale-prefixed by design (research.md §32). Task IDs are renumbered T001–T261 to keep IDs
strictly sequential with execution order; no previously-approved task content was removed or
weakened — bilingual/showcase work is additive.

**Revision note (latest pass — delivery-region/location selector)**: Adds a third approved
feature area: a customer delivery-location selector strictly limited to ELORA's two real service
regions — West Bank and Inside/1948 Areas, never a worldwide country selector (spec
FR-086–FR-098). New tasks are appended as **Phase 19** (T262–T291) rather than renumbering the
261 existing tasks, to avoid re-touching every already-approved task ID; Phase 19's own
**Dependencies** sub-section states exactly where in the existing execution order each of its
tasks actually belongs (its Firestore/service/seed tasks execute alongside Phase 3, its
`LocationSelector` UI/persistence tasks alongside Phase 4, its checkout-integration tasks alongside
Phase 8, and its admin-management tasks alongside Phase 10) — this is the same accepted
higher-numbered-task-serves-an-earlier-phase pattern already used elsewhere in this document (e.g.
T093/T162). A small number of already-existing tasks (T118, T123, T124, T125, T134, T227) are
edited in place — without changing their IDs — to fold in the region/city fields; every other
previously-approved task is untouched. No previously-approved requirement, route, or architecture
decision was removed or weakened — this feature is additive.

**Architecture**: Next.js App Router + React + TypeScript + Tailwind CSS, Firebase Authentication,
Cloud Firestore, Firebase Storage, Firebase Admin SDK, Server Actions/Route Handlers, Zod, Vitest,
Playwright, Firebase Emulator Suite, Serwist (PWA), `next-intl` (bilingual routing), Vercel. No
MongoDB/Mongoose/Auth.js/NextAuth/Cloudinary. Brand: Burgundy + Gold + Cream/Ivory/Soft Beige,
official ELORA logo only, never mirrored for RTL.

**Organization**: Phases follow the 18 functional areas of the approved plan, in dependency-safe
order (Footer built with the Navbar in Phase 4; PWA precedes Instagram & WhatsApp). Tasks that
implement a specific spec.md user story carry a `[US#]` label (US1 = Browse & Purchase as Guest
P1, US2 = Account & Order History P2, US3 = Wishlist P3, US4 = Admin Product Management P4,
US5 = Admin Order/Customer Management P5, US6 = Install & Use as App P6, US7 = Shop in Arabic or
English P7). Phases 1–3 are shared foundation (no label, block every story); Phases 11, 13, 14,
15, 16, 17, 18 are cross-cutting (no label, apply across all stories equally).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US7); omitted for foundational/
  cross-cutting tasks
- File paths are exact, relative to the repository root (`elora/` per plan.md)

---

## Phase 1: Project Foundation (Setup)

**Purpose**: Next.js/TypeScript/Tailwind scaffold, ELORA design system, Firebase client/Admin
initialization, Emulator Suite, validation/testing foundations, and the bilingual routing
foundation (established here because it changes every later route's file path). Blocks every
later phase.

- [ ] T001 Initialize Next.js 15 App Router + TypeScript project (`package.json`, `tsconfig.json`, `next.config.ts`) at repository root
- [ ] T002 [P] Install and configure Tailwind CSS (`tailwind.config.ts`, `postcss.config.js`)
- [ ] T003 [P] Configure ESLint/Prettier for the project
- [ ] T004 [P] Define ELORA design tokens as Tailwind theme colors — `brand-burgundy`, `brand-burgundy-dark/light`, `brand-gold`, `brand-gold-muted`, `brand-cream`, `brand-ivory`, `brand-beige`, `text-primary`, `text-on-dark`, `border-luxury` — in `src/app/globals.css` (research.md §19)
- [ ] T005 [P] Configure typography: serif/display heading font + refined sans body font via `next/font` in `src/app/globals.css` (research.md §19)
- [ ] T006 [P] Add the official ELORA JEWELLERY logo asset under `public/brand/` and build a shared `<Logo />` component in `src/components/ui/Logo.tsx` — never generated, substituted, or mirrored for RTL (Constitution Principle 2, research.md §33)
- [ ] T007 [P] Build reusable UI primitives `Button`, `Input`, `Card`, `Badge` in `src/components/ui/`
- [ ] T008 [P] Build reusable UI primitives `Dialog`, `Skeleton`, `EmptyState`, `FormError`, `Price` in `src/components/ui/`
- [ ] T009 Establish the responsive foundation (mobile-first breakpoint usage, base layout shell, container widths) in `src/app/globals.css` per the breakpoint scale in research.md §18a, using Tailwind **logical (direction-aware)** spacing/positioning utilities (`ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`) throughout rather than physical `ml-*`/`mr-*`/`left-*`/`right-*` (research.md §33)
- [ ] T010 Create `.env.example` documenting every required environment variable (Firebase client/admin, `NEXT_PUBLIC_APP_URL`, `ADMIN_BOOTSTRAP_*`, social config) with no real secrets committed
- [ ] T011 Scaffold Firebase project config files: `firebase.json`, `firestore.rules` (default-deny scaffold), `storage.rules` (default-deny scaffold), `firestore.indexes.json` (empty scaffold)
- [ ] T012 Implement Firebase client SDK initialization in `src/lib/firebase/client.ts`
- [ ] T013 Implement cached Firebase Admin SDK app initialization in `src/lib/firebase/admin.ts` (research.md §2)
- [ ] T014 Implement Firestore typed-converter foundation (`FirestoreDataConverter<T>` helper) in `src/lib/firebase/firestore.ts`
- [ ] T015 [P] Configure the Firebase Local Emulator Suite (Auth, Firestore, Storage) in `firebase.json` (research.md §14)
- [ ] T016 [P] Build the Zod validation foundation (shared primitives/error-shape helpers) in `src/lib/validation/common.ts`
- [ ] T017 [P] Configure Vitest (`vitest.config.ts`) with Firebase Emulator Suite wiring for `tests/integration/`
- [ ] T018 [P] Configure Playwright (`playwright.config.ts`) with mobile, tablet, and desktop device/viewport projects (research.md §14, §18a)
- [ ] T019 Implement the structured logger utility in `src/lib/utils/logger.ts` (research.md §15)
- [ ] T020 [P] Implement the slugify utility in `src/lib/utils/slugify.ts`
- [ ] T021 [P] Implement the currency (minor-units) utility in `src/lib/utils/currency.ts`
- [ ] T022 [P] Implement the pluggable rate-limit utility in `src/lib/utils/rate-limit.ts` (research.md §13)
- [ ] T023 Install and configure `next-intl`; define the supported locale list (`en`, `ar`) and default locale (`en`) in `src/lib/i18n/routing.ts` (research.md §32, spec FR-066)
- [ ] T024 Implement next-intl's per-request configuration (message loading for Server/Client Components) in `src/lib/i18n/request.ts`
- [ ] T025 [P] Create the initial message catalog skeletons `messages/en.json` and `messages/ar.json` (nav labels, buttons, empty/loading/error states — expanded per-feature in later phases; research.md §34)
- [ ] T026 Implement locale-routing middleware — detect `NEXT_LOCALE` cookie, else `Accept-Language`, else default `en`; redirect an un-prefixed storefront request to `/en/...` or `/ar/...` — composed with the existing admin session-cookie presence pre-filter in `middleware.ts` (research.md §32, §9; spec FR-084 fallback behavior)
- [ ] T027 Restructure the storefront route group under `src/app/[locale]/(storefront)/` and implement the `[locale]` root layout (`src/app/[locale]/layout.tsx`): sets `<html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>`, loads that locale's message catalog (research.md §33)
- [ ] T028 [P] Build the `<DirectionalIcon>` wrapper (mirrors genuinely directional icons — chevrons/arrows — under `dir="rtl"`; never applied to the logo or product photography) in `src/components/ui/DirectionalIcon.tsx` (research.md §33, spec FR-070)

**Checkpoint**: Project builds, design tokens/logo/UI primitives exist, Firebase SDKs initialize against the Emulator Suite, Vitest/Playwright run, and every storefront route from this point forward is created under `/[locale]/`.

---

## Phase 2: Authentication & Authorization (Foundational)

**Purpose**: Firebase Authentication, session handling, roles, server-side enforcement, admin
bootstrap. Blocks every user-facing story (US1–US7) and the whole Admin Dashboard.

**⚠️ CRITICAL**: No user-story phase may begin until this phase is complete.

- [ ] T029 Enable the Firebase Authentication Email/Password provider and document the console step in `docs/setup.md`
- [ ] T030 Implement session-cookie helpers `createSessionCookie`/`verifySessionCookie` in `src/lib/firebase/auth.ts` (research.md §8)
- [ ] T031 Implement `requireUser()`/`requireAdmin()` server-side guards in `src/lib/firebase/guards.ts` (research.md §9)
- [ ] T032 [P] Define registration/login/profile Zod schemas in `src/lib/validation/auth.schema.ts`
- [ ] T033 Implement the `users/{uid}` Firestore converter and typed collection reference in `src/lib/firebase/firestore.ts` (data-model.md)
- [ ] T034 Implement `createSessionAction` — verify ID token, mint session cookie, create/sync `users/{uid}` with `role: CUSTOMER` on first sign-up, complete any wishlist intent, merge a guest cart — in `src/actions/auth.actions.ts` (contracts/server-actions.md)
- [ ] T035 Implement `logoutAction` (clear session cookie, optional `revokeRefreshTokens`) in `src/actions/auth.actions.ts`
- [ ] T036 Build `/[locale]/login` (Client Component: Firebase Auth client SDK sign-in, then calls `createSessionAction`) in `src/app/[locale]/(storefront)/login/page.tsx`
- [ ] T037 Build `/[locale]/register` (Client Component: Firebase Auth client SDK sign-up, then calls `createSessionAction`) in `src/app/[locale]/(storefront)/register/page.tsx`
- [ ] T038 Implement `src/app/admin/layout.tsx`: server-side admin guard via Admin SDK + `role === "ADMIN"` check (defense layer 2 of 3) plus the admin shell (English-only chrome, research.md §32)
- [ ] T039 Implement unauthorized-access handling: redirect a non-admin away from `/admin/*`, redirect a guest away from `/[locale]/account/*` to `/[locale]/login` (spec FR-034/FR-035)
- [ ] T040 Implement `scripts/create-admin.ts`: idempotent Admin SDK bootstrap reading `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD`, sets the `role: "ADMIN"` custom claim and mirrors it to `users/{uid}` (research.md §21) — no public admin registration route exists
- [ ] T041 [P] Unit test: `requireAdmin()` rejects unauthenticated and non-admin callers in `tests/unit/guards.test.ts`
- [ ] T042 [P] Unit test: registration/login Zod schemas reject invalid input in `tests/unit/auth-schema.test.ts`

**Checkpoint**: Registration, login, logout, and the three-layer admin authorization gate all work; a normal customer cannot reach `/admin/*`.

---

## Phase 3: Product Data, Categories & Homepage Showcases (Foundational)

**Purpose**: Firestore product/category/showcase schemas — now bilingual — the category taxonomy
(Bracelets, Rings, Earrings, Watches), indexes, and seed data. Blocks Storefront (Phase 4),
Inventory (Phase 5), and Admin Product/Category/Showcase Management (Phase 10).

- [ ] T043 Define the shared `LocalizedString` Zod schema (`{ en: string (required), ar: string | null }`) in `src/lib/validation/localizedString.schema.ts`, reused by every bilingual field below (data-model.md, research.md §34)
- [ ] T044 Define the `Category` Zod schema (bilingual `name`/`description` via `LocalizedString`, `slug`, `displayOrder`, `isActive`) in `src/lib/validation/category.schema.ts` (data-model.md, spec FR-076)
- [ ] T045 Define the `Product` Zod schema (bilingual `name`/`description`/`material`, `options: [{ key, name: LocalizedString, values: [{ key, label: LocalizedString }] }]`, `price > 0`, `categoryId`, `images[]`, `stock >= 0`, `availability`, `isNewArrival`, `isBestSeller`) in `src/lib/validation/product.schema.ts` (data-model.md, spec FR-074)
- [ ] T046 Define the `CategoryShowcase` Zod schema (`categoryId`, bilingual `title`/`subtitle?`/`cta`, `desktopImage`, `mobileImage?`, `displayOrder`, `isActive`) in `src/lib/validation/categoryShowcase.schema.ts` (data-model.md, spec FR-001d)
- [ ] T047 Implement `categories/{categoryId}`, `products/{productId}`, and `categoryShowcases/{showcaseId}` Firestore converters in `src/lib/firebase/firestore.ts`
- [ ] T048 Implement server-side `categoryId` existence validation in `src/lib/domain/catalog/category.service.ts` (spec FR-007d) — called from product/showcase create/update, never trusted from the client form
- [ ] T049 Implement the transactional product-slug uniqueness check, derived from `name.en` (read-check-then-write) in `src/lib/domain/catalog/product.service.ts` (data-model.md)
- [ ] T050 Author `firestore.indexes.json` with every composite index from data-model.md: `categoryId+availability+createdAt/price/salesCount`, `availability+createdAt/price/salesCount`, `isNewArrival+availability+createdAt`, `isBestSeller+availability+salesCount`, `categories: isActive+displayOrder`, `categoryShowcases: isActive+displayOrder`, and deploy them
- [ ] T051 Implement the category-scoped "Featured {Category}" product query (`categoryId == X AND availability == true`, ordered by `createdAt DESC`, limited to a small N) in `src/lib/domain/catalog/categoryShowcase.service.ts` (data-model.md `categoryShowcases` "Relationships", spec FR-001b) — a live query, never denormalized onto the showcase document, so it can never leak another category's products or go stale
- [ ] T052 Write `scripts/seed.ts`: seed the four core categories — Bracelets/أساور, Rings/خواتم, Earrings/أقراط, Watches/ساعات (`displayOrder` 1–4, `isActive: true`) — one `categoryShowcases` document per category (bilingual title/CTA, placeholder imagery), plus sample bilingual products per category (at least one English-only product to exercise the fallback path), explicitly dev/test-only
- [ ] T053 [P] Unit test: `Product` schema rejects negative price/stock, a missing/invalid `categoryId`, and a `LocalizedString` missing `en` in `tests/unit/product-schema.test.ts`
- [ ] T054 [P] Unit test: `Category`/`CategoryShowcase` schemas enforce a non-negative `displayOrder` in `tests/unit/category-schema.test.ts`
- [ ] T055 [P] Unit test: `LocalizedString` consumers fall back to `en` when `ar` is `null`/empty in `tests/unit/localized-string.test.ts` (spec FR-074, Edge Cases)
- [ ] T056 [P] Integration test: seeded categories/products/showcases are queryable via the Emulator Suite in `tests/integration/catalog-seed.test.ts`

**Checkpoint**: The four categories and their showcases exist in Firestore with bilingual content, product documents validate and reference a real category, and all catalog/showcase indexes are deployed.

---

## Phase 4: Storefront (Browsing, Homepage Showcases, Navigation & Footer Shell) — [US1] Browse and Purchase as a Guest

**Goal**: A visitor can go Home (including the four category showcases) → Shop/Category → Product
without friction, browsing real, categorized, indexed, bilingual Firestore data, inside a
complete Navbar+Footer page shell with a working language switcher.

**Independent Test**: A shopper with no session can reach the homepage (seeing the Hero, all four
showcases with their featured products, Featured Categories, New Arrivals/Best Sellers/Special
Offers, and brand section in order), use the nav to open Shop or any of the four category pages,
search/filter/sort, and open a product detail page — all showing real, correctly-scoped Firestore
data, with a working footer and language switcher on every page.

> **Note (locale routing)**: every route below lives under `src/app/[locale]/(storefront)/`
> (established in Phase 1, T027). Footer is built here, in the same phase as the Navbar, so later
> phases (Instagram & WhatsApp, Phase 13) can safely *add* icons into an already-existing Footer.

- [ ] T057 Build the responsive Navbar shell (logo, Home/Shop/Collections/About/Contact) in `src/components/storefront/Navbar.tsx`
- [ ] T058 Add Search, Wishlist, Cart, and Account icons to the Navbar in `src/components/storefront/Navbar.tsx` (depends on T057)
- [ ] T059 Add category quick-links (Bracelets/Rings/Earrings/Watches, localized display names) to the desktop Navbar in `src/components/storefront/Navbar.tsx` (spec FR-002)
- [ ] T060 [US7] Build the `LanguageSwitcher` component (AR | EN, integrated elegantly into the desktop Navbar) in `src/components/storefront/LanguageSwitcher.tsx` — navigates to the equivalent `/ar/...`/`/en/...` path, which sets the `NEXT_LOCALE` cookie via the routing middleware (T026) (spec FR-067)
- [ ] T061 Build the mobile hamburger navigation (collapsible, preserves every destination including categories, Instagram, WhatsApp, and the language switcher) in `src/components/storefront/MobileNav.tsx` (spec FR-003)
- [ ] T062 [US1] Build the Hero section (headline, tagline, "Shop Now" CTA, logo) in `src/components/storefront/Hero.tsx`
- [ ] T063 [US1] Build the `CategoryShowcase` component (large full-width editorial banner: desktop/mobile image, bilingual title/subtitle, bilingual CTA linking to the category's dedicated page) in `src/components/storefront/CategoryShowcase.tsx` (spec FR-001a, research.md §38)
- [ ] T064 [US1] Build the "Featured {Category}" strip component (renders a small `ProductCard` grid from the live query in T051) in `src/components/storefront/FeaturedCategoryProducts.tsx` (spec FR-001b)
- [ ] T065 [US1] Build the Featured Categories quick-entry section (four cards linking to their dedicated category pages) in `src/components/storefront/FeaturedCategories.tsx` (spec FR-001)
- [ ] T066 [US1] Build the New Arrivals / Best Sellers / Special Offers home sections in `src/components/storefront/CollectionSection.tsx`
- [ ] T067 [US1] Build the brand introduction section in `src/components/storefront/BrandIntro.tsx`
- [ ] T068 [US1] Assemble the Home page (Server Component reading Firestore via the Admin SDK) in `src/app/[locale]/(storefront)/page.tsx`: Hero (T062) → four × (CategoryShowcase + Featured strip, T063/T064, one per core category in a fixed order) → Featured Categories (T065) → New Arrivals/Best Sellers/Special Offers (T066) → brand section (T067) — the full approved merchandising sequence (spec FR-001)
- [ ] T069 [US1] Implement the product listing query service (search, category filter, price filter, newest/price/popularity sort, pagination via Firestore cursors; search matches both `name.en` and `name.ar` tokens) in `src/lib/domain/catalog/product.service.ts` (research.md §17)
- [ ] T070 [US1] Build the Shop page with an "All Products / Bracelets / Rings / Earrings / Watches" category switcher (localized category labels) in `src/app/[locale]/(storefront)/shop/page.tsx` (spec FR-007b)
- [ ] T071 [US1] Build the dedicated category page (`categoryId`-scoped Server Component query, localized category name in the page header) in `src/app/[locale]/(storefront)/shop/category/[categorySlug]/page.tsx` (spec FR-007a, research.md §1a) — `categorySlug` itself stays language-independent
- [ ] T072 [US1] Build `ProductCard` (localized image, name, price, category, availability/SOLD OUT badge, wishlist icon, quick view, add to cart) in `src/components/storefront/ProductCard.tsx`
- [ ] T073 [US1] Build the `QuickView` dialog in `src/components/storefront/QuickView.tsx`
- [ ] T074 [US1] Implement the responsive product grid (≈2 cols mobile, ≈2–3 tablet, ≈3–4 laptop/desktop, width-capped at `2xl`) on the Shop and category pages (research.md §18a)
- [ ] T075 [US1] Build the product detail page (localized gallery/name/price/description/material/options, stock/SOLD OUT, quantity selector, add to cart, add to wishlist, related products) in `src/app/[locale]/(storefront)/shop/[slug]/page.tsx`
- [ ] T076 [US1] Build `ImageGallery` (stacked on mobile/tablet, multi-column on desktop) in `src/components/storefront/ImageGallery.tsx` (spec FR-050c)
- [ ] T077 [US1] Build `QuantitySelector` (touch-friendly, stock-bounded) in `src/components/storefront/QuantitySelector.tsx`
- [ ] T078 [US1] Implement the related-products query (same category) in `src/lib/domain/catalog/product.service.ts`
- [ ] T079 [P] [US1] Unit test: the product-query builder produces the correct Firestore filter/sort for every category × sort combination, and bilingual search matches both `name.en` and `name.ar` in `tests/unit/product-query.test.ts`
- [ ] T080 [US1] Playwright test: guest browses Home (all four showcases) → Shop → category page → product detail (quickstart Scenario 1/1b/12) in `tests/e2e/browse.spec.ts`
- [ ] T081 Build the `Footer` component (branding, Shop/About Us/Contact links, Shipping & Delivery/Returns & Exchange/Privacy Policy/Terms & Conditions links, TikTok link) in `src/components/storefront/Footer.tsx` — links to the four legal routes and TikTok use store-provided content (spec FR-006); Instagram and WhatsApp icons are intentionally **not** added here — they are added into this same component later, in Phase 13, once the centralized social config exists, so this task never depends on unfinished later-phase work

**Checkpoint**: A guest can fully browse the catalog, including the homepage showcases and all four category pages, with search/filter/sort and the language switcher working everywhere, inside a complete page shell (Navbar + Footer).

---

## Phase 5: Inventory & SOLD OUT

**Purpose**: Admin-managed stock, derived (never manually set) Sold Out state, transaction-safe,
race-free stock integrity across cart/checkout/cancellation — including on the homepage.

- [ ] T082 [US4] Enforce non-negative admin stock entry on product create/update via the `Product` Zod schema (T045) — reused by admin forms in Phase 10
- [ ] T083 [US1] Implement the single `isSoldOut = stock === 0` derivation helper in `src/lib/domain/catalog/product.service.ts` — the only place this is computed (data-model.md "Sold Out derivation")
- [ ] T084 [US1] Render the SOLD OUT badge on `ProductCard` when `isSoldOut` (depends on T072, T083) — since the homepage's "Featured {Category}" strip (T064) reuses `ProductCard` directly, Sold Out state, disabled Add to Cart, and continued visibility all apply there automatically, with no separate homepage-specific logic to write or bypass (spec Edge Cases)
- [ ] T085 [US1] Render SOLD OUT on the product detail page: badge, disabled Add to Cart, disabled quantity selector (depends on T075, T083)
- [ ] T086 [US1] Verify catalog and featured-strip queries (T069, T051) filter only on `availability`, never on `stock` — a Sold Out product stays browsable in its category and its homepage showcase strip unless separately hidden (spec FR-015a, FR-001c)
- [ ] T087 [US1] Implement server-side stock/Sold-Out/hidden validation in `addCartItemAction`/`updateCartItemQuantityAction` (rejects invalid quantity, Sold Out, or hidden products) in `src/actions/cart.actions.ts`
- [ ] T088 [US1] Implement authoritative stale-cart re-validation for every line inside the order-creation transaction in `src/lib/domain/checkout/checkout.service.ts` (spec FR-026)
- [ ] T089 [US1] Implement the Firestore transaction that decrements `stock` and increments `salesCount` as part of order creation in `src/lib/domain/orders/order.service.ts` (research.md §3)
- [ ] T090 [US1] Verify the same transaction (T089) re-reads `stock` before deciding, so two concurrent last-unit purchases cannot both succeed (data-model.md "Stock integrity")
- [ ] T091 [US1] Verify the transaction (T089) rejects rather than partially applies when a requested quantity would drive `stock` negative
- [ ] T092 [US4] Verify admin restock (raising `stock` above 0) clears Sold Out automatically with no extra field/action (derivation from T083 only)
- [ ] T093 [US5] Implement the order-**cancellation** transaction: restock and decrement `salesCount` in `src/lib/domain/orders/order-status.service.ts` — this is the base cancellation/restock function that Phase 10's transition validator (T162) builds on top of, not a duplicate of it (remediation finding F6)
- [ ] T094 [P] Unit test: `isSoldOut` derivation for `stock = 0`, `stock > 0`; schema rejects negative stock in `tests/unit/sold-out.test.ts`
- [ ] T095 [P] Integration test (Emulator Suite): order-creation transaction never drives stock negative under two concurrent requests for the last unit in `tests/integration/order-transaction.test.ts`

**Checkpoint**: Sold Out is 100% derived and race-free everywhere, including the homepage; no path can push stock below 0.

---

## Phase 6: Cart — [US1] Browse and Purchase as a Guest

**Goal**: Guest and registered carts persist server-side, are stock-validated, and merge safely
on login.

**Independent Test**: A guest can add/update/remove cart lines that persist across navigation;
logging in merges her guest cart into her account cart without losing or over-stocking items.

- [ ] T096 [US1] Implement `carts/{uid}` and `guestCarts/{guestCartId}` Firestore converters, including the `guestCarts.expiresAt` TTL field, in `src/lib/firebase/firestore.ts`
- [ ] T097 [US1] Implement the signed, httpOnly guest-cart cookie helper (opaque `guestCartId` generation) in `src/lib/domain/cart/guest-cart.ts` (research.md §5)
- [ ] T098 [US1] Implement cart resolution (get-or-create `carts/{uid}` or `guestCarts/{guestCartId}`) in `src/lib/domain/cart/cart.service.ts`
- [ ] T099 [US1] Implement `addCartItemAction` — `selectedOption` referenced by the product's stable `optionKey`/`valueKey`, never a localized label (data-model.md) — in `src/actions/cart.actions.ts` (depends on T087)
- [ ] T100 [US1] Implement `updateCartItemQuantityAction` (quantity ≤ 0 removes the line) in `src/actions/cart.actions.ts`
- [ ] T101 [US1] Implement `removeCartItemAction` in `src/actions/cart.actions.ts`
- [ ] T102 [US1] Implement server-side cart subtotal/total calculation — never trust a client-submitted total, and unaffected by the shopper's selected language — in `src/lib/domain/cart/cart.service.ts`
- [ ] T103 [US1] Implement the guest→registered cart merge transaction (stock-clamped, duplicate quantities summed) in `src/lib/domain/cart/cart-merge.service.ts`, invoked from `createSessionAction` (T034) (research.md §6)
- [ ] T104 [US1] Build the `/[locale]/cart` page (line items, quantity controls, subtotal/total, continue shopping, proceed to checkout) in `src/app/[locale]/(storefront)/cart/page.tsx`
- [ ] T105 [US1] Build the responsive `CartLineItem` (table row at `md`+, stacked card below `md`; resolves its localized option label live from the product, T099) in `src/components/storefront/CartLineItem.tsx` (spec FR-050d)
- [ ] T106 [US1] Build the empty-cart state (using `EmptyState`) in `src/components/storefront/CartEmptyState.tsx`
- [ ] T107 [P] [US1] Unit test: cart subtotal/total math and stock-clamped merge logic in `tests/unit/cart-service.test.ts`
- [ ] T108 [US1] Playwright test: guest adds/removes/updates cart quantities and the cart persists across navigation (quickstart Scenario 1) in `tests/e2e/cart.spec.ts`

**Checkpoint**: Cart is fully functional for both guests and registered customers, with no client-trusted pricing.

---

## Phase 7: Wishlist — [US3] Maintain a Wishlist

**Goal**: Registered customers can save, remove, and move wishlist items; guests are redirected
to authenticate, never given a temporary guest wishlist.

**Independent Test**: A signed-in customer adds a product to her wishlist, sees it persist across
a logout/login cycle, and moves it into her cart.

- [ ] T109 [US3] Implement the `wishlists/{uid}` Firestore converter in `src/lib/firebase/firestore.ts`
- [ ] T110 [US3] Implement `addWishlistItemAction` (auth required) in `src/actions/wishlist.actions.ts`
- [ ] T111 [US3] Implement `removeWishlistItemAction` in `src/actions/wishlist.actions.ts`
- [ ] T112 [US3] Implement `moveWishlistItemToCartAction` (re-validates stock, adds to cart, removes from wishlist) in `src/actions/wishlist.actions.ts`
- [ ] T113 [US3] Implement the guest "Add to Wishlist" redirect to `/[locale]/login?next=<path>&intent=wishlist:<productId>` in `ProductCard`/product-detail wishlist controls (spec FR-033a) — no guest wishlist data is ever stored
- [ ] T114 [US3] Implement wishlist-intent completion inside `createSessionAction` (T034) so the original action completes after sign-in (research.md §7)
- [ ] T115 [US3] Build the `/[locale]/wishlist` page (responsive grid, move-to-cart, remove) in `src/app/[locale]/(storefront)/wishlist/page.tsx`
- [ ] T116 [P] [US3] Unit test: guest-intent redirect parameter parsing/validation in `tests/unit/wishlist-intent.test.ts`
- [ ] T117 [US3] Playwright test: register → login → add to wishlist → survives logout/login → move to cart (quickstart Scenario 2/3) in `tests/e2e/wishlist.spec.ts`

**Checkpoint**: Wishlist works end-to-end for registered customers; guests are cleanly redirected, never given a temporary wishlist.

---

## Phase 8: Checkout & Orders — [US1] Browse and Purchase as a Guest

**Goal**: A frictionless, guest-or-registered, bilingual checkout that always computes price/stock
authoritatively server-side and creates a complete, immutable, bilingual order snapshot.

**Independent Test**: A shopper (guest or signed in, in either language) completes checkout with
valid delivery details and Cash on Delivery and lands on a confirmation page showing correct order
data; the same order appears correctly in the admin order list, with an accurate bilingual
snapshot regardless of later product-translation edits.

- [ ] T118 [US1] Define the checkout Zod schema (fullName, phone, **regionId, locationId** — replacing free-text `city`, address, email, notes?, paymentMethod) in `src/lib/validation/checkout.schema.ts` — field labels/validation messages are localized via the message catalog (T025), the schema itself validates plain user-entered text in either language; `regionId`/`locationId` are validated as non-empty stable identifiers here, then re-verified against live Firestore data inside the order-creation transaction (T123, T277) (spec FR-092)
- [ ] T119 [US1] Implement the `PaymentMethod` abstraction (discriminated union + `CashOnDeliveryProvider`) in `src/lib/domain/checkout/payment/` (research.md §10)
- [ ] T120 [US1] Implement `orders/{orderId}` and `counters/order-{YYYYMMDD}` Firestore converters in `src/lib/firebase/firestore.ts`
- [ ] T121 [US1] Implement transactional order-number generation (`ELR-YYYYMMDD-NNNN`) in `src/lib/domain/orders/order-number.service.ts` (research.md §4)
- [ ] T122 [US1] Implement the `stats/summary` transactional increment/decrement helper in `src/lib/domain/admin/stats.service.ts` (research.md §17b)
- [ ] T123 [US1] Implement the full order-creation transaction in `src/lib/domain/orders/order.service.ts`: load authoritative products → re-validate options/quantities/stock (T088) → **re-verify `regionId`/`locationId` against live `deliveryLocations` data (T277)** → recompute unit prices/subtotal/total server-side (locale-independent) → generate order number (T121) → build immutable **bilingual** `OrderItem` snapshots (`productName`/`selectedOption.label` captured as `LocalizedString`s from the product as it exists at this moment, data-model.md, spec FR-079) **and a bilingual `delivery.regionName`/`locationName` snapshot (T280)** → create the order document → decrement stock/increment salesCount (T089) → update `stats/summary` (T122) → clear the cart — the whole transaction aborts with no order created if either the stock check or the location check fails
- [ ] T124 [US1] Implement `submitCheckoutAction` (validates via T118, resolves the cart, calls T123, returns `{ orderNumber }` or field-level errors **including a "location not currently supported" error surfaced from T277/T278**) in `src/actions/checkout.actions.ts`
- [ ] T125 [US1] Build the `/[locale]/checkout` page (localized form fields/labels, Cash on Delivery, client + server validation feedback, correct RTL form layout in Arabic, **region/city prefilled from the persisted location selection via the review-and-change control, T279**) in `src/app/[locale]/(storefront)/checkout/page.tsx` (spec FR-077, FR-091)
- [ ] T126 [US1] Build the `/[locale]/order-confirmation/[orderNumber]` page (localized labels; order number, bilingual product names, quantities, total, payment method) in `src/app/[locale]/(storefront)/order-confirmation/[orderNumber]/page.tsx`
- [ ] T127 [US1] Implement the empty-cart checkout guard (redirect to Shop) in `src/app/[locale]/(storefront)/checkout/page.tsx`
- [ ] T128 [P] [US1] Unit test: order-number format and daily-counter increment in `tests/unit/order-number.test.ts`
- [ ] T129 [P] [US1] Unit test: checkout schema rejects incomplete/invalid fields in `tests/unit/checkout-schema.test.ts`
- [ ] T130 [P] [US7] Unit test: order-creation transaction captures both `en` and `ar` in the `OrderItem` snapshot at purchase time, independent of the shopper's active locale during checkout in `tests/unit/order-snapshot-bilingual.test.ts` (spec FR-079)
- [ ] T131 [US1] Playwright test: guest completes COD checkout and sees a correct order confirmation (quickstart Scenario 1) in `tests/e2e/checkout.spec.ts`
- [ ] T132 [US1] Playwright test: checkout with insufficient/zero stock is rejected safely, cart left intact, message identifies the affected item (quickstart Scenario 8) in `tests/e2e/checkout-invalid.spec.ts`

**Checkpoint**: The complete Home → Shop → Product → Cart → Checkout → Confirmation flow works for a guest in either language, with no client-trusted pricing anywhere and a reliable bilingual historical snapshot.

---

## Phase 9: Customer Account — [US2] Manage Account and Order History

**Goal**: A registered customer can view/update her profile and see accurate, live, correctly
localized order history and status.

**Independent Test**: A customer places an order while signed in, sees it in her order history
with the correct (localized) status, and sees the status update live after an admin change.

- [ ] T133 [US2] Define the profile Zod schema in `src/lib/validation/profile.schema.ts`
- [ ] T134 [US2] Implement `updateProfileAction` (own `uid` only, taken from the verified session; `profile.address.regionId`/`locationId`, when included, validated the same way as checkout's, T118/T277) in `src/actions/account.actions.ts`
- [ ] T135 [US2] Build the `/[locale]/account` page (overview + profile edit form) in `src/app/[locale]/(storefront)/account/page.tsx`
- [ ] T136 [US2] Implement the `userId`-scoped, paginated order-history query in `src/lib/domain/orders/order.service.ts`
- [ ] T137 [US2] Build the `/[locale]/account/orders` page (number, date, total, localized status per order) in `src/app/[locale]/(storefront)/account/orders/page.tsx`
- [ ] T138 [US2] Build the `/[locale]/account/orders/[orderNumber]` page (full detail including current localized status) in `src/app/[locale]/(storefront)/account/orders/[orderNumber]/page.tsx`
- [ ] T139 [US2] Verify order status is always read live from Firestore as its language-independent enum value (no caching) on T137/T138, with the localized display label resolved purely from the message catalog (T025) — the stored value is never translated (data-model.md, spec FR-078)
- [ ] T140 [P] [US2] Unit test: order-history query returns only the requesting user's orders in `tests/unit/order-history.test.ts`
- [ ] T141 [US2] Playwright test: registered customer places an order, sees Pending in history, admin updates status, customer sees the update (quickstart Scenario 4) in `tests/e2e/account-orders.spec.ts`

**Checkpoint**: Account overview, profile editing, and order history/detail/status all work correctly, in either language, for a registered customer.

---

## Phase 10: Admin Dashboard

**Goal**: Administrators can manage products, categories, and homepage category showcases — all
with clearly distinguished bilingual fields (US4) — and manage orders/customers/statistics (US5),
entirely gated by server-side authorization. The Admin Dashboard's own chrome remains
English-only; only the *content* it manages is bilingual (research.md §32).

### Product Management — [US4] Manage Products as an Administrator

**Independent Test**: An authenticated admin creates a product with all required bilingual fields
and an image, sees it live on the storefront in both languages, edits it, toggles its flags, and
deletes it.

- [ ] T142 [US4] Build `BilingualField` (a paired English/Arabic input pattern, clearly labeled "— English" / "— Arabic") in `src/components/admin/BilingualField.tsx` (spec FR-075) — used by every admin form below that edits a `LocalizedString`
- [ ] T143 [US4] Implement `createProductAction` (admin-only, bilingual `name`/`description`/`material`/`options`, `categoryId` validated via T048, transactional slug per T049) in `src/actions/admin/product.actions.ts`
- [ ] T144 [US4] Implement `updateProductAction` (partial update; `stock`/`categoryId` re-validated; each locale of a bilingual field independently updatable) in `src/actions/admin/product.actions.ts`
- [ ] T145 [US4] Implement `deleteProductAction` (admin-only; never touches existing `OrderItem` snapshots) in `src/actions/admin/product.actions.ts`
- [ ] T146 [US4] Implement `setProductFlagAction` (`isNewArrival`/`isBestSeller` toggle — **not** the `availability` visibility toggle, which is a separate field handled by `updateProductAction`, T144, per remediation finding F2) in `src/actions/admin/product.actions.ts`
- [ ] T147 [US4] Author Firebase Storage Security Rules: admin-only write under `products/**` and `showcases/**`, content-type (`image/*`) and size validation, in `storage.rules` (research.md §11, §38)
- [ ] T148 [US4] Build `ImageUploader` (direct-to-Firebase-Storage client upload, gated by T147) in `src/components/admin/ImageUploader.tsx`
- [ ] T149 [US4] Implement `attachUploadedImageAction`, `reorderProductImagesAction`, `removeProductImageAction` in `src/actions/admin/media.actions.ts`
- [ ] T150 [US4] Build `/admin/products` (list, search, current stock + Sold Out indicator + category per row) in `src/app/admin/products/page.tsx`
- [ ] T151 [US4] Build `/admin/products/new` with these **explicitly separate** fields (using `BilingualField`, T142, for the bilingual ones): name (EN/AR), description (EN/AR), material (EN/AR), option/color labels (EN/AR), price, category dropdown, options, initial stock, images, **an `availability` (storefront visibility) toggle**, an `isNewArrival` toggle, and an `isBestSeller` toggle — the visibility toggle MUST be its own labeled control, never merged into a generic "flags" group, and MUST NOT be presented alongside or confused with the (derived, unelectable) Sold Out state (spec FR-038, FR-075, remediation finding F2) — in `src/app/admin/products/new/page.tsx`
- [ ] T152 [US4] Build `/admin/products/[id]/edit` with the same explicitly-separate fields as T151, plus delete, in `src/app/admin/products/[id]/edit/page.tsx`
- [ ] T153 [US4] Build `CategorySelect` sourcing only active (`isActive: true`) categories, displayed by `name.en` in the admin UI, in `src/components/admin/CategorySelect.tsx` (spec FR-036c)

### Category Management — [US4] Manage Products as an Administrator

**Independent Test**: An admin opens the category list, edits a category's bilingual name/
description, deactivates it, reactivates it, and changes the display order of the four core
categories, entirely through the UI — no direct Firestore console edit required.

- [ ] T154 [US4] Define `updateCategoryAction` input validation (`categoryId` required; bilingual `name`/`description` via `LocalizedString`; `isActive` boolean and/or `displayOrder` non-negative integer) reusing the `Category` Zod schema (T044) in `src/lib/validation/category.schema.ts`
- [ ] T155 [US4] Implement `updateCategoryAction` (admin-only; updates bilingual `name`/`description`, `isActive`/`displayOrder` on `categories/{categoryId}`; re-derives `slug` only if `name.en` changes; never creates or deletes a category) in `src/actions/admin/category.actions.ts` (contracts/server-actions.md, "Admin — Categories")
- [ ] T156 [US4] Build `/admin/categories` (list all categories ordered by `displayOrder`, `BilingualField`-based name/description editing, per-row active/inactive toggle, display-order input) in `src/app/admin/categories/page.tsx` — the four seeded categories MUST always be listed; the page manages existing categories only, it does not create new ones
- [ ] T157 [P] [US4] Unit test: `updateCategoryAction` rejects a negative `displayOrder`, an unknown `categoryId`, and a `name` missing `en`; `CategorySelect` (T153) excludes an inactivated category in `tests/unit/category-management.test.ts`

### Homepage Category Showcase Management — [US4] Manage Products as an Administrator

**Independent Test**: An admin edits one showcase's bilingual title/subtitle/CTA and uploads a
new desktop/mobile image; the homepage reflects the change with no code deploy.

- [ ] T158 [US4] Implement `updateCategoryShowcaseAction` (admin-only; updates bilingual `title`/`subtitle`/`cta`, `displayOrder`, `isActive`, and — if `categoryId` is included — re-verifies it references an existing category) in `src/actions/admin/category-showcase.actions.ts` (contracts/server-actions.md, "Admin — Category Showcases")
- [ ] T159 [US4] Implement `attachShowcaseImageAction` (admin-only; called after a direct-to-Firebase-Storage upload under `showcases/{showcaseId}/`, sets `desktopImage` or `mobileImage`) in `src/actions/admin/category-showcase.actions.ts`
- [ ] T160 [US4] Build `/admin/showcases` (one row per core category showcase: `BilingualField`-based title/subtitle/CTA editing, desktop/mobile `ImageUploader` per showcase, display-order input, active toggle) in `src/app/admin/showcases/page.tsx` (spec FR-001d)
- [ ] T161 [P] [US4] Unit test: `updateCategoryShowcaseAction` rejects an unknown `categoryId` and a `title` missing `en` in `tests/unit/category-showcase-management.test.ts`

### Order & Customer Management — [US5] Manage Orders and Customers as an Administrator

**Independent Test**: An admin views the order list, opens an order, changes its status
(reflected to the customer), and opens a customer record to see her order history; the dashboard
shows figures that match the underlying data.

- [ ] T162 [US5] Implement the order-status state machine validator (`PENDING→CONFIRMED→PREPARING→SHIPPED→DELIVERED`, cancellation branches, terminal states) in `src/lib/domain/orders/order-status.service.ts` — this builds on top of the cancellation/restock transaction already implemented in Phase 5 (T093) in the same file; it adds transition validation around that existing function, it does not reimplement or duplicate it (remediation finding F6)
- [ ] T163 [US5] Implement `updateOrderStatusAction` (validates the transition via T162; a transition to `CANCELLED` invokes the restock transaction from T093) in `src/actions/admin/order.actions.ts`
- [ ] T164 [US5] Build `/admin/orders` (list, search, filter by status) in `src/app/admin/orders/page.tsx`
- [ ] T165 [US5] Build `/admin/orders/[id]` (full detail + status-change control; displays each order line's bilingual product-name snapshot) in `src/app/admin/orders/[id]/page.tsx`
- [ ] T166 [US5] Implement the admin customer list/detail query (user + her orders) in `src/lib/domain/admin/customer.service.ts`
- [ ] T167 [US5] Build `/admin/customers` (list) in `src/app/admin/customers/page.tsx`
- [ ] T168 [US5] Build `/admin/customers/[id]` (profile + order history) in `src/app/admin/customers/[id]/page.tsx`
- [ ] T169 [US5] Implement dashboard statistics (`stats/summary` read for sales/orders, `count()` aggregation for customers/products, recent-orders query, best-sellers by `salesCount`) in `src/lib/domain/admin/dashboard.service.ts` (research.md §17b)
- [ ] T170 [US5] Build `/admin` (StatCard grid + recent orders + best sellers) in `src/app/admin/page.tsx`
- [ ] T171 [US5] Build reusable `DataTable` and `StatCard` components in `src/components/admin/DataTable.tsx`, `src/components/admin/StatCard.tsx`
- [ ] T172 [US5] Build `OrderStatusSelect` (client-side transition guard; server re-validates via T162) in `src/components/admin/OrderStatusSelect.tsx`

### Tests

- [ ] T173 [P] [US4] Unit test: order-status transition validator rejects invalid transitions in `tests/unit/order-status.test.ts`
- [ ] T174 [P] [US5] Unit test: dashboard statistics exclude cancelled orders from totals and best-seller ranking in `tests/unit/dashboard-stats.test.ts`
- [ ] T175 [US4] Playwright test: admin creates/edits a product with bilingual fields clearly distinguished (incl. image upload, the separate availability toggle), storefront reflects the change in both languages, restock clears Sold Out (quickstart Scenario 5) in `tests/e2e/admin-products.spec.ts`
- [ ] T176 [US4] Playwright test: admin deactivates a category, confirms it disappears from `CategorySelect` and customer-facing navigation, then reactivates it and changes display order in `tests/e2e/admin-categories.spec.ts`
- [ ] T177 [US4] Playwright test: admin edits a homepage showcase's bilingual title/subtitle/CTA and uploads a new image; homepage reflects the change without a redeploy (quickstart Scenario 12 step 5) in `tests/e2e/admin-showcases.spec.ts`
- [ ] T178 [US5] Playwright test: admin opens an order, changes its status, customer sees the update (quickstart Scenario 6) in `tests/e2e/admin-orders.spec.ts`
- [ ] T179 [US5] Playwright test: a normal customer attempting an admin route/action is rejected server-side, not just UI-hidden (quickstart Scenario 7) in `tests/e2e/admin-authz.spec.ts`

**Checkpoint**: Both admin flows (product/category/showcase management, order/customer management + dashboard) are fully functional, bilingual-content-aware, and correctly authorized.

---

## Phase 11: Responsive Design (Cross-Cutting)

**Purpose**: Make every storefront and admin surface built above fully responsive per the
strengthened requirements (spec FR-050–FR-050h, research.md §18a) — verified under **both** LTR
and RTL. Depends on Phases 4, 6, 8, 10.

- [ ] T180 [P] Apply the responsive product-grid column classes (2 / 2–3 / 3–4, width-capped at `2xl`) on the Shop and category pages (research.md §18a; extends T074)
- [ ] T181 [P] Implement the admin `DataTable` responsive card-list alternative below `md` in `src/components/admin/DataTable.tsx` (extends T171)
- [ ] T182 [P] Implement the responsive dashboard `StatCard` grid (stack on mobile, row on desktop) in `src/app/admin/page.tsx` (extends T170)
- [ ] T183 [P] Verify the responsive `CartLineItem` stacked/table behavior at every breakpoint (extends T105)
- [ ] T184 Apply a shared touch-target-size minimum via the `Button`/`Input` primitives (research.md §18a; extends T007)
- [ ] T185 Audit and eliminate page-level horizontal overflow across storefront and admin (no unconstrained `min-w` children; table scrolling confined to its own wrapper)
- [ ] T186 [US7] Verify every responsive rule above (grid columns, admin card-list, StatCard stacking, CartLineItem, touch targets, no-overflow) holds correctly with Arabic/RTL selected, not only English/LTR (research.md §33, spec FR-070)
- [ ] T187 [P] Playwright test: mobile/tablet/desktop responsive pass across storefront + Admin Dashboard, including orientation/resize (quickstart Scenario 9) in `tests/e2e/responsive.spec.ts`
- [ ] T188 Document the pre-release manual device-verification checklist (real/emulated iPhone, Android, tablet, laptop, desktop; both languages) in `docs/testing.md`

**Checkpoint**: Every storefront and admin surface is verified responsive from small phone through large desktop, in both LTR and RTL, with no unintended horizontal scrolling.

---

## Phase 12: PWA — [US6] Install and Use ELORA JEWELLERY as an App

**Goal**: The same responsive, bilingual storefront is installable, with correct branding, safe
caching, and an honest, localized offline experience.

**Independent Test**: On a supporting platform, a shopper installs the app, sees correct
name/icon/standalone launch, and completes the full commerce flow inside it exactly as in the
browser, in either language; on iOS she sees accurate manual instructions instead.

> **Note**: this phase precedes Instagram & WhatsApp (Phase 13) so the floating WhatsApp button's
> placement-coordination task can depend on the install-prompt component built here.

- [ ] T189 [US6] Implement `app/manifest.ts` (name "ELORA JEWELLERY", short_name, description, standalone display, burgundy/cream `theme_color`/`background_color`, icons) (research.md §23)
- [ ] T190 [US6] Generate the full PWA icon set from the official logo only — 192/512 standard, 512 maskable, 180×180 Apple Touch Icon, favicon — under `public/icons/`, `src/app/icon.png`, `src/app/apple-icon.png` (research.md §23a) — no regenerated/substitute logo
- [ ] T191 [US6] Configure `appleWebApp`/viewport metadata in the root layout for correct iOS/iPadOS standalone launch title and status bar (research.md §23)
- [ ] T192 [US6] Install and configure Serwist (`serwist.config.ts`): precache the static shell, brand/icon assets, fonts, message catalogs, and the `/offline` route (research.md §24)
- [ ] T193 [US6] Configure the Serwist runtime-caching allowlist: stale-while-revalidate for genuinely static marketing content only; explicit network-only exclusion for every Server Action, `/api/**` route, and every Firestore-backed page (shop, product, cart, checkout, account, admin) regardless of locale prefix (research.md §24)
- [ ] T194 [US6] Implement cache versioning (build-hash cache name; purge prior-version caches on activate) in `serwist.config.ts`
- [ ] T195 [US6] Disable service worker registration under `next dev` (research.md §24)
- [ ] T196 [US6] Build the branded `/offline` fallback page — reading the `NEXT_LOCALE` cookie client-side to render in the shopper's last-used language, since a service-worker navigation fallback needs one stable, non-locale-prefixed URL (spec FR-081) — precached, configured as the navigation fallback, in `src/app/offline/page.tsx` (research.md §25)
- [ ] T197 [US6] Implement `InstallPrompt`: `beforeinstallprompt` capture, `display-mode`/`navigator.standalone` detection, iOS manual-instructions panel, dismissal cooldown, fully localized copy via the message catalog in `src/components/pwa/InstallPrompt.tsx` (research.md §26, spec FR-081)
- [ ] T198 [US6] Mount `InstallPrompt` in the `[locale]` storefront layout with non-aggressive presentation in `src/app/[locale]/layout.tsx`
- [ ] T199 [P] [US6] Unit test: install-suppression logic (already installed / unsupported / recently dismissed) in `tests/unit/install-prompt.test.ts`
- [ ] T200 [US6] Playwright test: manifest validity, service-worker registration, offline fallback (in both languages), install-prompt visibility/suppression, standalone-mode responsive re-check, and a stale-cache regression check (quickstart Scenario 10) in `tests/e2e/pwa.spec.ts`
- [ ] T201 [US6] Configure Lighthouse CI to assert the PWA audit category passes against a preview deployment (research.md §27)

**Checkpoint**: The app installs correctly on supporting platforms with accurate, localized iOS fallback instructions, and never serves stale authoritative data while offline or cached, in either language.

---

## Phase 13: Instagram & WhatsApp (Cross-Cutting)

**Purpose**: Centralized, brand-consistent, bilingual Instagram/WhatsApp contact from the navbar,
footer, and a floating WhatsApp button.

> **Note**: every task below depends only on earlier phases — the Navbar (Phase 4, T057), the
> Footer (Phase 4, T081), and the PWA install prompt (Phase 12, T197/T198) — so this phase has no
> forward dependency on unfinished work.

- [ ] T202 [US7] Implement the centralized social config module — `whatsappDefaultMessage` as `{ en, ar }` — (`getSocialConfig`, `buildInstagramHref`, `buildWhatsAppHref(locale, message?)`) in `src/lib/config/social.ts` (research.md §28, §37) — the single source every consumer reads
- [ ] T203 [P] Add `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_WHATSAPP_PHONE`,
      `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_EN`, `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_AR`
      (optional, falls back to `_EN`) to `.env.example`, documented as pending real values (extends T010)
- [ ] T204 Add labeled (bilingual tooltip) Instagram + WhatsApp icons to the desktop Navbar (depends on T057, T202) in `src/components/storefront/Navbar.tsx`
- [ ] T205 Add Instagram + WhatsApp entries to the mobile hamburger menu (depends on T061, T202) in `src/components/storefront/MobileNav.tsx`
- [ ] T206 Add Instagram + WhatsApp links to the already-built Footer, reading the same config (depends on T081, T202) in `src/components/storefront/Footer.tsx`
- [ ] T207 Implement `FloatingWhatsApp` with placement coordination so it never overlaps the mobile Add-to-Cart bar or the PWA install banner already built in Phase 12 (depends on T184/T185 touch-target/overflow work and T197/T198 `InstallPrompt`) or a cookie notice, correctly positioned under both LTR and RTL, in `src/components/storefront/FloatingWhatsApp.tsx` (research.md §30, spec FR-070)
- [ ] T208 Implement fail-safe rendering (hidden or visibly disabled with an explanatory label) when Instagram/WhatsApp are unconfigured, in `lib/config/social.ts` consumers (T204, T206, T207)
- [ ] T209 Apply burgundy/gold/cream WhatsApp iconography — no default platform green — across T204/T206/T207 (research.md §31)
- [ ] T210 Mount `FloatingWhatsApp` in the `[locale]` storefront layout, excluded during the active checkout step, in `src/app/[locale]/layout.tsx`
- [ ] T211 [P] Unit test: `buildWhatsAppHref` selects the greeting matching the passed locale (falling back to `en`) and URL-encodes it correctly; both builders return `null` when unconfigured in `tests/unit/social-config.test.ts`
- [ ] T212 Playwright test: navbar/footer/floating Instagram+WhatsApp resolve to the configured destination with safe `rel` attributes, never overlap primary actions, are keyboard-accessible, fail safely when unconfigured, and use the correct localized greeting per locale (quickstart Scenario 11) in `tests/e2e/social-contact.spec.ts`

**Checkpoint**: Instagram is reachable from Navbar + Footer; WhatsApp is reachable from Navbar + Footer + the floating button, in both languages; all three read one config; no fake data anywhere.

---

## Phase 14: Content Pages (Cross-Cutting)

**Purpose**: About/Contact/legal pages. (The Footer itself was built in Phase 4, T081, so this
phase only adds page content and Footer-specific responsive polish.)

- [ ] T213 Build the `/[locale]/about` page (brand concept/identity content) in `src/app/[locale]/(storefront)/about/page.tsx`
- [ ] T214 Build the `/[locale]/contact` page (store-provided contact details/channels) in `src/app/[locale]/(storefront)/contact/page.tsx`
- [ ] T215 Build the Shipping & Delivery, Returns & Exchange, Privacy Policy, and Terms & Conditions pages with clearly-marked placeholder content pending store-provided legal text — never invented policy text — in `src/app/[locale]/(storefront)/shipping-delivery/page.tsx`, `.../returns-exchange/page.tsx`, `.../privacy-policy/page.tsx`, `.../terms-conditions/page.tsx` (these routes are also listed in plan.md's Project Structure, remediation finding F4)
- [ ] T216 Implement responsive Footer reflow (multi-column desktop → stacked mobile, correct column order under RTL) on the Footer built in T081
- [ ] T217 [P] Playwright test: About/Contact/Footer render correctly, all four legal routes resolve, and footer social links (from Phase 13) match the Navbar's destinations, in both languages in `tests/e2e/content-footer.spec.ts`

**Checkpoint**: Every footer link resolves in both languages, and no legal/contact content was fabricated.

---

## Phase 15: SEO, Accessibility & Performance (Cross-Cutting)

- [ ] T218 [P] [US7] Implement `generateMetadata` for home/shop/product/category/about/contact routes with per-locale titles/descriptions, a locale-specific canonical URL, and `hreflang` alternates (`en`, `ar`, `x-default`) (research.md §35, spec FR-082)
- [ ] T219 [P] [US7] Implement `src/app/sitemap.ts` sourced from Firestore products/categories/collections, emitting both `/en/...` and `/ar/...` entries per URL with `hreflang` annotations (research.md §35)
- [ ] T220 [P] Implement `src/app/robots.ts` (disallows `/admin`, `/[locale]/account`, `/[locale]/cart`, `/[locale]/checkout`, `/api` under both locale prefixes)
- [ ] T221 [P] Implement product JSON-LD structured data on the product detail page, localized per the active locale, in `src/app/[locale]/(storefront)/shop/[slug]/page.tsx`
- [ ] T222 Run an accessibility audit pass across storefront + admin, in both languages: semantic landmarks, form labels, keyboard navigation, visible focus states, `alt` text on every product image, dialog focus trapping, `prefers-reduced-motion` gating, correct `<html lang>`/`dir` updates on language change (research.md §18, §33)
- [ ] T223 [P] Apply `next/image` responsive `sizes` + aspect-ratio containers across `ProductCard`, `ImageGallery`, `CategoryShowcase`, and admin image previews (research.md §18a)
- [ ] T224 Implement `revalidateTag`/`revalidatePath` invalidation on every admin product/category/showcase mutation (T143–T146, T155, T158–T159) so the storefront never shows stale catalog/showcase data in either language
- [ ] T225 Implement cursor-based pagination for Shop/category product listings (research.md §17)
- [ ] T226 [P] Integrate a Lighthouse/axe accessibility check into CI

**Checkpoint**: Public pages are indexable with correct bilingual metadata and hreflang; the app meets baseline accessibility and performance expectations in both languages.

---

## Phase 16: Security (Cross-Cutting)

- [ ] T227 Author the least-privilege Firestore Security Rules table (public read for products/categories/collections/categoryShowcases**/deliveryRegions/deliveryLocations (T286)**; owner-only read for users/wishlists/carts/orders; deny-all for guestCarts/counters/stats; all writes admin-SDK-only) in `firestore.rules` (research.md §22)
- [ ] T228 Deploy Firestore and Storage Security Rules (`firebase deploy --only firestore:rules,storage:rules`)
- [ ] T229 Audit every admin Server Action (T143–T146, T149, T155, T158–T159, T163) to confirm each independently calls `requireAdmin()` (T031) — rules alone never substitute for this
- [ ] T230 Wire the rate-limit utility (T022) into `createSessionAction`/login and `submitCheckoutAction` in `src/actions/auth.actions.ts` and `src/actions/checkout.actions.ts`
- [ ] T231 Audit every Server Action/Route Handler to confirm no Firestore/Admin SDK error code or stack trace ever reaches the client response (research.md §15)
- [ ] T232 Verify Storage upload validation (content-type `image/*`, size ceiling) is enforced by `storage.rules` (T147) for both `products/**` and `showcases/**`, not merely by client-side form checks
- [ ] T233 [P] Security test: Firestore Security Rules deny unauthorized reads/writes via the Emulator Suite's rules-testing library in `tests/integration/firestore-rules.test.ts`
- [ ] T234 [P] Security test: Storage rules reject a non-admin upload and an oversized/non-image file, for both `products/**` and `showcases/**`, in `tests/integration/storage-rules.test.ts`

**Checkpoint**: Every write path is server-side-only and independently authorized; rules are a verified defense-in-depth backstop, not the primary control.

---

## Phase 17: Testing (Cross-Cutting Coverage & CI)

**Purpose**: Wire CI and add the remaining cross-cutting scenarios — including the full bilingual
test matrix — not already embedded in Phases 4–14 above.

- [ ] T235 Configure CI: Vitest (unit + Emulator-Suite integration), Playwright (mobile/tablet/desktop projects, parameterized per locale), Lighthouse CI, all gating merges
- [ ] T236 [P] Playwright test: Sold Out product → admin restock → purchasable again, including in its homepage Featured strip (quickstart Scenario 5 steps 8–9 / Scenario 12 step 4; extends T175) in `tests/e2e/admin-products.spec.ts`
- [ ] T237 [P] Playwright test: category isolation — 0% cross-category leakage across Bracelets/Rings/Earrings/Watches, both on category pages and in homepage Featured strips (quickstart Scenario 1b / 12) in `tests/e2e/category-browse.spec.ts`
- [ ] T238 [P] Playwright test: two concurrent requests for the last unit — exactly one order succeeds, the other is rejected, stock never goes negative in `tests/e2e/concurrent-checkout.spec.ts`
- [ ] T239 [P] Playwright test: full mobile commerce flow, mobile viewport, English/LTR (quickstart Scenarios 1 + 9 combined) in `tests/e2e/mobile-flow.spec.ts`
- [ ] T240 [P] [US7] Playwright test: full mobile commerce flow, mobile viewport, Arabic/RTL (quickstart Scenario 13 step 12) in `tests/e2e/mobile-flow-ar.spec.ts`
- [ ] T241 [P] Playwright test: full desktop commerce flow, desktop viewport, English/LTR (quickstart Scenarios 1 + 9 combined) in `tests/e2e/desktop-flow.spec.ts`
- [ ] T242 [P] [US7] Playwright test: full desktop commerce flow, desktop viewport, Arabic/RTL (quickstart Scenario 13 step 12) in `tests/e2e/desktop-flow-ar.spec.ts`
- [ ] T243 [P] Playwright test: offline checkout is blocked with no false success indication, in both languages (quickstart Scenario 10 steps 7–8; extends T200) in `tests/e2e/pwa.spec.ts`
- [ ] T244 [P] [US7] Playwright test: language switcher — switch language, verify RTL/LTR correctness and full-page relocalization, verify persistence across navigation/refresh/installed-PWA reopen, verify fallback to English for an unsupported browser locale (quickstart Scenario 13 steps 1–3, 13) in `tests/e2e/language-switching.spec.ts`
- [ ] T245 [P] [US7] Playwright test: bilingual product/category content renders correctly, falls back to English when Arabic is missing, and the four category names display correctly in Arabic (quickstart Scenario 13 steps 4–5) in `tests/e2e/bilingual-catalog.spec.ts`
- [ ] T246 [P] [US7] Playwright test: Arabic checkout — RTL form layout, localized validation/summary, authoritative totals identical to English (quickstart Scenario 13 step 6) in `tests/e2e/checkout-ar.spec.ts`
- [ ] T247 [P] [US7] Playwright test: historical order snapshot stays correctly bilingual after a later product-translation edit; order-status label localizes correctly while the stored value stays unchanged (quickstart Scenario 13 steps 7–8) in `tests/e2e/order-snapshot-localization.spec.ts`
- [ ] T248 [P] [US7] Playwright test: localized SEO metadata — distinct per-locale titles/descriptions/canonical/hreflang, both locale variants present in the sitemap (quickstart Scenario 13 step 11) in `tests/e2e/seo-localization.spec.ts`
- [ ] T249 Run the complete quickstart.md validation pass (all 13 scenarios) and record results before proceeding to Phase 18

**Checkpoint**: All critical E2E scenarios from the brief — including the full bilingual and homepage-showcase matrices — pass; CI enforces them on every change.

---

## Phase 18: Deployment & Production Readiness (Cross-Cutting)

- [ ] T250 Create the production Firebase project; enable Authentication (Email/Password), Firestore (Native mode), and Storage
- [ ] T251 Deploy Firestore Security Rules, Storage Security Rules, and Firestore composite indexes to the production Firebase project
- [ ] T252 Configure production environment variables in Vercel (Firebase client config, Admin SDK credentials, `NEXT_PUBLIC_APP_URL`, `ADMIN_BOOTSTRAP_*`, social config incl. bilingual WhatsApp greeting vars) — none committed to git
- [ ] T253 Run `scripts/create-admin.ts` against production to create the first administrator (spec: no public admin registration route)
- [ ] T254 Configure the real `NEXT_PUBLIC_INSTAGRAM_URL` and `NEXT_PUBLIC_WHATSAPP_PHONE` (+ optional English/Arabic greetings) once the store owner supplies them
- [ ] T255 Create the initial real, bilingual product catalog (at least one product per category, with both English and Arabic content) via `/admin/products/new`, confirm all four categories remain active with a sensible display order via `/admin/categories`, and configure the four homepage showcases' real bilingual content/imagery via `/admin/showcases`
- [ ] T256 Place and verify one real Cash-on-Delivery test order end-to-end in production, in each language
- [ ] T257 Deploy the application to Vercel (production), confirming the build includes the Serwist service-worker output and both locale trees
- [ ] T258 Configure the custom domain and DNS for the Vercel deployment
- [ ] T259 Run a production PWA-installability verification pass (manifest, icons, install prompt, iOS instructions, in both languages) and a production responsive-verification pass across representative devices in both LTR and RTL, and the final security check (Security Rules active, no secret in the client bundle, rate limiting active, error responses safe)
- [ ] T260 Verify production `hreflang`/canonical/sitemap output for a sample of locale-paired URLs
- [ ] T261 Complete the production readiness checklist in `docs/deployment.md`, explicitly covering: **project structure**, **dependency installation**, environment variables, database/Storage setup, admin account creation, product management (including category and homepage-showcase management), bilingual content entry, test order procedure, deployment, domain connection, PWA, responsive (both languages), and security — satisfying every topic Constitution Principle 22 lists by name (remediation finding F5)

**Checkpoint**: ELORA JEWELLERY is live in production, fully bilingual, fully configured, verified, and documented.

---

## Phase 19: Delivery Location Selector

**Goal**: Customers choose a delivery location from exactly the two regions ELORA actually serves
— West Bank and Inside/1948 Areas — never a worldwide selector; admins manage the real,
evolving city/area list with no code change; checkout always prefills from and revalidates
against the live, authoritative location data before any order is created.

**Independent Test**: A shopper opens the location selector, sees only the two approved regions,
searches and selects a city in either language, sees the selection persist across refresh and an
installed-PWA reopen, and completes checkout with it prefilled. An admin deactivates that city;
the same shopper's next checkout attempt (with the stale selection) is rejected with a clear
message and no order is created. An admin adds a brand-new city and it becomes selectable
immediately with no deploy.

> **Execution-order note**: these tasks are numbered sequentially after the prior 261 tasks so no
> already-approved task ID had to change, but they do **not** all execute at the end of the
> project. In actual build order: T262–T270 (schema/Firestore/seed/service) run alongside
> **Phase 3**; T271–T276 (`LocationSelector` UI + persistence) run alongside **Phase 4**;
> T277–T281 (checkout integration) run alongside **Phase 8**, after T088/T123/T124/T125 exist;
> T282–T285 (admin management) run alongside **Phase 10**, after T142/T155/T156 exist; T286 runs
> alongside **Phase 16**, after T227 exists; T287–T289 run alongside Phases 11/12/15; T290–T291 run
> alongside Phase 17. This is the same higher-numbered-task-serves-an-earlier-phase pattern already
> used for T093/T162 elsewhere in this document.

### Data model, seed & services

- [ ] T262 [P] Define the `DeliveryRegion` Zod schema (`regionId` restricted to exactly the two fixed values `west-bank`/`inside-1948`, bilingual `name`, `displayOrder`, `isActive`) in `src/lib/validation/deliveryRegion.schema.ts` (data-model.md, spec FR-086)
- [ ] T263 [P] Define the `DeliveryLocation` Zod schema (`locationId`, `regionId` reference, bilingual `name`, `slug`, bilingual `searchTerms`, `displayOrder`, `isActive`) in `src/lib/validation/deliveryLocation.schema.ts` (data-model.md, spec FR-089)
- [ ] T264 Implement `deliveryRegions/{regionId}` and `deliveryLocations/{locationId}` Firestore converters in `src/lib/firebase/firestore.ts`
- [ ] T265 Implement the transactional per-region location-slug uniqueness check (read-check-then-write) and bilingual `searchTerms` token generation — reusing the exact bilingual product-search-token pattern (research.md §17a) — in `src/lib/domain/delivery/deliveryLocation.service.ts` (research.md §44, data-model.md "Uniqueness without unique indexes")
- [ ] T266 Implement the fixed-region validation helper (`regionId` MUST be one of the two deterministic values, never a fresh/auto-generated one) in `src/lib/domain/delivery/deliveryLocation.service.ts`, reused by both the admin region-update action (T282) and checkout revalidation (T277) (depends on T265; research.md §40)
- [ ] T267 [P] Extend `firestore.indexes.json` with `deliveryLocations: regionId+isActive+displayOrder` and `isActive+displayOrder`, and `deliveryRegions: isActive+displayOrder`; deploy (extends T050)
- [ ] T268 Extend `scripts/seed.ts` (T052) to seed the two fixed `deliveryRegions` documents (bilingual names) and an illustrative starting `deliveryLocations` list per region — explicitly dev/test-only, not the final shipping coverage (spec Assumptions)
- [ ] T269 [P] Unit test: `DeliveryRegion` schema rejects any `regionId` outside the two fixed values; `DeliveryLocation` schema requires a `regionId` referencing one of them in `tests/unit/delivery-region-schema.test.ts`
- [ ] T270 [P] Unit test: location `searchTerms` generation mirrors bilingual product search-token behavior; the per-region slug uniqueness check rejects a duplicate slug within the same region but allows the same slug text in the other region in `tests/unit/delivery-location-service.test.ts`

### Selector UI & persistence

- [ ] T271 Implement the location-selection persistence cookie helper — mirrors the existing `NEXT_LOCALE` cookie pattern (research.md §36) — in `src/lib/domain/delivery/location-cookie.ts` (research.md §41)
- [ ] T272 Build the `LocationSelector` trigger (shows the currently selected city, or a "Select delivery location" prompt) in the desktop Navbar and the mobile hamburger menu, in `src/components/storefront/LocationSelector.tsx` (depends on T057, T061)
- [ ] T273 Build `LocationSelectorDialog` — a polished modal on desktop, a full-height/bottom-sheet drawer on mobile — listing exactly the two regions, each with its active locations, using the shared `Dialog` primitive (T008) in `src/components/storefront/LocationSelectorDialog.tsx` (spec FR-087, FR-097)
- [ ] T274 Implement bilingual live search inside `LocationSelectorDialog` (matches `searchTerms` in the active locale) in `src/components/storefront/LocationSelectorDialog.tsx` (depends on T273, T265; spec FR-088)
- [ ] T275 Wire location selection to the persistence cookie (T271) and, for a signed-in customer, to `updateProfileAction` (T134) to sync `profile.address.regionId`/`locationId` (spec FR-090)
- [ ] T276 Mount `LocationSelector` in the `[locale]` storefront layout (depends on T027, T272)

### Checkout integration

- [ ] T277 Implement server-side delivery-location revalidation (region match + `isActive === true`, checked against **live** `deliveryLocations` data) inside the order-creation transaction (extends T123), aborting the entire transaction with no order created if the check fails, in `src/lib/domain/orders/order.service.ts` (spec FR-092–FR-093, data-model.md "Authoritative delivery-location revalidation")
- [ ] T278 Extend `submitCheckoutAction` (T124) to surface a clear, localized "location not currently supported" field-level error when T277 rejects, in `src/actions/checkout.actions.ts`
- [ ] T279 Build the checkout region/city prefill-and-review control — reads the persisted selection (T271), lets the customer reopen `LocationSelectorDialog` (T273) to change it before submitting — in `src/app/[locale]/(storefront)/checkout/page.tsx` (depends on T125, T271, T273; spec FR-091)
- [ ] T280 Implement the bilingual `delivery.regionName`/`delivery.locationName` snapshot capture — mirrors `OrderItem.productName` — inside the order-creation transaction (extends T123/T277; data-model.md)
- [ ] T281 Build the order-confirmation and order-history/detail delivery-location display (the bilingual **snapshot**, never a live re-lookup) on T126/T137/T138

### Admin management

- [ ] T282 Implement `updateDeliveryRegionAction` (admin-only; `regionId` MUST be one of the two fixed values via T266, rejects any other; updates bilingual `name`/`isActive`/`displayOrder` only — never creates or deletes a region) in `src/actions/admin/delivery-location.actions.ts` (contracts/server-actions.md, "Admin — Delivery Locations")
- [ ] T283 Implement `createDeliveryLocationAction`, `updateDeliveryLocationAction`, and `deleteDeliveryLocationAction` (admin-only; slug/searchTerms via T265; delete never touches historical order snapshots, T280 — admins are encouraged to deactivate instead) in `src/actions/admin/delivery-location.actions.ts`
- [ ] T284 Build `/admin/locations` — the two fixed regions (relabel/reorder only) plus, per region, add/edit (using `BilingualField`, T142)/activate-deactivate/reorder for its cities — in `src/app/admin/locations/page.tsx` (spec FR-094)
- [ ] T285 [P] Unit test: `updateDeliveryRegionAction` rejects an unknown `regionId`; `createDeliveryLocationAction`/`updateDeliveryLocationAction` reject a `name` missing `en` and a duplicate slug within the same region in `tests/unit/delivery-location-management.test.ts`

### Security, responsive, PWA & accessibility

- [ ] T286 Add the `deliveryRegions`/`deliveryLocations` rows (public read; admin-SDK-only write, region-ID-restricted) to the Firestore Security Rules (extends T227) in `firestore.rules` (research.md §22)
- [ ] T287 Verify `LocationSelectorDialog` (T273) is fully responsive across the Phase 11 device matrix — polished modal on desktop, touch-friendly full-height/bottom-sheet drawer on mobile, no horizontal overflow (extends T180–T188; spec FR-097)
- [ ] T288 Verify `LocationSelector`/`LocationSelectorDialog` accessibility — accessible dialog semantics, keyboard navigation, a labeled search input, correct focus trapping/return, and screen-reader-announced selected-state feedback — alongside the Phase 15 accessibility audit (extends T222; spec FR-096)
- [ ] T289 Verify `LocationSelector`/`LocationSelectorDialog` work correctly in installed-PWA standalone mode, and that a previously-selected location visible while offline is never trusted for order creation without the online revalidation in T277 (extends T200; research.md §43)

### Tests

- [ ] T290 [P] Playwright test: only the two approved regions are ever shown, bilingual search/select works, the selection persists across navigation/refresh/installed-PWA reopen, checkout prefills and allows changing the location, an unsupported/deactivated location is rejected server-side with no order created, and an admin can manage the location list with no code change (quickstart Scenario 14) in `tests/e2e/delivery-location.spec.ts`
- [ ] T291 Run the complete quickstart.md validation pass including Scenario 14 and record results (extends T249)

**Checkpoint**: Only the two approved regions are ever offered; the city/area list within each is
fully admin-manageable; every order's delivery location is server-side-revalidated at creation
time; and the selector works responsively, offline-safely, and accessibly across the whole app.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundation, incl. i18n routing)**: no dependencies — start immediately.
- **Phase 2 (Auth)**: depends on Phase 1. Blocks every later phase that needs a session.
- **Phase 3 (Product Data, Categories & Showcases)**: depends on Phase 1 (can run in parallel with Phase 2). Blocks Phases 4, 5, 10.
- **Phase 4 (Storefront browsing + showcases + Navbar + Footer, US1)**: depends on Phases 2 + 3.
- **Phase 5 (Inventory & SOLD OUT)**: depends on Phase 4 (needs `ProductCard`/detail page/showcase strip to render badges) and Phase 3 (product schema).
- **Phase 6 (Cart, US1)**: depends on Phase 5 (stock validation) and Phase 2 (guest/registered session).
- **Phase 7 (Wishlist, US3)**: depends on Phase 2 (auth) and Phase 4 (`ProductCard`).
- **Phase 8 (Checkout & Orders, US1)**: depends on Phases 5 + 6.
- **Phase 9 (Customer Account, US2)**: depends on Phase 8 (orders must exist to show history).
- **Phase 10 (Admin Dashboard, US4/US5)**: depends on Phases 2, 3, 5, 8 (order-status machine needs orders to exist).
- **Phase 11 (Responsive, incl. RTL verification)**: depends on Phases 4, 6, 8, 10.
- **Phase 12 (PWA, US6)**: depends on Phase 11 (responsive foundation) and Phase 1 (logo/design tokens).
- **Phase 13 (Instagram/WhatsApp)**: depends on Phase 4 (Navbar + Footer) and Phase 12 (PWA install prompt) — both earlier phases, no forward dependency.
- **Phase 14 (Content Pages)**: depends on Phase 4 (Footer shell exists).
- **Phase 15 (SEO/Accessibility/Performance, incl. hreflang)**: depends on Phases 4, 8, 10.
- **Phase 16 (Security)**: depends on Phases 2, 3, 6, 8, 10.
- **Phase 17 (Testing/CI, incl. bilingual matrix)**: depends on every functional phase whose scenarios it exercises (4–14); run continuously, finalized last.
- **Phase 18 (Deployment)**: depends on all prior phases being complete and Phase 17's quickstart pass succeeding.
- **Phase 19 (Delivery Location Selector)**: numbered last for ID stability only; its sub-groups
  actually interleave with Phases 3/4/8/10/11/12/15/16/17 as detailed in Phase 19's own
  execution-order note above. Phase 18 (Deployment) also depends on Phase 19 being complete, since
  quickstart Scenario 14 is part of the Phase 17 validation pass Phase 18 requires.

**Forward-dependency check**: every task above references only task IDs lower than its own, or
tasks in an earlier-numbered phase, with the sole exception of a small number of clearly-marked
**informational** forward-pointers (e.g., "this is built on later by T162") that do not gate the
earlier task's own completion — the same pattern already accepted in the prior
`/speckit-analyze` remediation pass.

### Story Dependencies

- **US1** (Phases 4, 5, 6, 8): the MVP path — no dependency on any other story.
- **US2** (Phase 9): depends on US1 existing.
- **US3** (Phase 7): depends on Phase 2 (auth) and Phase 4 (`ProductCard`).
- **US4** (Phase 10 product/category/showcase management): depends on Phase 3 and Phase 2 (admin auth).
- **US5** (Phase 10 orders/customers/dashboard): depends on US1 (orders) and US2 (customers).
- **US6** (Phase 12): depends on Phase 11 (responsive) and the whole storefront being feature-complete.
- **US7** (bilingual — Phase 1 foundation, then threaded through every phase): the routing/RTL
  foundation (Phase 1) blocks every storefront page from Phase 4 onward; bilingual *content*
  (products/categories/showcases) depends on Phase 3; bilingual *testing* (Phase 17) depends on
  every flow it parameterizes already existing.
- **US8** (Delivery Location Selector — Phase 19, no `[Story]` label used since it is a
  cross-cutting capability threaded through catalog-adjacent, checkout, and admin work rather than
  one isolated page group): depends on Phase 1 (i18n foundation, for bilingual search/labels),
  Phase 2 (auth, for the optional profile association), and Phase 3 (Firestore/seed patterns it
  reuses); its checkout sub-group depends on Phase 8 existing; its admin sub-group depends on
  Phase 10's `BilingualField`/category-management pattern existing.

### Parallel Opportunities

- All `[P]`-marked tasks within Phase 1 (T002–T008, T015–T018, T020–T022, T025, T028).
- Within Phase 3: T053–T056.
- Within Phase 4: T079 alongside other unit-test-only work; most UI-building tasks are sequential (shared files).
- Within Phase 10: T157, T161, T173, T174 in parallel with each other.
- Across phases once their dependencies are met, **US3 (Wishlist, Phase 7)** and **US4 (Admin
  Products/Categories/Showcases, Phase 10's first three sub-sections)** can proceed in parallel
  with each other and with Phase 6/8.
- Phase 13 (Instagram/WhatsApp), Phase 14 (Content Pages), and Phase 15 (SEO) touch mostly
  disjoint files and can be staffed in parallel once Phase 4 (and, for Phase 13, Phase 12) is
  done.
- Within Phase 17, the bilingual/RTL-specific Playwright specs (T240, T242, T244–T248) can be
  written in parallel with the English-only equivalents (T239, T241) once the flows they
  parameterize exist.
- Within Phase 19: T262–T263 in parallel with each other; T267, T269, T270, T285, T290 in parallel
  with sibling tasks in their own sub-groups. T282–T285 (admin location management) can proceed in
  parallel with T277–T281 (checkout integration) once T265/T266 exist, since they touch disjoint
  files.

---

## Parallel Example: Phase 1 Setup

```bash
Task: "Install and configure Tailwind CSS in tailwind.config.ts"
Task: "Configure ESLint/Prettier for the project"
Task: "Define ELORA design tokens in src/app/globals.css"
Task: "Configure typography via next/font in src/app/globals.css"
Task: "Add official logo asset + Logo component in src/components/ui/Logo.tsx"
Task: "Build Button, Input, Card, Badge in src/components/ui/"
Task: "Create messages/en.json and messages/ar.json skeletons"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Foundation, incl. i18n routing foundation) and Phase 2 (Auth).
2. Complete Phase 3 (Product Data, Categories & Showcases).
3. Complete Phase 4 (Storefront browsing + showcases + Navbar/Footer), Phase 5 (Inventory & SOLD OUT), Phase 6 (Cart), Phase 8 (Checkout & Orders) — this is the full US1 slice, already bilingual-ready because Phase 1 established the routing/RTL foundation first.
4. **STOP and VALIDATE**: run quickstart.md Scenario 1/1b/8/12 end to end (English by default).
5. This is a demoable MVP: a guest can browse (including the showcases), buy, and receive a confirmed order.

### Incremental Delivery

1. Foundation (incl. i18n) + Auth + Product Data ready.
2. Add US1 (Phases 4/5/6/8) → validate (English) → demo (MVP).
3. Add US2 (Phase 9) → validate → demo.
4. Add US3 (Phase 7) → validate → demo.
5. Add US4 + US5 (Phase 10, incl. category and showcase management) → validate → demo.
6. Add Phase 11 (Responsive, incl. RTL), Phase 12 (PWA/US6), Phase 13 (Instagram/WhatsApp), Phase 14 (Content Pages) → each independently validated, in that order.
7. Validate the full bilingual/RTL experience end-to-end (quickstart Scenario 13) once Phases 4–14 are complete.
8. Finish with Phase 15 (SEO/A11y/Perf), Phase 16 (Security), Phase 17 (Testing/CI, incl. bilingual matrix), Phase 18 (Deployment).

### Parallel Team Strategy

1. Team completes Phases 1–3 together (hard blocker for everyone) — Phase 1 explicitly includes the i18n routing foundation so no one builds a non-locale-prefixed page by mistake.
2. Once Phase 3 is done: Developer A takes Phase 4→5→6→8 (US1, the critical path); Developer B starts Phase 10's product/category/showcase-management sub-sections as soon as Phase 3 lands.
3. Once US1 lands: Developer C takes Phase 9 (US2) and Phase 7 (US3) in parallel; Developer B finishes Phase 10's order/customer half (US5).
4. Phase 11 (Responsive+RTL) needs Phases 4/6/8/10; Phase 12 (PWA) needs Phase 11; Phase 13 (Instagram/WhatsApp) needs Phase 12 — largely sequential for one developer, but Phase 14 (Content) and Phase 15 (SEO) can run in parallel with Phase 12/13 once Phase 4 is done.
5. Phase 16 (Security) can start as soon as Phases 2/3/6/8/10 land, in parallel with Phases 11–15.
6. Phase 17 (Testing/CI) and Phase 18 (Deployment) are completed by whoever is free last, gated on everything above.

---

## Notes

- `[P]` tasks touch different files with no dependency on an incomplete task.
- `[Story]` labels trace every user-story task back to spec.md's User Story 1–7.
- Foundational (Phases 1–3) and cross-cutting (Phases 11, 13, 14, 15, 16, 17, 18) phases carry no `[Story]` label by design.
- Commit after each task or logical group; stop at any phase checkpoint to validate independently.
- No task in this list reintroduces MongoDB, Mongoose, MongoDB Atlas, Auth.js/NextAuth, Cloudinary, or chocolate-brown/rose-gold branding — verified against research.md's explicit migration/palette decisions.
- **This revision's additions**: homepage category showcases (data-model.md `categoryShowcases`, tasks T046, T051, T063–T064, T068, T158–T160, T177) and complete Arabic/English bilingual support (i18n routing foundation T023–T028; `LocalizedString` shape and bilingual schemas T043–T046; locale-prefixed storefront routes throughout Phase 4 onward; bilingual admin editing T142, T151–T152, T156, T160; bilingual order snapshot T123, T130; localized SEO T218–T219; bilingual testing matrix T240, T242, T244–T248) are additive — no previously-approved requirement, route, or architecture decision was removed or weakened.
- **Latest revision's addition**: a customer delivery-region/location selector strictly limited to
  ELORA's two real service regions (Phase 19, T262–T291) — deterministic two-region enforcement
  (T262, T266), an open-ended admin-manageable location list (T263–T265, T282–T285), a
  `LocationSelector` UI with bilingual search and persistence (T271–T276), authoritative
  server-side checkout revalidation folded into the existing order-creation transaction rather
  than a separate one (T277, T280, extending T123), and Firestore Security Rules for the two new
  collections (T286, extending T227). Existing tasks T118, T124, T125, T134, and T227 were edited
  in place — same task IDs — to fold in the new `regionId`/`locationId` fields; no other
  previously-approved task, route, or architecture decision was removed or weakened.
