# Quickstart: Validating the Core Commerce Experience

**Revision note (2026-08-26)**: Prerequisites/setup updated for the Firebase migration
(Firestore, Firebase Authentication, Firebase Storage, Firebase Admin SDK — replacing MongoDB/
Mongoose/Cloudinary). All validation scenarios below are unchanged in behavior; the underlying
services being exercised have simply changed per research.md.

This is a **validation guide**, not an implementation guide — it assumes the feature (or the
phase of it under test) has already been implemented per `tasks.md`, and walks through proving it
works end-to-end. Full setup/deployment documentation is a Phase 7 / Principle 22 deliverable
(README + `docs/`), not duplicated here.

**Path note (bilingual revision)**: every storefront path shown throughout this document (e.g.
`/shop`, `/cart`, `/account/orders`) is shorthand for its locale-prefixed route — `/en/shop` or
`/ar/shop`, per research.md §32. Scenarios 1–11 default to the `/en/...` tree unless a scenario
says otherwise; Scenario 13 exercises both `/en/...` and `/ar/...` explicitly. Admin paths
(`/admin/...`) are never locale-prefixed.

## Prerequisites

- Node.js 20+, npm, and the Firebase CLI (`npm i -g firebase-tools`).
- A Firebase project (free Spark plan is sufficient for development) with **Authentication**
  (Email/Password provider enabled), **Cloud Firestore** (Native mode), and **Cloud Storage**
  enabled. No replica-set or transaction configuration is required — Firestore transactions work
  out of the box (research.md §3).
- Firestore Security Rules and composite indexes deployed:
  `firebase deploy --only firestore:rules,firestore:indexes,storage:rules`.
- For fast local iteration/tests, the **Firebase Local Emulator Suite**
  (`firebase emulators:start`) running Auth, Firestore, and Storage emulators (research.md §14).
