# Specification Quality Checklist: Core Commerce Experience

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-26
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — both resolved: FR-031a (guest checkout is
      supported), FR-033a (guest wishlist prompts sign-in/registration)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- All quality gates pass. Spec is ready for `/speckit-plan`.
- 2026-08-26: Added explicit inventory/Sold Out requirements (FR-015a, FR-016a, FR-024, FR-026,
  FR-036a, FR-036b, FR-038, FR-046, SC-006/SC-006a) — no new [NEEDS CLARIFICATION] markers
  introduced; all gates re-checked and still pass.
- 2026-08-26: Replaced core categories (Necklaces/Earrings/Bracelets/Rings →
  Bracelets/Rings/Earrings/Watches) and added dedicated category-page/switcher requirements
  (FR-007a–FR-007d, FR-036c, FR-046a, SC-011) — no new [NEEDS CLARIFICATION] markers introduced;
  all gates re-checked and still pass.
- 2026-08-26: Strengthened mobile-first/responsive requirements into concrete, testable rules
  across the whole storefront and Admin Dashboard (FR-050–FR-050h, SC-008/SC-008a) — no new
  [NEEDS CLARIFICATION] markers introduced; all gates re-checked and still pass.
- 2026-08-26: Added installable Progressive Web App requirements (User Story 6, FR-053–FR-065,
  SC-012–SC-014) — manifest, official-logo-only iconography, security-critical caching allowlist
  (never authoritative commerce data), offline fallback, platform-adaptive install UX (including
  accurate iOS limitations), and PWA testing (Playwright + Lighthouse). No new
  [NEEDS CLARIFICATION] markers introduced; all gates re-checked and still pass.
- 2026-08-26: Added direct Instagram/WhatsApp contact requirements — navbar, footer, and floating
  WhatsApp button (FR-002/FR-003/FR-006/FR-006a–FR-006h, SC-015/SC-016), all reading one
  centralized configuration (no scattered/hardcoded URLs or phone numbers), with safe external
  linking, PWA-standalone-safe handoff, brand-consistent (non-default-green) WhatsApp iconography,
  and fail-safe behavior when unconfigured. No new [NEEDS CLARIFICATION] markers introduced; all
  gates re-checked and still pass. (Also fixed a structural defect from the prior PWA revision:
  research.md §22's closing Rationale/Alternatives-considered bullets had been displaced to the
  end of the file — restored to their correct position under §22.)
- 2026-08-26: `/speckit-analyze` remediation — applied fixes for findings F1–F6 to `tasks.md`,
  `plan.md`, and `contracts/server-actions.md` (task-ordering fix reordering Phases 4/12/13;
  explicit `availability` toggle naming; new `updateCategoryAction` + `/admin/categories`;
  plan.md legal routes; documentation-task wording; order-status cross-reference). `tasks.md`
  renumbered T001–T233 (net −1 after removing one redundant, forward-referencing task whose
  content was already covered elsewhere). No spec.md changes were required — all six findings
  were planning/task-artifact issues, not specification gaps.
- 2026-08-26: Added two approved feature areas — (1) four large, full-width, admin-maintainable
  homepage category showcases with category-scoped, Sold-Out-aware featured-product strips (User
  Story added implicitly via FR-001a–FR-001f; new `categoryShowcases` Firestore collection,
  SC-017); (2) complete Arabic/English bilingual support across storefront, checkout, account,
  PWA, and relevant admin content-management interfaces (new User Story 7, FR-066–FR-085,
  SC-018–SC-020) — locale-prefixed routing, RTL/LTR, a new `LocalizedString` field shape on
  products/categories/showcases/order-item-snapshots, with every identifier/slug/price/stock/
  status kept language-independent. No new [NEEDS CLARIFICATION] markers introduced; all gates
  re-checked and still pass. `plan.md`, `research.md`, `data-model.md`, `contracts/
  server-actions.md`, `quickstart.md`, and `tasks.md` were updated accordingly.
- 2026-08-26: Added a customer delivery-region/location selector strictly limited to ELORA's two
  actual service regions — West Bank and Inside/1948 Areas, never a worldwide country selector
  (new User Story 8, FR-086–FR-098, SC-021–SC-023). The two-region limit is enforced structurally
  via fixed Firestore document IDs, not an editable list, while the city/area list within each
  region is fully admin-manageable (new `deliveryRegions`/`deliveryLocations` Firestore
  collections). Checkout now collects `regionId`/`locationId` (replacing free-text `city`) and the
  order-creation transaction re-verifies the selection against live location data before any order
  is created; an unsupported/deactivated location can never silently complete checkout. Bilingual
  search, language-independent identifiers, persistence (guest cookie + registered-profile
  association), responsive/PWA behavior, an explicit offline-revalidation rule, and admin
  management were all specified. No new [NEEDS CLARIFICATION] markers introduced; all gates
  re-checked and still pass. `plan.md`, `research.md`, `data-model.md`, `contracts/
  server-actions.md`, `quickstart.md`, and `tasks.md` were updated accordingly.
