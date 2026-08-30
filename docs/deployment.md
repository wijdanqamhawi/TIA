# ELORA JEWELLERY — Production Deployment & Readiness Checklist

This is the production companion to `docs/setup.md` (local/emulator development) and
`docs/testing.md` (test suites). It covers every topic Constitution Principle 22 requires
end-to-end, so a new contributor or the store owner can take this project from a clean checkout
to a live, fully-configured production deployment using only this document.

Every step below that requires a real Firebase project, a real Vercel account, a real domain, or
store-owner-supplied content (Instagram/WhatsApp, product photography, legal text) **cannot be
completed inside this repository or by an AI agent** — it requires a human with the relevant
account access. Those steps are marked **⚠ Manual, requires real credentials**.

---

## 1. Project structure

```
src/
  app/                  Next.js App Router routes
    [locale]/           Locale-prefixed storefront (en/ar) — home, shop, cart, checkout, account…
    admin/              Admin dashboard (never locale-prefixed)
    sitemap.ts, robots.ts, manifest.ts   Metadata-route conventions
  actions/              Server Actions ("use server") — the only write path into Firestore
    admin/              Admin-only actions (each independently calls requireAdmin())
  components/           React components (storefront/, admin/, ui/, pwa/)
  lib/
    firebase/           Admin SDK client + Firestore/Storage collection accessors + auth guards
    domain/             Business logic (catalog, cart, orders, wishlist, checkout, delivery)
    validation/         Zod schemas (client + server share the same schema)
    seo/, config/, utils/
  types/                Shared TypeScript domain types
  middleware.ts         Locale detection/redirect
messages/               next-intl message catalogs (en.json, ar.json)
scripts/                seed.ts (dev/test-only sample data), create-admin.ts
tests/
  unit/, integration/   Vitest (integration needs the Firebase Local Emulator Suite)
  e2e/                  Playwright (mobile/tablet/desktop projects; fixtures/ has shared helpers)
firestore.rules, storage.rules, firestore.indexes.json, firebase.json
.github/workflows/ci.yml
docs/                   setup.md (local dev), testing.md, deployment.md (this file)
specs/001-core-commerce-experience/   spec.md, plan.md, tasks.md, research.md, quickstart.md, data-model.md
```

## 2. Dependency installation

```bash
node --version   # Node.js 20+ required
npm install
```

No other package manager is used (`package-lock.json` is the lockfile committed to git).

## 3. Environment variables

Copy `.env.example` to `.env.local` for local dev; in production these are set directly in the
Vercel project (§6), never committed to git (`.env.local` is gitignored).

| Variable | Where it's used | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Client SDK | Safe to expose — identifies the project only |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client SDK | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client SDK | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Client SDK | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Client SDK | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Client SDK | |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | Client SDK | `false` in production |
| `FIREBASE_PROJECT_ID` | Admin SDK (server-only) | |
| `FIREBASE_CLIENT_EMAIL` | Admin SDK (server-only) | From the service-account JSON |
| `FIREBASE_PRIVATE_KEY` | Admin SDK (server-only) | Keep the `\n` escapes intact — Vercel's env UI accepts multi-line values directly |
| `FIREBASE_STORAGE_BUCKET` | Admin SDK (server-only) | |
| `NEXT_PUBLIC_APP_URL` | SEO (canonical/hreflang/sitemap), Server Actions | The real production origin, e.g. `https://elorajewellery.com` |
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` | `scripts/create-admin.ts` | Only ever used once per environment (§5); rotate the password afterward if desired |
| `CART_COOKIE_SECRET` | Guest cart cookie signing | **Required in production** — generate with `openssl rand -hex 32`, never reuse the dev value |
| `NEXT_PUBLIC_INSTAGRAM_URL` | Navbar/Footer/social config | Every consumer fails safe (hidden/disabled) while unset — §7 |
| `NEXT_PUBLIC_WHATSAPP_PHONE` | Navbar/Footer/floating WhatsApp button | Digits only, no `+`/spaces |
| `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_EN` / `..._AR` | WhatsApp greeting | Quote values containing spaces |
| `NEXT_PUBLIC_TIKTOK_URL` | Footer | Optional — Footer hides the link entirely while unset |

Never commit real values for any of these. `.env.local` and `.env*.local` are already in
`.gitignore`.

## 4. Firebase project & database/Storage setup

**⚠ Manual, requires real credentials** — an AI agent cannot create a Firebase project or click
through the Firebase Console on the store owner's behalf. Steps for whoever has (or creates) the
Google account that will own this project:

1. Create a new Firebase project (or use an existing one) at <https://console.firebase.google.com>.
2. **Authentication** → Sign-in method → enable **Email/Password**. This is the one Auth provider
   this app uses; no other provider is wired up anywhere in the code.
3. **Firestore Database** → create in **Native mode** (not Datastore mode), in a region close to
   the target customer base.
4. **Storage** → enable the default bucket.
5. Generate a **service account key**: Project Settings → Service Accounts → "Generate new private
   key". This JSON's `client_email`/`private_key`/`project_id` map directly to
   `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`/`FIREBASE_PROJECT_ID` above. Store it securely —
   never commit it, never paste it anywhere other than the Vercel environment-variables UI.
6. Copy the **Web app config** (Project Settings → General → Your apps → Web app) into the
   `NEXT_PUBLIC_FIREBASE_*` variables.

Once real credentials exist, deploy the rules/indexes this repo already defines — this part
**is** runnable directly, no manual console clicking needed, once you're authenticated:

```bash
npx firebase login                     # opens a browser to authenticate your Google account
npx firebase use --add                 # select the production project, alias it e.g. "production"
npx firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