- `.env.local` populated per `contracts/` and `data-model.md` needs: the Firebase client config
  (`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`), the Admin SDK
  service-account credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`), `NEXT_PUBLIC_APP_URL`, `ADMIN_BOOTSTRAP_EMAIL`,
  `ADMIN_BOOTSTRAP_PASSWORD`, and the centralized social-contact config
  (`NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_WHATSAPP_PHONE`,
  `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_EN`, `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_AR` (optional)
  — research.md §28, §37; leave unset in development to exercise the "fails safely when
  unconfigured" behavior, Scenario 11 step 8).
- For the PWA scenarios below: a Chromium-based browser (Chrome/Edge) for install-prompt and
  standalone-mode checks, since `beforeinstallprompt`/`display-mode: standalone` emulation is most
  reliable there; `lighthouse`/`@lhci/cli` available locally or in CI for the Lighthouse PWA audit
  (research.md §27). A production build (`npm run build && npm run start`) is required to validate
  the service worker — it is intentionally inert in local dev mode.
- For Scenario 13 (bilingual): `npm run seed` (research.md §38) seeds at least one product per
  category with both English and Arabic content, plus one product with English-only content to
  exercise the fallback behavior; a browser/OS locale setting is not required — the app is tested
  by navigating directly to `/en/...` and `/ar/...`.

## Setup

```bash
npm install
firebase emulators:start --import=./seed-data --export-on-exit   # optional: local emulator mode
npm run seed              # sample categories, collections, products (dev/test only)
npm run create-admin       # provisions the first ADMIN user via the Admin SDK from ADMIN_BOOTSTRAP_* env vars
npm run dev
```

## Scenario 1 — Guest browse → cart → COD checkout → confirmation (P1 / SC-001, SC-002, SC-006)

1. Visit `/` — confirm the homepage renders the official logo, hero, a Featured Categories section
   with four cards (Bracelets, Rings, Earrings, Watches), New Arrivals, Best Sellers, Special
   Offers, and a "Shop Now" CTA.
2. Go to `/shop`; search a seeded product name; filter by one category via the category
   switcher; sort by price; confirm results update and match the filter/sort.
3. Open a product detail page; attempt to select a quantity greater than its seeded stock —
   confirm the UI blocks it.
4. Add a valid quantity to the cart; go to `/cart`; confirm subtotal/total are correct.
5. Go to `/checkout` without logging in; submit valid delivery details with Cash on Delivery.
6. Confirm redirect to `/order-confirmation/[orderNumber]` showing the order number, items,
   quantities, total, and payment method.
7. In `/admin/orders` (as the bootstrap admin), confirm the same order appears with matching
   detail, and that the product's stock decreased by exactly the ordered quantity.
8. Using a seeded product with `stock = 1`, order its last unit. Confirm the order succeeds and
   the product's stock becomes `0`.
9. Immediately revisit that product's card in `/shop` and its own detail page. Confirm both now
   show a "SOLD OUT" badge/label automatically (no admin action taken), Add to Cart is disabled,
   and quantity selection is disabled — with no manual "mark as Sold Out" step performed anywhere.
   Confirm the product is still browsable (not removed from the listing).

**Pass criteria**: order number is unique and human-readable (`ELR-YYYYMMDD-NNNN`); admin and
customer-facing views of the order agree; stock decremented exactly once and never goes negative;
a product that reaches 0 stock automatically becomes Sold Out with no separate admin step.

## Scenario 1b — Category browsing (spec FR-007a/FR-007b/FR-007c, SC-011)

1. From the homepage, click each of the four Featured Category cards (Bracelets, Rings, Earrings,
   Watches) in turn. Confirm each lands on that category's own dedicated page
   (`/shop/category/<slug>`) and shows **only** products belonging to that category — no products
   from any other category appear.
2. On the Rings category page, apply sort = newest; confirm results stay scoped to Rings only and
   reorder correctly.
3. On the Bracelets category page, apply a price filter; confirm results stay scoped to Bracelets
   only and reflect the filter.
4. On the Watches category page, apply sort = popularity; confirm results stay scoped to Watches
   only and reorder by cumulative units sold.
5. Go to `/shop` directly (no category); confirm it shows products from all categories by default,
   then use the category switcher to narrow to "Bracelets" only, then back to "All Products";
   confirm the product list updates correctly each time without a full page navigation being
   required.
6. Confirm every category is reachable within two clicks/taps from the homepage (Featured Category
   card) and from the storefront navigation (category menu), on both desktop and a mobile
   viewport (hamburger menu).
7. Using a product seeded with `stock = 0` in one of the four categories, open that category's
   dedicated page. Confirm the product still appears (browsable) with a "SOLD OUT" badge and
   disabled Add to Cart, rather than being hidden from the category entirely.

**Pass criteria**: 0% cross-category leakage on every category page; search/filter/sort behave
identically whether scoped via a category page or the Shop page's category switcher; a Sold Out
product remains visible in its category unless explicitly hidden by an admin.

## Scenario 2 — Register → login → wishlist → move to cart (P2/P3)

1. Register a new account at `/register`; confirm redirect into an authenticated state.
2. From a product page, click "Add to Wishlist"; confirm it appears at `/wishlist`.
3. Log out, log back in; confirm the wishlist item is still present (persistence across sessions).
4. From `/wishlist`, move the item to the cart; confirm it appears in `/cart` and is removed from
   `/wishlist`.

**Pass criteria**: wishlist survives a logout/login cycle; move-to-cart respects current stock.

## Scenario 3 — Guest wishlist redirect (spec FR-033a)

1. As a guest (no session), click "Add to Wishlist" on a product.
2. Confirm redirect to `/login` (or `/register`) carrying enough context to complete the intended
   action.
3. Log in with an existing account; confirm the originally-intended product is now in the
   wishlist and the user lands back on the original page.

## Scenario 4 — Registered customer order history (P2 / SC-003)

1. While logged in, place an order (reuse Scenario 1's flow while authenticated instead of as a
   guest).
2. Go to `/account/orders`; confirm the order is listed with status `Pending`.
3. As admin, change the order's status (e.g., to `Confirmed`).
4. Reload `/account/orders/[orderNumber]` as the customer; confirm the updated status is visible.

## Scenario 5 — Admin product management (P4 / SC-004)

1. Log in as the bootstrap admin; go to `/admin/products/new`.
2. Confirm the category field is a selection control (e.g., dropdown) listing the active seeded
   categories (Bracelets, Rings, Earrings, Watches) by name — not a free-text field. Attempt to
   submit the form with no category selected; confirm it is rejected with a clear validation
   message.
3. Create a product selecting "Rings" as its category, with all other required fields (including
   an initial stock quantity, e.g. `10`) and at least one uploaded image (validates the
   direct-to-Firebase-Storage upload flow, gated by Storage Security Rules, end to end).
4. Confirm the product appears on `/shop`, on the dedicated `/shop/category/rings` page (and not
   on `/shop/category/bracelets`, `/earrings`, or `/watches`), and, if flagged, in the relevant
   collection section on `/`, showing the entered stock as available (not Sold Out).
5. Confirm the admin product list shows this product's current stock quantity and its category,
   and does not flag it as Sold Out.
6. Edit the product's price and stock (e.g., correct stock down to `2`); confirm the storefront
   reflects the change without a redeploy (revalidation works), and the product list still shows
   the updated stock accurately.
7. Edit the same product's category from Rings to Bracelets and save. Confirm it now appears on
   `/shop/category/bracelets` and no longer on `/shop/category/rings`.
8. Edit the product's stock down to `0` and save. Confirm: the admin product list now flags it as
   Sold Out, and the storefront (card + detail page, including its category page) shows the "SOLD
   OUT" badge with Add to Cart and quantity selection disabled — with no separate "mark Sold Out"
   control used.
9. Edit stock back up to a positive number (restock) and save. Confirm the Sold Out badge clears
   everywhere and the product becomes purchasable again automatically.
10. Attempt to save a negative stock value (e.g., `-1`). Confirm the form rejects it with a clear
    validation message and no write occurs.
11. Mark it Best Seller; confirm it appears under Best Sellers; unmark; confirm it disappears from
    that section while remaining a normal catalog product.
12. Delete the product; confirm it disappears from the storefront while any prior order
    referencing it still displays correct historical name/price (SC-007).

## Scenario 6 — Admin order + customer management (P5 / SC-003, SC-009, SC-010)

1. In `/admin/orders`, search/filter for the order from Scenario 1 or 4; confirm it's found.
2. Open it; walk its status through the allowed transitions
   (`Pending → Confirmed → Preparing → Shipped → Delivered`); confirm an invalid transition
   (e.g., `Delivered → Pending`) is rejected.
3. In `/admin/customers`, open the customer from Scenario 2/4; confirm her order history matches
   what she sees in her own account.
4. On `/admin`, confirm dashboard totals (sales, orders, customers, products) and best-sellers
   match what can be independently counted from the seeded + test data, and that a `Cancelled`
   test order is excluded from total sales and best-seller ranking (FR-045).

## Scenario 7 — Authorization boundary (SC-005)

1. While logged in as the Scenario-2 customer (non-admin), attempt to navigate directly to
   `/admin`. Confirm access is denied/redirected.
2. Attempt to directly invoke an admin Server Action (e.g., via devtools/a raw request) as that
   same customer. Confirm the server rejects it — not just the UI hiding the option.

## Scenario 8 — Invalid / out-of-stock checkout is rejected safely

1. Add a product to the cart with quantity 2 (seeded stock ≥ 2); in another browser/session as
   admin, reduce its stock to 1 (below the cart quantity).
2. Attempt to complete checkout with the original cart. Confirm the order is **not** created, the
   customer sees a clear message identifying the affected item and asking her to adjust the
   quantity, and the product's stock is untouched (still `1`, not decremented and not negative).
3. Repeat with the admin instead reducing that product's stock all the way to `0` (Sold Out) while
   it sits in the customer's cart. Confirm checkout is rejected the same way, and the cart view
   itself (not just the checkout attempt) reflects the product as no longer purchasable the next
   time it's displayed (spec FR-016a).
4. As a final check, attempt to submit a checkout request with a quantity of `0` or a
   non-numeric value for a line (e.g., via a raw request bypassing the UI's own quantity control).
   Confirm the server-side `checkoutSchema`/`cartItemSchema` validation rejects it independent of
   any client-side control.

## Scenario 9 — Responsive validation across mobile, tablet, and desktop (spec FR-050–FR-050h, SC-008/SC-008a)

Repeat this scenario at three representative viewport widths — **mobile** (e.g., 375×667,
iPhone-class), **tablet** (e.g., 768×1024, iPad-class), and **desktop** (e.g., 1280×800 or wider)
— using Playwright's device emulation for the automated pass.

1. **Storefront, all three widths**: repeat Scenario 1 (guest browse → cart → checkout →
   confirmation) and Scenario 1b (category browsing). Confirm at every width: the header/nav
   (hamburger menu on mobile/tablet, full nav on desktop) works; the product grid shows roughly 2
   columns on mobile, 2–3 on tablet, 3–4 on desktop, without cards looking cramped or excessively
   wide; product images scale without distortion or overflow; the product detail page stacks
   image gallery + info vertically on mobile/tablet and shows a multi-column layout on desktop;
   SOLD OUT badges remain clearly visible at every width; filters/sorting are reachable without
   overcrowding the screen on mobile; the cart renders as stacked cards (not a cramped table) on
   mobile/tablet; the checkout form fits within the viewport with no horizontal scrolling; Add to
   Cart, quantity controls, and other primary interactive controls meet a touch-friendly minimum
   size on mobile and tablet.
2. **Admin Dashboard, all three widths**: repeat Scenario 5 (admin product management) and
   Scenario 6 (admin order + customer management). Confirm at every width: admin navigation
   collapses appropriately on mobile/tablet; dashboard statistic cards stack/wrap responsively
   rather than staying in a fixed wide row; the products/orders/customers tables render as a
   responsive card list (or equivalent mobile-appropriate presentation) below tablet width, with
   any remaining horizontal scroll confined to the table element itself, never the whole page; the
   Add/Edit Product form — including the stock quantity field — remains fully usable on mobile.
3. **No unintended horizontal overflow**: at every width above, confirm the page itself never
   scrolls horizontally (only an explicitly scrollable element, such as a wrapped admin table,
   may).
4. **Orientation/resize**: on the mobile and tablet emulated viewports, rotate between portrait
   and landscape (or resize the viewport) while on the cart, checkout, and an admin data table.
   Confirm the layout re-adapts without losing entered form data, cart contents, or introducing
   horizontal scrolling.

**Pass criteria**: every storefront area and Admin Dashboard screen listed in spec FR-050 is fully
usable, brand-consistent (Burgundy + Gold + Cream/Ivory, unaffected by viewport), and free of
horizontal overflow at all three representative widths.

**Pre-release manual check (not automatable)**: before a production release, additionally
hand-verify the same primary flows on at least one real or high-fidelity emulated iPhone, one
Android phone, one tablet (iPad or equivalent), one small/standard laptop, and one desktop
monitor — automated viewport emulation is a floor, not a substitute for checking real touch
behavior, font rendering, and on-device performance (research.md §14).

## Scenario 10 — Installable PWA (spec FR-053–FR-065, research.md §23–§27)

Build and serve a production build (`npm run build && npm run start`) — the service worker is
intentionally inert under `next dev` (research.md §24).

1. **Manifest**: fetch `/manifest.webmanifest`. Confirm `name` is "ELORA JEWELLERY", `display` is
   `"standalone"`, `theme_color`/`background_color` are the approved burgundy/cream token values
   (never chocolate/champagne/rose-gold), and the `icons` array includes the required standard
   (192/512) and maskable (512, `purpose: "maskable"`) entries.
2. **Icons**: confirm every icon variant (standard, maskable, Apple Touch Icon, favicon) renders
   the official ELORA logo unaltered, with only the surrounding canvas adapted for the maskable
   safe zone — not a different or regenerated mark.
3. **Service worker registration**: in a Chromium browser, confirm `navigator.serviceWorker`
   registers successfully and the precache includes the static shell, brand/icon assets, fonts,
   and the `/offline` route.
4. **Install prompt (Chromium/Android/Windows/macOS)**: with `beforeinstallprompt` available,
   confirm a clear "Install ELORA JEWELLERY App" option appears — not on initial page load
   aggressively, and not repeatedly after being dismissed once (re-check within the configured
   cooldown window). Install the app; confirm it launches standalone (no address bar), with the
   ELORA name/icon and a branded launch moment, and that the full Home → Shop → Product → Cart →
   Checkout → Confirmation flow works identically to the browser version.
5. **Already-installed / unsupported suppression**: with `display-mode: standalone` simulated (or
   after installing), confirm the install prompt does **not** appear. In a browser context that
   never fires `beforeinstallprompt` and isn't iOS Safari (i.e., genuinely unsupported), confirm no
   non-functional install button is shown either.
6. **iOS instructions (simulated via user agent, or on a real device)**: confirm the app shows
   clear "Share → Add to Home Screen" instructions instead of a Chromium-style install button, and
   that no claim of one-tap installation is made on this platform.
7. **Offline fallback**: with the app already loaded once (so the service worker is active), go
   offline (e.g., Playwright `context.setOffline(true)`, or airplane mode on a real device) and
   navigate. Confirm the branded `/offline` page renders — not a generic browser error page.
8. **Offline checkout is blocked, not faked**: while offline, attempt to complete checkout (cart
   already populated from an earlier online session). Confirm no order is created and no success
   indication is shown — the UI clearly states connectivity is required.
9. **No stale authoritative data**: with the app loaded and the service worker active, change a
   product's price or stock directly (as admin) in a second session, then reload the product page
   in the first session (back online). Confirm the updated price/stock/Sold-Out state appears —
   proving the page was served fresh from Firestore, not from a cached copy.
10. **Standalone-mode responsiveness**: with `display-mode: standalone` simulated, repeat the
    mobile/tablet/desktop responsive pass (Scenario 9) and confirm layout, touch targets, and
    no-horizontal-overflow guarantees hold identically to the ordinary browser mode.
11. **Lighthouse**: run a Lighthouse PWA audit against the production build/preview deployment;
    confirm the installability/manifest/service-worker checks pass.

**Pass criteria**: the app is installable with correct branding on supporting platforms, shows
accurate manual instructions on iOS, never shows a stale price/stock/Sold-Out value or a fake
successful order while offline, and remains fully responsive and accessible in standalone mode.

## Scenario 11 — Instagram & WhatsApp contact (spec FR-006a–FR-006h, research.md §28–§31)

Set `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_WHATSAPP_PHONE`, and
`NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE` to test values for steps 1–7 below; leave them unset for
step 8.

1. **Navbar (desktop)**: confirm small, elegant Instagram and WhatsApp icons appear in the desktop
   navbar without crowding or displacing Home/Shop/Collections/About/Contact/Search/Wishlist/Cart/
   Account. Confirm each has a visible tooltip/accessible label ("Instagram" / "WhatsApp"), not
   just a bare icon.
2. **Navbar (mobile)**: confirm Instagram and WhatsApp remain reachable via the hamburger menu (or
   an equivalent compact treatment) without reducing the usability of Search, Wishlist, Cart,
   Account, or the hamburger control itself, and without introducing horizontal overflow in the
   header.
3. **Instagram link**: click/tap the Instagram control (navbar and footer). Confirm it opens the
   exact `NEXT_PUBLIC_INSTAGRAM_URL` destination, in a new tab/context with no `window.opener`
   access back to the app (`rel="noopener noreferrer"`), and — on a mobile emulation with the
   Instagram app "installed" (OS-level association) — that the platform's normal app-handoff
   behavior applies (this is inherent to using the real `instagram.com` URL, not custom app code).
4. **WhatsApp link**: click/tap the WhatsApp control (navbar, footer, and the floating button).
   Confirm each opens `https://wa.me/<configured phone, digits only>` with the configured greeting
   message correctly URL-encoded in the `text` parameter (or the configured default when no
   override is passed).