- 2026-08-27: Added an admin-only Excel (.xlsx) export/reporting feature (new User Story 9,
  FR-099–FR-112, SC-024–SC-026) covering Orders, Products, Inventory/Stock, Customers, Sales,
  Best-Selling Products, SOLD OUT Products, and Delivery Locations, each generated server-side via
  the Firebase Admin SDK from live Firestore data. Cloud Firestore remains the sole authoritative
  data store; the exported file is explicitly specified as a read-only, point-in-time report,
  never a second data store, with no Excel **import** path — editing or re-uploading a downloaded
  file has zero effect on Firestore (FR-110). Export is restricted to authenticated administrators
  only, enforced server-side identically to every other admin-only operation (FR-101), and never
  exposes Firebase Admin SDK credentials to the client (FR-111). No new [NEEDS CLARIFICATION]
  markers introduced; all gates re-checked and still pass. `plan.md`, `research.md`,
  `data-model.md`, `contracts/server-actions.md`, `quickstart.md`, and `tasks.md` were updated
  accordingly.
- 2026-08-27: Added full Special Offers / promotional-pricing support (new User Story 10,
  FR-113–FR-125, SC-027–SC-029), resolving the previously-documented Special Offers planning gap
  (this file's prior notes; tasks.md's Phase 20 revision note). A product's sale price, enabled
  flag, and optional start/end dates drive a derived four-state offer status
  (Disabled/Scheduled/Active/Expired) computed the same way everywhere — mirroring the existing
  Sold Out derivation pattern (FR-115) — rather than a separately-set status field that could drift
  out of sync. A real, live-Firestore-sourced homepage Special Offers section, consistent
  crossed-out-regular/sale-price display across Home/Shop/category/detail/Quick View, and
  authoritative server-side price recalculation at cart/checkout time (never a client-submitted or
  session-cached price) are all specified. Sold Out/inventory rules are explicitly unaffected
  (FR-122); admin offer management is explicitly admin-only, enforced server-side (FR-123); the
  existing historical order-price-snapshot guarantee is explicitly preserved (FR-121); Special
  Offers fields are added to the Excel export requirement (FR-124, extending FR-099–FR-112). The
  Collection entity's description is clarified: New Arrivals, Best Sellers, and now Special Offers
  are each a derived query over `Product` fields, not a separate curated-membership mechanism — no
  generic `collections` entity is required for any of the three. No new [NEEDS CLARIFICATION]
  markers introduced; all gates re-checked and still pass. `plan.md`, `research.md`,
  `data-model.md`, `contracts/server-actions.md`, `quickstart.md`, and `tasks.md` were updated
  accordingly.
- 2026-08-27: `data-model.md` was accidentally destroyed (overwritten) during the Special Offers
  planning pass above and has been fully reconstructed from current project artifacts (types, Zod
  schemas, Firestore converters, `spec.md`, `research.md`, `tasks.md`, `firestore.indexes.json`,
  and completed Phase 1–6 implementation) per explicit instruction, without relying on OneDrive
  version recovery. Every entity is either verified directly against implemented code or
  reconstructed from unambiguous descriptions elsewhere in the approved planning artifacts; the
  small number of details that could not be pinned down with confidence (the exact `WishlistItem`
  shape, and the exact `Order.customer`/`delivery` field split for `email`/`notes`) are explicitly
  flagged inline in `data-model.md` rather than guessed, to be confirmed when Phases 7/8 are
  implemented. The Special Offers remediation's foundational code (Product schema/type/converter,
  `getOfferStatus`/`getEffectivePrice` derivation, composite index definition, unit tests) was
  implemented directly as part of this recovery pass, with `contracts/server-actions.md` updated
  to document the extended `createProductAction`/`updateProductAction` inputs and the checkout
  transaction's authoritative effective-price recomputation — `tasks.md` Phase 21 (T314–T333)
  tracks the remaining display/cart/checkout/admin/export/e2e work. No new [NEEDS CLARIFICATION]
  markers introduced; all gates re-checked and still pass. Phases 1–6 implementation, and all
  previously completed task markers, remain untouched.