This deploys the exact `firestore.rules` (least-privilege per collection — public catalog reads,
owner-scoped personal data, deny-all internal collections, every write Admin-SDK-only),
`storage.rules` (admin-only image uploads with content-type/size validation), and
`firestore.indexes.json` (composite indexes for every filtered/sorted catalog and order query)
already verified in this repository (Phase 16, `tests/integration/firestore-rules.test.ts` /
`storage-rules.test.ts`).

## 5. Admin account creation

**⚠ Manual, requires the real `ADMIN_BOOTSTRAP_*` env vars to be set in the target environment
first.** There is no public "register as admin" route (Constitution Principle 6) — this is the
only way to create the first administrator:

```bash
# with ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD set to the production values
# (e.g. via `vercel env pull` into a local .env, or run once from a machine with those
# env vars exported, pointed at the production Firebase project)
npm run create-admin
```

This creates (or reuses) that Firebase Authentication user, sets its `role: "ADMIN"` custom
claim, and mirrors `role: "ADMIN"` onto `users/{uid}` in Firestore. It is idempotent — safe to
re-run. Sign in at `/en/login` (or `/ar/login`) with that email/password to reach `/admin`.
Additional admins can be promoted later by directly editing a user's `role` field in Firestore
(there is deliberately no in-app "make admin" UI, per Constitution Principle 6) or by re-running
`create-admin` with different bootstrap env vars for a second account.

## 6. Vercel deployment

**⚠ Manual, requires a real Vercel account.**

1. Import this git repository into Vercel (New Project → Import).
2. Framework preset: Next.js (auto-detected).
3. **Environment Variables** (Project Settings → Environment Variables): add every variable from
   §3 for the **Production** environment (and Preview, if preview deployments should also work
   against a real or staging Firebase project). Paste `FIREBASE_PRIVATE_KEY` exactly as it appears
   in the service-account JSON, newlines included — Vercel's env editor preserves them.