5. **Footer**: confirm the footer's Instagram and WhatsApp links resolve to the exact same
   destinations as the navbar (same centralized config, spec FR-006a) — not independently
   hardcoded values that happen to currently match.
6. **Floating WhatsApp button — presence and non-interference**: on a product detail page (mobile
   viewport) with the sticky Add-to-Cart bar visible, confirm the floating WhatsApp button does not
   overlap it. Repeat on the cart page, the checkout page, and with a PWA install banner visible
   (Scenario 10 step 4) — confirm the floating button never covers Add to Cart, checkout/buy
   controls, cart controls, primary navigation, the install control, a cookie notice, a form field,
   or product information at any of the responsive widths from Scenario 9.
7. **Floating WhatsApp button — brand consistency**: confirm the button's WhatsApp icon uses the
   ELORA burgundy/gold/cream tokens rather than the platform's default bright green, while
   remaining clearly recognizable as a WhatsApp action.
8. **Unconfigured / fail-safe behavior**: with the three environment variables unset, reload the
   app. Confirm no Instagram/WhatsApp control links to an empty, placeholder, or fabricated
   destination — each is either hidden or shown visibly disabled with an explanatory accessible
   label (spec FR-006h).
9. **PWA standalone handoff**: with the app running as an installed PWA (standalone display mode,
   per Scenario 10), click the WhatsApp floating button. Confirm it hands off to WhatsApp (app or
   web) without navigating away from or breaking the installed app's own standalone window/session.