- 2026-08-27: Completed the Special Offers implementation buildable against Phases 1–6 (tasks.md
  T320–T325, T327, T330 — Home Special Offers section, consistent crossed-out/sale pricing across
  Home/Shop/category/detail/Quick View, Special-Offers-aware cart pricing, Sold-Out-overrides-offer,
  and a standalone admin-only offer-management page/action). 124 unit/integration tests pass
  (15 correctly skip without a running Firestore emulator); `tsc`, `eslint`, and `next build` are
  all clean. T326 (order-creation transaction), T328–T329 (Phase 10's own admin product
  forms/actions), and T331 (Excel export) remain open because they depend on Phase 8/Phase
  10/Phase 20 infrastructure that doesn't exist yet — a scoped-down standalone equivalent was built
  where reasonable (a pricing-resolution primitive for the future order-creation transaction; a
  narrow offer-only admin Server Action/page) rather than building those entire future phases early.
  T332/T333 (integration/E2E tests) are written and structurally verified but could not be executed
  in this environment because its sandbox network policy blocks the Firebase Local Emulator Suite's
  required download — an environment limitation, not a code or test defect. No new [NEEDS
  CLARIFICATION] markers introduced; all gates re-checked and still pass. Phase 7 was not started.
- 2026-08-27: Completed Phase 7 (Wishlist, tasks.md T109–T116; spec User Story 3, FR-032–FR-033a).
  `data-model.md`'s `wishlists/{uid}` entity is now permanently resolved (`WishlistItem` = `{
  productId, selectedOption, addedAt }`, mirroring `CartItem`'s option shape exactly; no quantity/
  price/stock/availability ever stored — always read live, Special-Offers-aware, from
  `products/{productId}`). Registered-customer-only, with no guest wishlist ever created; a guest's
  intended add is preserved via a `/login?intent=wishlist:...` redirect and completed automatically
  by `createSessionAction` right after sign-in. Move to Cart re-validates live availability/stock/
  Sold-Out and never removes an item it failed to move. Customer isolation is enforced by always
  deriving the Firestore path from the verified session's own `uid`, matching the existing
  `carts/{uid}` pattern; no new Firestore Security Rules were added (Phase 16 adds them uniformly
  for every collection). 152 unit tests pass; `tsc`/`eslint`/`next build` are clean. The Playwright
  spec (T117) is written and structurally verified but could not be executed in this sandboxed
  environment (same Firebase emulator network-download limitation as T332/T333). No new [NEEDS
  CLARIFICATION] markers introduced; all gates re-checked and still pass. Phase 8 was not started.
- 2026-08-27: Completed Phase 8 (Checkout & Orders, tasks.md T118–T132; spec User Story 1). The
  previously-noted Firebase Local Emulator Suite network block turned out to be transient in this
  environment — it was reachable this session — so Phase 8 (and, incidentally, the previously-
  blocked T117/T332) were verified against a real, live emulator and a running `next dev` server:
  174 unit tests, 24 integration tests, and 7 new Playwright e2e tests all pass, including 9
  integration tests exercising the real `createOrder` order-creation transaction end to end
  (authoritative pricing/stock/Special-Offers-integration, Sold Out/insufficient-stock/invalid-
  location rejection, concurrent last-unit protection) and 7 Playwright tests covering guest and
  registered COD checkout, mandatory-phone-number validation, and stock-changed-mid-checkout
  rejection. Delivery region/location data (types, Zod, Firestore converters, seed data) was pulled
  forward from Phase 19 as this phase's own prerequisite — checkout cannot collect a real region/
  city without it — while Phase 19's own polished selector UI remains unbuilt. The `Order` document
  uses `customerSnapshot`/`deliverySnapshot` field naming with a mandatory phone number and email;
  `OrderItem` snapshots carry `originalPrice`/`wasOnSale` so a historical sale purchase is
  identifiable without ever trusting live `Product` data for a past order. A guest-order-
  confirmation access control (a signed, short-lived cookie, mirroring `guest-cart.ts`) ensures a
  sequential, guessable order number can never be used to view another customer's order details. No
  new [NEEDS CLARIFICATION] markers introduced; all gates re-checked and still pass. Phase 9 was not
  started.
- 2026-08-27: Completed Phase 9 (Customer Account, tasks.md T133–T141; spec User Story 2). A
  registered customer can view/update her profile (name, phone, and an optional saved delivery
  address using the same region→city cascade as checkout) and see her order history and full order
  detail, both strictly scoped to her own `uid`. `getOrdersForCustomer`/`getOrderForCustomer` never
  surface another customer's order or a guest order (`userId: null`) — verified against real
  Firestore and live end-to-end via a genuine cross-customer isolation test (a guessed order number
  from another registered customer's account returns "not found," never leaking existence). Order
  status is always read live from Firestore as its language-independent enum value, with only the
  display label sourced from the message catalog — confirmed live by writing a status change
  directly to Firestore (simulating an admin transition, since Phase 10's admin UI doesn't exist
  yet) and observing the customer's order-history and detail pages reflect it after a reload, with
  no stale value. The order-confirmation page (Phase 8) and the new account order-detail page now
  share one rendering component so the two can never show inconsistent content for the same order.
  193 unit tests, 28 integration tests, and 7 new Playwright e2e tests all pass; `tsc`/`eslint`/
  `next build` are clean. No new [NEEDS CLARIFICATION] markers introduced; all gates re-checked and
  still pass. Phase 10 was not started.
