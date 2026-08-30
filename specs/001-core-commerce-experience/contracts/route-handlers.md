# Contracts: Route Handlers

**Revision note (2026-08-26)**: Updated for the Firebase migration. The Auth.js catch-all route
and the Cloudinary signing route are removed (no longer applicable); a Firestore/Storage-backed
approach needs no equivalent signing endpoint (research.md §11). All other Route Handlers are
unchanged in purpose.

**Revision note (2026-08-27)**: Added the admin-only Excel export endpoints below (spec
FR-099–FR-112, research.md §45–§46). These are the first Route Handlers in this application that
require admin authorization, so their auth model is spelled out explicitly rather than only
inheriting the general rule in the paragraph above.

Route Handlers (`app/api/**/route.ts`) are used only where a dedicated HTTP interface is more
appropriate than a Server Action — i.e., where a third party (browser fetch to an external
service, a webhook sender, a crawler, or a non-form client) needs a conventional HTTP endpoint.
Every handler applies the same auth/validation/error-shape rules as Server Actions
(`contracts/server-actions.md`): authentication is verified via the Firebase Admin SDK against the
session cookie, never trusted from client-supplied headers or body fields.

## Authentication

Firebase Authentication's client SDK handles sign-in/sign-up directly against the Firebase Auth
service from the browser — there is no `/api/auth/[...nextauth]`-style catch-all route in this
architecture. The only server-side auth endpoint this app defines is the session-cookie exchange,
which is implemented as a Server Action (`createSessionAction`, see `server-actions.md`) rather
than a Route Handler, consistent with the "prefer Server Actions for mutations" directive — minting
a session cookie is a mutation (it sets a cookie), not a resource fetch.

## SEO infrastructure

| Route | Method | Purpose |
|---|---|---|
| `/sitemap.xml` (`app/sitemap.ts`) | GET | Generated from persisted `products`, `categories`, `collections` documents (read via the Admin SDK) plus static routes (home, shop, about, contact, legal pages) — emitted as **both** `/en/...` and `/ar/...` entries per URL, with `hreflang` alternate annotations linking each pair (research.md §35). Regenerated per Next.js's sitemap conventions; reflects current catalog, not a fixed list. |
| `/robots.txt` (`app/robots.ts`) | GET | Disallows `/admin`, `/account`, `/cart`, `/checkout`, `/api` (under both locale prefixes); allows public storefront routes in both `/en/` and `/ar/`. |

## Health / readiness (operational, not customer-facing)

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Unauthenticated, minimal endpoint used by the hosting platform / uptime checks; verifies the process is up and the Admin SDK can reach Firestore (a trivial read); returns no sensitive detail on failure (Constitution Principle 15). |

## Admin — Data Export (Excel/.xlsx)

Every route below requires an authenticated **admin** session, independently re-verified inside
the handler via `requireAdmin()` (research.md §9, §46) — a Route Handler is not wrapped by
`admin/layout.tsx`'s guard, so this check is not optional. Handlers live under `/admin/api/**` so
they also inherit `middleware.ts`'s `/admin/*` cookie-presence pre-filter (layer 1 of 3). Every
handler reads live Firestore data via the Admin SDK at request time and streams back a real
`.xlsx` file (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
`Content-Disposition: attachment`) generated with ExcelJS (research.md §45) — never a cached or
pre-generated file. A non-admin or unauthenticated request receives a safe, generic 401/403 JSON
error, never a partial file.

| Route | Method | Query filters | Purpose |
|---|---|---|---|
| `/admin/api/export/orders` | GET | `from`, `to` (date range), `status`, `regionId` | Orders report — order number, date, customer name/phone/email, region, city/area, address, products/quantities/prices, total, payment method, status, guest-vs-registered (spec FR-102). Uses ExcelJS's streaming writer over paginated Firestore reads (research.md §45). |
| `/admin/api/export/products` | GET | `categoryId` | Products report — id, English/Arabic name, category, price, stock, derived SOLD OUT, availability, New Arrival, Best Seller (spec FR-103). |
| `/admin/api/export/inventory` | GET | `lowStockThreshold` | Same product fields as above, optionally filtered to `stock <= lowStockThreshold` (spec FR-108's "low-stock products" filter). |
| `/admin/api/export/sold-out` | GET | *(none)* | Products where derived `stock === 0` only (spec FR-106) — same underlying query as the storefront's Sold Out derivation (research.md, data-model.md), never a separately-maintained list. |
| `/admin/api/export/customers` | GET | *(none)* | Registered-customer profile + order-history summary (spec FR-104) — never includes credential/password material (none is ever stored). |
| `/admin/api/export/sales` | GET | `from`, `to` | Sales figures computed identically to the dashboard's own statistics (spec FR-045, FR-105) — excludes cancelled orders. |
| `/admin/api/export/best-sellers` | GET | `from`, `to` | Best-selling products ranked by cumulative quantity sold, excluding cancelled orders (spec FR-105), matching the dashboard's own ranking. |
| `/admin/api/export/delivery-locations` | GET | *(none)* | Every delivery region/city with bilingual name, active state, display order (spec FR-107). |

There is no corresponding `POST`/upload route for any of these — Excel import does not exist
anywhere in this application (spec FR-110); editing a downloaded file has no path back into
Firestore.

## What is intentionally *not* a Route Handler

Cart, wishlist, checkout, account, and all admin CRUD mutations are Server Actions
(`contracts/server-actions.md`), not Route Handlers, per the user's directive to prefer Server
Actions for application mutations. Product image upload also does **not** go through a Route
Handler: the admin's browser uploads directly to Firebase Storage using the Firebase client SDK,
authorized by Firebase Storage Security Rules checking the caller's `ADMIN` custom claim
(research.md §11) — this replaces the Cloudinary signed-upload Route Handler the MongoDB-era plan
used, since Firebase Storage's own security rules make a server-side signing step unnecessary.
Route Handlers here are reserved for machine-readable SEO/ops endpoints only.