10. **Keyboard accessibility**: using keyboard-only navigation, tab to each Instagram/WhatsApp
    control (navbar, footer, floating button) and confirm each receives a visible focus state and
    can be activated via keyboard (e.g., Enter), consistent with the rest of the site's keyboard
    accessibility.

**Pass criteria**: Instagram and WhatsApp are reachable from the navbar, footer, and (WhatsApp
only) the floating button; all three read the same centralized configuration; no fake contact
information ever appears; the floating button never obstructs a primary action; and all
Instagram/WhatsApp controls remain accessible, responsive, brand-consistent, and correctly
functional inside an installed PWA.

## Scenario 12 — Homepage category showcases (spec FR-001a–FR-001f, SC-017)

1. Visit `/en` (Home). Confirm the merchandising sequence: Hero → Bracelets showcase + Featured
   Bracelets → Rings showcase + Featured Rings → Earrings showcase + Featured Earrings → Watches
   showcase + Featured Watches → Featured Categories → New Arrivals/Best Sellers/Special Offers →
   brand section. Confirm none of the previously-approved sections (Hero, New Arrivals, Best
   Sellers, Special Offers, brand section) were removed.
2. For each of the four showcases, confirm: large imagery renders, the category name and (if
   configured) subtitle display, and the CTA ("Shop Bracelets," etc.) is obviously clickable.
   Click each CTA and confirm it navigates to exactly that category's dedicated page
   (`/en/shop/category/bracelets`, etc.) — not a different category.