4. Deploy. Vercel runs `npm install` then `next build` automatically; no custom build command is
   needed. Confirm in the build log that:
   - The build completes with no errors (mirrors `npm run build` passing locally in this repo).
   - Both locale trees are present in the route output (`/en/...` and `/ar/...`, per the build
     summary's route table — every storefront route already lists both locale variants).
   - The Serwist service-worker output (`public/sw.js` and its precache manifest) is generated as
     part of the build — Serwist's Next.js plugin runs during `next build`, so its presence in the
     build output confirms the PWA service worker will actually be served in production (unlike
     `next dev`, where it's intentionally inert).
5. After the first deploy, run §5 (`create-admin`) against production if not already done.

## 7. Social config (Instagram/WhatsApp/TikTok)

**⚠ Manual, requires values from the store owner.** Until `NEXT_PUBLIC_INSTAGRAM_URL` /
`NEXT_PUBLIC_WHATSAPP_PHONE` are set, every Instagram/WhatsApp control (Navbar, Footer, the
floating WhatsApp button) fails safe — hidden or visibly disabled with an explanatory label, per
spec FR-006h — this is intentional, not a bug, and is already verified in
`tests/e2e/social-contact.spec.ts`. Once the store owner supplies the real Instagram profile URL
and WhatsApp phone number (+ optional English/Arabic greeting overrides), set them as Vercel
environment variables (§3) and redeploy (env var changes require a redeploy to take effect, since
`NEXT_PUBLIC_*` values are inlined into the client bundle at build time).

## 8. Product catalog, categories, and homepage showcases

Once signed in as admin in production:

1. **Categories** (`/admin/categories`) — the four core categories (Bracelets, Rings, Earrings,
   Watches) are fixed by design (no create/delete, per spec); confirm all four are active with a
   sensible `displayOrder`, and edit each one's bilingual name/description if needed.
2. **Products** (`/admin/products/new`) — create at least one real product per category with
   genuine English **and** Arabic content (name, description, material, at least one uploaded
   image — the image upload goes directly to Firebase Storage, gated by the Storage Security
   Rules deployed in §4), an accurate starting stock quantity, and price. Leaving a field's Arabic
   translation blank is supported (it falls back to English everywhere, per spec FR-074) but a
   real launch should have both languages filled in for every product that will actually sell.
3. **Homepage showcases** (`/admin/showcases`) — one showcase per category already exists from
   `scripts/seed.ts`'s original data-model definition; replace the placeholder title/subtitle/CTA
   and upload real desktop (and optionally mobile) imagery for each of the four showcases.
4. Confirm on the live storefront (`/en` and `/ar`) that the new real content — category names,
   product cards, showcase imagery — renders correctly in both languages with no leftover
   placeholder/lorem-ipsum text.

**Important**: `scripts/seed.ts` is dev/test-only (it refuses to run against a non-emulator
Firestore unless `ALLOW_SEED_PRODUCTION=true` is explicitly set) — production catalog content is
always entered through the real admin UI in this step, never via the seed script.

## 9. Test order procedure

Before announcing the store is live, place one real Cash-on-Delivery order end to end, **in each
language**:

1. As a guest (or a fresh registered account), browse to a real product, add it to the cart.
2. Complete checkout with a real (but clearly test) name/phone/email and a real delivery
   region/city from `/admin/locations`'s configured list.
3. Confirm the order confirmation page shows the correct order number (`ELR-YYYYMMDD-NNNN`),
   items, total, and "Cash on Delivery".
4. In `/admin/orders`, confirm the same order appears with matching detail and that the product's
   stock decreased by exactly the ordered quantity.
5. Walk the order through at least one status transition (e.g. Pending → Confirmed) and confirm
   the change is visible back on the customer's own order-history page.
6. Cancel or otherwise clean up this test order afterward if it shouldn't appear in real sales
   figures (a `Cancelled` order is already excluded from dashboard totals/best-sellers, per spec
   FR-045 — confirmed in this repo's own test suite).
7. Repeat in the other language (`/ar/...`) to confirm the Arabic checkout form, validation
   messages, and order confirmation are all correctly localized and price exactly matches what the
   English flow would have produced for the same product/quantity.

## 10. Domain connection

**⚠ Manual, requires DNS access for the real domain.**

1. In the Vercel project → Settings → Domains, add the production domain (e.g.
   `elorajewellery.com` and/or `www.elorajewellery.com`).
2. Follow Vercel's provided DNS instructions (typically an `A`/`ALIAS` record for the apex domain
   and a `CNAME` for `www`) at the domain registrar/DNS provider.
3. Once DNS propagates and Vercel issues the TLS certificate, update `NEXT_PUBLIC_APP_URL` in the
   Vercel environment variables to the final `https://` domain and redeploy — this value feeds
   directly into every canonical URL, `hreflang` alternate, and sitemap entry (§11), so it must
   match the real, final domain exactly.

## 11. Production verification pass

Once deployed with a real domain, verify (this is the automated-equivalent of quickstart.md's
Scenarios 9, 10, and 13, run once for real against production rather than the emulator):

- **hreflang/canonical/sitemap** — fetch `https://<domain>/sitemap.xml` and confirm both `/en/...`
  and `/ar/...` entries exist for the home page, each category, and each real product, each with
  `hreflang="en"`/`"ar"`/`"x-default"` alternates. View source on a sample product page in both
  locales and confirm distinct, correctly-localized `<title>`/description, a correct
  `<link rel="canonical">`, and matching hreflang alternates (already implemented and unit-verified
  against the emulator in Phase 15/17 — this step re-confirms the same logic against the real
  domain and real `NEXT_PUBLIC_APP_URL`).
- **PWA installability** — fetch `/manifest.webmanifest` and confirm `name`/`theme_color`/
  `background_color`/icon set are correct; in a Chromium browser confirm the install prompt
  appears (not overly aggressively), installs correctly with the ELORA name/icon in standalone
  mode, and that the full Home → Shop → Cart → Checkout → Confirmation flow works identically once
  installed. On iOS Safari, confirm the manual "Share → Add to Home Screen" instructions render
  instead of a native install prompt.
- **Responsive, both languages** — hand-verify (automated Playwright coverage in this repo's own
  suite is a floor, not a substitute for a real device pass, per research.md §14) the storefront
  and Admin Dashboard on at least one real/high-fidelity-emulated phone, tablet, and desktop, in
  both English/LTR and Arabic/RTL, confirming no horizontal overflow and correct touch-target sizing.
- **Security** — confirm: Firestore/Storage Security Rules are the ones deployed in §4 (spot-check
  in the Firebase Console → Firestore/Storage → Rules tab that they match this repo's
  `firestore.rules`/`storage.rules`); no secret (`FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`,
  `CART_COOKIE_SECRET`, `ADMIN_BOOTSTRAP_PASSWORD`) appears anywhere in the deployed client
  JavaScript bundle (only `NEXT_PUBLIC_*` variables are ever inlined client-side — verify by
  searching the built `.next/static` output or the browser's Sources panel for any of these
  values); rate limiting is active (attempt several rapid login/checkout submissions and confirm
  the `RATE_LIMITED` message eventually appears, per Phase 16's `src/lib/utils/rate-limit.ts` wired
  into `createSessionAction`/`submitCheckoutAction`); and that a deliberately-triggered error (e.g.
  an invalid form submission) never surfaces a raw Firestore/Admin-SDK error message or stack
  trace to the browser (Phase 16's T231 audit already confirmed this in code — this step confirms
  it in the deployed build too).
- **Admin Excel export** (T313, Phase 20) — signed in as the production admin account, visit
  `/admin/exports` and download each of the eight report types (Orders, Products, Inventory,
  Customers, Sales, Best Sellers, SOLD OUT, Delivery Locations) against the real production
  Firebase project; confirm each opens as a genuine `.xlsx` (not a corrupt/HTML-wearing-`.xlsx`
  file) with the documented columns and real, current data. Confirm admin-only enforcement holds in
  production: a signed-in non-admin request to any `/admin/api/export/*` route receives a 403 JSON
  response, and an unauthenticated request is redirected to `/login` — never a downloaded file
  either way (same `middleware.ts` layer-1 pre-filter plus each route's own independent
  `requireAdmin()`, verified in Phase 17's `tests/e2e/admin-export.spec.ts`).

## 12. Ongoing operations

- `npm run build && npm run lint && npm run typecheck` locally (or via `.github/workflows/ci.yml`
  in CI) before every merge to `main` — Vercel will also run its own build on every push, but
  catching failures in CI first avoids a broken production deploy.
- New admins: re-run `create-admin` with different bootstrap env vars, or directly set
  `role: "ADMIN"` on an existing `users/{uid}` document in the Firebase Console.
- Rotate `CART_COOKIE_SECRET` only with awareness that it invalidates every existing guest cart
  cookie (registered-customer carts are unaffected, since those are keyed by `uid`, not the
  cookie).
- This document, `docs/setup.md`, and `docs/testing.md` should be kept accurate as the source of
  truth for anyone new operating this project — update them alongside any change that affects the
  steps above.
