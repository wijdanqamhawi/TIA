# Contracts: Server Actions

**Revision note (2026-08-26)**: Updated for the Firebase migration. Action signatures and
business behavior are unchanged from the original contract; only the underlying identity/session
mechanism (Firebase Authentication + Admin SDK session cookies, replacing Auth.js) and data store
(Cloud Firestore via the Admin SDK, replacing Mongoose) are updated, per research.md.

Server Actions are the primary mutation interface for this application (per user directive:
"Prefer Server Actions for application mutations where appropriate"). Every action listed here:

- Re-validates its input server-side with the corresponding Zod schema from `lib/validation/`,
  regardless of any client-side validation already performed (Constitution Principle 13).
- Re-checks authentication/authorization server-side before doing any work, by verifying the
  Firebase session cookie via the Firebase Admin SDK and, for admin actions, checking the
  `role === "ADMIN"` custom claim on the decoded token — never trusting a client-supplied uid or
  role (Constitution Principle 6, research.md §8–9).
- Performs all Firestore reads/writes through the Firebase Admin SDK — no client Firestore SDK
  usage for business data (research.md §2, §22).
- Returns a discriminated result shape so the UI can render success/error states without throwing
  across the server/client boundary for expected validation failures:
  `{ ok: true, data: T } | { ok: false, error: { code: string, message: string, fieldErrors?: Record<string,string[]> } }`.
- Never returns internal error detail (stack traces, Firestore/Admin SDK error codes) — only a
  safe `message` (Constitution Principle 15).

## Auth

| Action | Input | Behavior |
|---|---|---|
| `createSessionAction` | `{ idToken, intent?: string }` | Client-side Firebase Auth SDK has already completed sign-in or sign-up and obtained a Firebase ID token; this action verifies it via the Admin SDK, mints a Firebase session cookie (`auth.createSessionCookie`), and sets it `httpOnly`/`Secure`. If `intent` is `wishlist:<productId>` or `wishlist:<productId>:<optionKey>:<valueKey>`, re-validates the product/option still exist and performs that wishlist add (a stale intent is silently ignored, never surfaced as a sign-in error); if a guest cart cookie exists, merges it (research.md §6). Neither ever fails the sign-in itself if it errors. Used by both `/login` and `/register` after the client SDK step completes (registration additionally creates the `users/{uid}` Firestore document with `role: "CUSTOMER"` on first sign-up). |
| `logoutAction` | *(none)* | Clears the session cookie; optionally calls `auth.revokeRefreshTokens(uid)` when a full server-side session invalidation is desired (e.g., "sign out everywhere"). |

## Account