3. For each "Featured {Category}" strip, confirm **every** product shown belongs to that
   showcase's category — 0% cross-category leakage (spot-check against the category's own
   dedicated page).
4. Using a seeded product with `stock = 0` inside one of the four categories, confirm it still
   appears in that category's Featured strip with a SOLD OUT badge and disabled Add to Cart —
   exactly as it would on the category page — rather than being silently omitted or purchasable.
5. **Admin content management**: as the bootstrap admin, edit one showcase's title/subtitle/CTA
   and upload a new desktop image via `/admin/showcases`. Reload the homepage and confirm the
   change appears — no code change or redeploy required (spec FR-001d).
6. **Responsive**: at mobile width, confirm each showcase uses a distinct mobile-appropriate image
   composition (not a shrunk desktop banner), the title/CTA remain readable, no text covers
   important product/jewelry detail, and there is no horizontal overflow. At desktop width,
   confirm large, cinematic-proportioned imagery with generous spacing.
7. **Graceful degradation**: with one showcase temporarily set `isActive: false` (or with no
   image configured), confirm the homepage still renders correctly — the section is simply
   omitted, not a broken image or blank block.

**Pass criteria**: all four showcases render, link correctly, show only their own category's
live, Sold-Out-aware products, are admin-editable without a code change, and remain fully
responsive with no cross-category leakage.