| Action | Input | Behavior |
|---|---|---|
| `updateProfileAction` | `{ name, phone?, address?: { regionId, locationId, addressLine, notes? } }` | Requires a verified session cookie (returns `{ ok: false, error: { code: "UNAUTHENTICATED" } }` otherwise); validates via `profileSchema`/`profileAddressSchema` (`regionId`/`locationId`, if `address` is present, validated the same way as checkout's — spec FR-092); updates the caller's own `users/{uid}` Firestore document only (`uid` taken from the verified session, never accepted as client input) — writes only `name`/`phone`/`profile.address`, never `email` (Firebase-Auth-owned) or `role` (server-managed only). Omitting `address` clears any previously-saved one. |
| `loadMoreOrdersAction` | `{ cursorId: string \| null }` | Requires a verified session cookie (returns an empty page otherwise, never another customer's data); returns the next page of the caller's own order history (`getOrdersForCustomer`, `userId == <verified session's own uid>` only) as serializable `OrderSummary`s (no Firestore `Timestamp`s) for the order-history page's "Load More" control. |

## Cart

| Action | Input | Behavior |
|---|---|---|
| `addCartItemAction` | `{ productId, selectedOption?: { optionKey, valueKey }, quantity }` | Validates via `cartItemSchema` (`quantity` a positive integer; `selectedOption`, if present, references a real `optionKey`/`valueKey` on the product — never a localized label string, data-model.md); resolves the caller's cart document (`carts/{uid}` for a registered session, or `guestCarts/{guestCartId}` — creating one and setting the cookie if absent); loads the authoritative `products/{productId}` document; rejects if hidden (`availability === false`), Sold Out (`stock === 0`), or `quantity` exceeds current `stock`; upserts the line. Behaves identically regardless of the caller's selected language. |
| `updateCartItemQuantityAction` | `{ productId, selectedOption?: { optionKey, valueKey }, quantity }` | Same stock/Sold-Out re-validation as `addCartItemAction`; `quantity <= 0` removes the line. |
| `removeCartItemAction` | `{ productId, selectedOption?: { optionKey, valueKey } }` | Removes the matching line. |

## Wishlist (registered customers only)

| Action | Input | Behavior |
|---|---|---|
| `addWishlistItemAction` | `{ productId, selectedOption?: { optionKey, valueKey } }` | Requires a verified session cookie (returns `{ ok: false, error: { code: "UNAUTHENTICATED" } }` otherwise); if absent, the caller is expected to have already been redirected to `/login?intent=wishlist:<productId>[:<optionKey>:<valueKey>]` (research.md §7) — the action itself still hard-rejects unauthenticated calls, defense-in-depth. Re-validates the product exists and `selectedOption` (if any) is still real; idempotent — adding an already-wishlisted `productId`+`selectedOption` combination is a no-op, not a duplicate entry. |
| `removeWishlistItemAction` | `{ productId, selectedOption?: { optionKey, valueKey } }` | Requires a verified session cookie; removes the matching item regardless of its current validity (a Sold Out or no-longer-existing product can always be removed). |
| `moveWishlistItemToCartAction` | `{ productId, selectedOption?: { optionKey, valueKey } }` | Requires a verified session cookie; re-validates the product/option and current stock/availability/Sold-Out state live from Firestore, sums into an existing matching `carts/{uid}` line (mirrors `addCartItemAction`), then removes the entry from `wishlists/{uid}` — **only on success**. A Sold Out, unavailable, or insufficient-stock product is rejected and **left in the wishlist** (spec: Sold Out items remain visible but cannot move to cart) — the action never removes an item it failed to move. |

## Checkout / Orders

| Action | Input | Behavior |
|---|---|---|
| `submitCheckoutAction` | `{ fullName, phone, regionId, locationId, fullAddress, email, notes?, paymentMethod }` | `phone` and `email` are both **required** (a mandatory mobile phone number is this task's explicit requirement); `notes` is the only optional field. Validates via `checkoutSchema` (`regionId` one of the two fixed values, `locationId` required, research.md §40); resolves the caller's cart (`carts/{uid}` or `guestCarts/{guestCartId}`) — no sign-in required, guest checkout fully supported; executes the full order-creation flow (`createOrder`, data-model.md, research.md §3–4, §42) inside a single Firestore transaction: re-load the authoritative cart and product documents **inside the transaction**, **re-verify every line's existence/availability/selected-option/Sold-Out/stock — even for a line validated when it was originally added to the cart** — **re-verify `regionId`/`locationId` against live `deliveryRegions`/`deliveryLocations` documents (`regionId` matches, `isActive === true`)**, compute authoritative pricing server-side via `getEffectivePrice`/`resolveOfferPricing` against each just-read product — i.e. its current sale price if its derived offer status is `ACTIVE` at this exact moment, otherwise its regular price — never a client-submitted price/total, a cart-cached price, or the price shown when the item was originally added to the cart (data-model.md "Offer status derivation", spec FR-119/FR-121, SC-029), reserve the daily order-number counter, write immutable, **bilingual** `OrderItem` snapshots (`unitPrice`/`originalPrice`/`wasOnSale` so a historical sale purchase is identifiable without trusting live `Product` data) and a **bilingual** `deliverySnapshot.regionName`/`locationName` (all `LocalizedString`s captured as they exist at this moment, data-model.md — independent of which language the shopper is currently browsing in), create the `orders/{orderId}` document with a `customerSnapshot` (`fullName`/`email`/`phone`) and `deliverySnapshot` (`regionId`/`regionName`/`locationId`/`locationName`/`fullAddress`), decrement `Product.stock` and increment `Product.salesCount` for each line, update `stats/summary` (research.md §17b), and clear the cart — all within that one transaction. If any line fails re-validation, or the delivery location is missing/inactive/mismatched, or the cart is empty, the entire transaction is aborted and the action returns `{ ok: false, error }` identifying the affected product or a clear "location not currently supported" message — no partial order is ever created, and the cart is left untouched. Returns `{ ok: true, data: { orderNumber } }` on success for the redirect to `/order-confirmation/[orderNumber]`; for a guest order, also grants a short-lived signed cookie (`guest-order-access.ts`) scoping that browser's access to exactly this order number, so a sequential order number can never be used to view another customer's order. |
| `getDeliveryLocationsForRegionAction` | `{ regionId }` | Read-only; returns the active `deliveryLocations` for the given region (a serializable subset — no Firestore `Timestamp`s) for the checkout form's city/area dropdown to repopulate when the shopper changes region, without a full page reload. |

## Admin — Products

| Action | Input | Behavior |
|---|---|---|
| `createProductAction` | `{ name: LocalizedString, description: LocalizedString, price, categoryId, material: LocalizedString, options?: [{ key, name: LocalizedString, values: [{ key, label: LocalizedString }] }], stock, availability, images, isNewArrival?, isBestSeller?, isOnSale?, salePrice?, saleStartAt?, saleEndAt? }` | Requires the verified session's custom claim `role === "ADMIN"`; validates via `productSchema` (`name.en`/`description.en`/`material.en` required, `.ar` optional per the `LocalizedString` shape, data-model.md; `stock` a non-negative integer, required — may be `0`, which creates the product already Sold Out per FR-015a; `categoryId` required and re-verified server-side to reference an existing `categories/{categoryId}` document — spec FR-007d/FR-036c — never merely trusted from the client form; `salePrice`, when `isOnSale` is set, required, `> 0`, and strictly `< price` — the same `productSchema` refinement rejects an invalid combination server-side regardless of what client-side validation already checked, spec FR-114/SC-027); derives a unique `slug` from `name.en` (transactional slug-conflict check, data-model.md); derives `searchTerms` from both `name.en` and `name.ar` (research.md §17); persists to `products/{productId}`. |
| `updateProductAction` | `{ productId, ...partial productSchema }` | Requires `role === "ADMIN"`; validates changed fields (`stock`, if included, rejected by `productSchema` if negative — increasing or decreasing `stock` is the same action, spec FR-036a; `categoryId`, if included, re-verified server-side to reference an existing category, same as `createProductAction`; `isOnSale`/`salePrice`/`saleStartAt`/`saleEndAt`, if included, re-validated by the same `salePrice < price` refinement — comparing against the newly-submitted `price` if it too is being changed in the same call, otherwise the currently-stored `price` — spec FR-114); re-derives `slug`/`searchTerms` only if `name.en` changed and the new slug doesn't collide. `name`/`description`/`material`/`options[].name`/`options[].values[].label` may each be updated independently per locale (e.g., adding an Arabic translation later doesn't require resubmitting the English text). No separate action exists to set Sold Out — setting `stock` to `0` here is sufficient and automatically makes the product Sold Out on every subsequent read (data-model.md, "Sold Out derivation"); setting it back above `0` automatically clears Sold Out. Likewise, no separate action exists to set the derived offer status (Disabled/Scheduled/Active/Expired) — it is always computed from `isOnSale`/`salePrice`/`saleStartAt`/`saleEndAt` and the current time (data-model.md "Offer status derivation", spec FR-115). |
| `deleteProductAction` | `{ productId }` | Requires `role === "ADMIN"`; deletes the `products/{productId}` document; does not touch any existing order's `items[]` snapshots (data-model.md invariant). |
| `reorderProductImagesAction` | `{ productId, imagePositions: { storagePath, position }[] }` | Requires `role === "ADMIN"`; updates `images[].position`. |
| `removeProductImageAction` | `{ productId, storagePath }` | Requires `role === "ADMIN"`; deletes the object from Firebase Storage via the Admin SDK, then removes it from `products/{productId}.images`. |
| `attachUploadedImageAction` | `{ productId, storagePath, url }` | Requires `role === "ADMIN"`; called after the admin's browser completes a **direct-to-Firebase-Storage** upload (authorized by Storage Security Rules checking the `ADMIN` claim, research.md §11 — no signing Route Handler is needed); validates the payload shape and appends the image to `products/{productId}.images`. |
| `setProductFlagAction` | `{ productId, flag: "isNewArrival" \| "isBestSeller", value: boolean }` | Requires `role === "ADMIN"`. |

## Admin — Categories

*(Added in the `/speckit-analyze` remediation pass, finding F3 — see plan.md's Post-Design Constitution Check for context.)*

| Action | Input | Behavior |
|---|---|---|
| `updateCategoryAction` | `{ categoryId, name?: LocalizedString, description?: LocalizedString, isActive?, displayOrder? }` | Requires `role === "ADMIN"`; validates via `categorySchema` (`name.en` required if `name` is provided; `displayOrder` a non-negative integer if present); updates only the fields provided on `categories/{categoryId}`; re-derives `slug` only if `name.en` changes and the new slug doesn't collide. This is the only supported write path for a category's bilingual content, `isActive`, and `displayOrder` — normal category management never requires direct Firestore console editing. Does not create or delete categories (the four core categories — Bracelets, Rings, Earrings, Watches — and any future additions remain seed/data-provisioned, per data-model.md's `DYNAMIC`/`MANUAL`-style extensibility intent); it only lets an admin edit an existing category's bilingual name/description, activate/deactivate it, and reorder the active set. |

## Admin — Category Showcases

*(New — spec FR-001a–FR-001d, homepage category showcase requirement.)*

| Action | Input | Behavior |
|---|---|---|
| `updateCategoryShowcaseAction` | `{ showcaseId, categoryId?, title?: LocalizedString, subtitle?: LocalizedString \| null, cta?: LocalizedString, displayOrder?, isActive? }` | Requires `role === "ADMIN"`; validates via `categoryShowcaseSchema`; if `categoryId` is included, re-verified server-side to reference an existing category (same check as products/categories); updates only the fields provided on `categoryShowcases/{showcaseId}`. There is exactly one showcase document per core category, created by the seed script (research.md §38); this action edits an existing showcase's content/ordering/visibility, it does not create additional showcase documents. |
| `attachShowcaseImageAction` | `{ showcaseId, slot: "desktop" \| "mobile", storagePath, url }` | Requires `role === "ADMIN"`; called after the admin's browser completes a **direct-to-Firebase-Storage** upload under `showcases/{showcaseId}/` (authorized by Storage Security Rules checking the `ADMIN` claim, research.md §38 — same pattern as `attachUploadedImageAction` for products); validates the payload shape and sets `desktopImage` or `mobileImage` on `categoryShowcases/{showcaseId}`. |

## Admin — Delivery Locations

*(New — spec FR-086–FR-098, delivery location selection.)*

| Action | Input | Behavior |
|---|---|---|
| `updateDeliveryRegionAction` | `{ regionId, name?: LocalizedString, isActive?, displayOrder? }` | Requires `role === "ADMIN"`; validates via `deliveryRegionSchema`; `regionId` MUST be one of the two fixed values (`"west-bank"` \| `"inside-1948"`) — the action rejects any other value rather than creating a new region document, structurally enforcing the two-region business rule (research.md §40). Updates only `name`/`isActive`/`displayOrder` on `deliveryRegions/{regionId}`. |
| `createDeliveryLocationAction` | `{ regionId, name: LocalizedString, displayOrder?, isActive? }` | Requires `role === "ADMIN"`; validates via `deliveryLocationSchema` (`regionId` one of the two fixed values; `name.en` required); derives a unique-per-region `slug` from `name.en` (transactional conflict check, same pattern as `Category.slug`) and bilingual `searchTerms`; persists to `deliveryLocations/{locationId}`. |
| `updateDeliveryLocationAction` | `{ locationId, name?: LocalizedString, regionId?, isActive?, displayOrder? }` | Requires `role === "ADMIN"`; validates changed fields the same way as `createDeliveryLocationAction`; re-derives `slug`/`searchTerms` only if `name.en` changes. This — together with `createDeliveryLocationAction` — is the only supported write path for delivery-location content; normal delivery-coverage changes never require direct Firestore console editing (spec FR-094). |
| `deleteDeliveryLocationAction` | `{ locationId }` | Requires `role === "ADMIN"`; deletes `deliveryLocations/{locationId}`. Does not touch any existing order's `delivery` snapshot (data-model.md invariant — historical orders keep their bilingual `regionName`/`locationName` snapshot regardless). Admins are encouraged to deactivate (`isActive: false`) rather than delete when a location was ever actually used for delivery, to preserve a cleaner audit trail, but deletion is not blocked. |

## Admin — Orders

| Action | Input | Behavior |
|---|---|---|
| `updateOrderStatusAction` | `{ orderId, nextStatus }` | Requires `role === "ADMIN"`; validates the transition against the state machine in data-model.md; runs inside a Firestore transaction — on a transition to `CANCELLED`, restocks and decrements `salesCount` for each order line and decrements `stats/summary.totalSales`/`totalOrders` (research.md §17b), all as part of the same transaction that updates `status`. |