## Scenario 13 — Arabic/English bilingual support (spec FR-066–FR-085, SC-018–SC-020)

1. **Language switcher**: from any storefront page, locate the language switcher in the Navbar
   (desktop) and in the hamburger menu (mobile). Switch to Arabic.
2. **RTL correctness**: confirm the page immediately re-renders right-to-left, `<html lang="ar"
   dir="rtl">` is set, and the Navbar, hamburger menu, product grid, product detail, cart,
   checkout, account, footer, floating WhatsApp button, and any open dialog all mirror correctly —
   no LTR-positioned control left stranded inside the RTL layout. Confirm the official logo and
   product photography are **not** mirrored.
3. **Persistence**: navigate to another page, refresh the browser, and (if PWA testing is set up
   per Scenario 10) reopen the installed app. Confirm Arabic remains selected each time without
   being asked again. Switch back to English and confirm the same persistence in the other
   direction.
4. **Bilingual catalog content**: with Arabic selected, open a product that has both English and
   Arabic content entered by the admin. Confirm the Arabic name/description/material/option
   labels display. Confirm the four category names display as أساور / خواتم / أقراط / ساعات on
   both the dedicated category pages and the homepage showcases (Scenario 12), while their URLs
   (`/ar/shop/category/bracelets`, etc.) and underlying `categoryId` stay exactly the same
   products/relationships as in English.
5. **Missing-translation fallback**: open a product/category that has no Arabic content yet.
   Confirm it falls back to displaying the English content rather than a blank or broken field.
6. **Bilingual checkout**: with Arabic selected, complete checkout. Confirm form labels,
   validation messages, and the order summary are in Arabic with correct RTL form layout, and that
   the price/stock/total values are identical to what the same cart would total in English (i.e.,
   language never changes an authoritative amount). Confirm the order confirmation page is also
   correctly localized.
7. **Historical order snapshot**: after placing the Arabic-language order in step 6, have an admin
   edit that product's Arabic translation. Reload the customer's order detail page and confirm it
   still shows the product name/options as they were at purchase time, correctly in both languages
   — not the newly-edited text.
8. **Localized order status**: as admin, change that order's status. Confirm the customer sees the
   correctly localized status label (e.g., "قيد الانتظار" for Pending) while the underlying stored
   status value is unaffected by language.
9. **Bilingual admin editing**: in `/admin/products/[id]/edit` and `/admin/categories`, confirm
   clearly distinguished English and Arabic fields (e.g., "Product Name — English" / "Product Name
   — Arabic") for name, description, material, and option labels.
10. **Localized WhatsApp greeting**: with an Arabic `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_AR`
    configured, switch to Arabic and tap the WhatsApp floating button. Confirm the pre-filled
    greeting is the Arabic message, not the English default.
11. **Localized SEO**: view page source (or `generateMetadata` output) for the same product under
    `/en/...` and `/ar/...`. Confirm distinct, correctly localized titles/descriptions, each with
    its own canonical URL and `hreflang` alternates linking the two. Confirm `/sitemap.xml` lists
    both locale variants of key URLs.
12. **Responsive × RTL**: repeat the mobile/tablet/desktop responsive pass (Scenario 9) with
    Arabic selected. Confirm no horizontal overflow, no broken grid/Navbar/hamburger menu, no
    misplaced icons, no broken forms, and no incorrect floating-WhatsApp placement under RTL.
13. **Unsupported browser language**: with the browser/device language set to a third language
    (neither Arabic nor English), confirm the storefront falls back to English rather than
    erroring or showing untranslated keys.

**Pass criteria**: the entire storefront, checkout, account, PWA, and relevant admin
content-management interfaces work correctly in both languages; RTL is structurally correct
everywhere it's required; language persists across navigation/refresh/installed-PWA use;
authoritative checkout/order data is identical regardless of language; and historical orders
remain correctly bilingual even after later translation edits.

## Scenario 14 — Delivery location selector (spec FR-086–FR-098, SC-021–SC-023)

1. **Only two regions, no worldwide selector**: from any storefront page, tap the location
   control in the Navbar/Header. Confirm the modal (desktop) or bottom-sheet drawer (mobile) opens
   showing exactly two regions — West Bank / الضفة الغربية and Inside/1948 Areas / الداخل — and no
   country list or any other region.
2. **Search and select — English**: with English active, search for a seeded city (e.g.,
   "Ramallah"). Confirm matching cities filter live, select one, and confirm the modal/drawer
   closes and the Navbar control now displays the selected city.
3. **Search and select — Arabic**: switch to Arabic and reopen the selector. Confirm the same two
   regions and their cities display in Arabic, and that searching using an Arabic city name (e.g.,
   "رام الله") returns the correct match. Confirm the underlying selected location's identity
   (not just its display label) is unchanged by the earlier language switch.
4. **Persistence**: refresh the browser and confirm the selected location is still shown in the
   Navbar without re-prompting. If PWA testing is set up (Scenario 10), reopen the installed app
   and confirm the same persistence.
5. **Checkout prefill and review**: add a product to cart and proceed to checkout. Confirm the
   region/city fields are prefilled from the persisted selection, and confirm the customer can
   still open the selector from checkout and change the location before placing the order.
6. **Unsupported/deactivated location rejected server-side**: as admin, deactivate the currently
   selected city (`/admin/locations`). Without changing the customer's stale selection, submit
   checkout. Confirm the order is **not** created, and a clear, localized "not currently supported"
   message is shown instead — never a silent success.
7. **No prior selection**: as a fresh guest with no location ever chosen, proceed directly to
   checkout. Confirm checkout does not silently proceed with an undefined/blank delivery location —
   either the selector is required inline or checkout guides the customer to choose one first.
8. **Offline caveat**: with the location selector's persisted cookie value visible while offline
   (per Scenario 11's offline shell test), confirm no order can be completed offline, and once back
   online, confirm the previously selected location is revalidated (not blindly trusted) before an
   order can be created.
9. **Admin location management**: in `/admin/locations`, confirm the two regions can be relabeled/
   reordered but not created or deleted, and that within each region an admin can add, edit
   (English + Arabic name), activate/deactivate, and reorder cities — with the storefront selector
   reflecting these changes without any code deployment.
10. **Responsive**: repeat the selector open/search/select flow across phone, tablet, and desktop
    viewports (Scenario 9's device matrix). Confirm the mobile drawer is full-height/bottom-sheet
    style with touch-friendly targets and no horizontal overflow, and the desktop presentation is a
    polished modal/panel.
11. **Accessibility**: open the selector using only the keyboard. Confirm focus moves into the
    dialog, the search input has an accessible label, focus is trapped/returned correctly on close,
    and a screen reader announces the currently selected region/city.

**Pass criteria**: only the two approved regions are ever offered; city/area search works
correctly in both languages; the selection persists across navigation, refresh, and installed-PWA
use; checkout always prefills from and revalidates against the live, admin-managed location data;
an unsupported or deactivated location can never silently produce an order; admins can manage the
full location list without a code change; and the selector is fully responsive, PWA-compatible,
and accessible.

## Scenario 15 — Admin Excel export (spec FR-099–FR-112, SC-024–SC-026)

1. **Happy path — Orders**: as admin, from the Admin Dashboard's Export to Excel screen, export
   Orders with no filter. Confirm a real `.xlsx` file downloads (opens correctly in a standard
   spreadsheet app) and contains, per order: order number, date, customer name, phone, email,
   region, city/area, address, ordered products with quantities/prices, total, payment method,
   status, and guest-vs-registered — matching the orders visible in `/admin/orders`.
2. **Happy path — Products/Inventory**: export Products. Confirm each row has the product's
   identifier, English name, Arabic name (blank for the Scenario 3's seed English-only product,
   per FR-074's fallback), category, price, stock, derived SOLD OUT status, availability, New
   Arrival, and Best Seller — matching `/admin/products`.
3. **SOLD OUT export**: reduce a product's stock to `0` (as in Scenario 8), then export SOLD OUT
   Products. Confirm that product appears, and a product with stock `> 0` does not.
4. **Sales / Best-Sellers export**: export Sales and Best-Selling Products. Confirm the figures
   match `/admin`'s own dashboard statistics exactly, including that a `Cancelled` test order
   (Scenario 6) is excluded from both.
5. **Customers export**: export Customers. Confirm it includes profile/order-summary fields only
   — no password, credential, or token value appears anywhere in the file (none exists to export).
6. **Delivery Locations export**: export Delivery Locations. Confirm every region/city from
   `/admin/locations` appears with its bilingual name, active state, and display order.
7. **Filters**: export Orders filtered by a date range and by status; export Products filtered by
   category; export a low-stock threshold. Confirm each downloaded file contains only matching
   rows, not a full unfiltered file with rows merely hidden.
8. **Empty result set**: apply a filter guaranteed to match nothing (e.g., a future date range).
   Confirm the download is still a valid, correctly-headered `.xlsx` file, not an error page.
9. **Authorization boundary**: while logged in as the Scenario-2 customer (non-admin), attempt to
   open the export screen and to call an export request directly (e.g., a raw request to
   `/admin/api/export/orders`, bypassing the UI). Confirm both are rejected server-side and no
   file is produced — not just the UI hiding the option (mirrors Scenario 7).
10. **No import path**: confirm — by inspection of the routes/actions, not just behavior — that no
    Excel/spreadsheet upload or import endpoint exists anywhere in the application. Download an
    export, edit a value in it (e.g., change a price), and confirm there is nowhere in the product
    to feed that edited file back in; the live storefront/admin data is unaffected.

**Pass criteria**: every report type produces a real, correctly-populated `.xlsx` file matching
live Firestore data and the admin dashboard's own figures; every filter is enforced server-side;
an empty result set still yields a valid file; export is unreachable by a non-admin through any
path; no Excel import capability exists, so a downloaded file can never be edited and fed back
into Firestore.

## Scenario 16 — Special Offers / promotional pricing (spec FR-113–FR-125, SC-027–SC-029)

1. **Invalid sale price rejected**: as admin, attempt to enable an offer on a product with a sale
   price equal to, or greater than, its regular price. Confirm the save is rejected — both a
   client-side validation message and, by attempting the equivalent action call directly, a
   server-side rejection — and no offer is saved.
2. **Enable a valid offer**: set a sale price below the regular price and enable the offer with no
   start/end dates. Confirm the product's derived offer status is immediately `Active`.
3. **Scheduled offer**: set a future `saleStartAt`. Confirm the offer status shows as `Scheduled`
   and the product displays only its regular price everywhere (Home, Shop, category page, product
   detail, Quick View) until that instant passes.
4. **Expired offer**: set a past `saleEndAt`. Confirm the offer status shows as `Expired` and the
   product reverts to displaying only its regular price everywhere, with no manual admin action
   beyond having set the date.
5. **Consistent display**: with an `Active` offer (from step 2), confirm the identical crossed-out
   regular price and sale price render on Home's Special Offers section, the Shop grid, the
   product's category page, its detail page, and its Quick View — same two numbers, every surface.
6. **Cart/checkout authoritative pricing**: add the on-sale product to the cart. Confirm the cart
   line prices it at the sale price. Complete Cash on Delivery checkout (as in Scenario 1) and
   confirm the resulting order's item price matches the sale price, not the regular price.
7. **Mid-session price change**: with the on-sale product still in the cart, have admin disable the
   offer in a separate session. Reload the cart page and confirm it now shows the regular price —
   never a stale sale price — before checkout is attempted.
8. **Sold Out overrides an active offer**: reduce the on-sale product's stock to `0` (as in
   Scenario 8). Confirm it still displays SOLD OUT and remains non-purchasable, regardless of its
   `Active` offer status.
9. **Historical order price is immutable**: after completing an order at a sale price (step 6),
   have admin change or remove that product's offer entirely. Confirm the already-placed order's
   item price in both the customer's order history and the admin order list is unchanged.
10. **Empty Special Offers section**: with no product currently `Active`, confirm the Home Special
    Offers section degrades gracefully (hidden or a clear empty message) rather than showing a
    broken or empty-looking block.
11. **Authorization boundary**: while logged in as the Scenario-2 customer (non-admin), attempt to
    enable an offer directly (bypassing the UI). Confirm it is rejected server-side (mirrors
    Scenario 7).

**Pass criteria**: an invalid sale price can never be saved; a scheduled or expired offer never
displays or prices as active; every storefront surface shows identical offer pricing for the same
product at the same moment; cart and checkout always price from the current authoritative offer
state, never a stale or client-submitted value; Sold Out always overrides an active offer; a placed
order's price is immune to any later offer change; offer management is admin-only and
server-enforced.
