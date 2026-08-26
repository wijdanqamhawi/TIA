# Contracts: Route Handlers

**Revision note (2026-08-26)**: Updated for the Firebase migration. The Auth.js catch-all route
and the Cloudinary signing route are removed (no longer applicable); a Firestore/Storage-backed
approach needs no equivalent signing endpoint (research.md §11). All other Route Handlers are
unchanged in purpose.

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

## What is intentionally *not* a Route Handler

Cart, wishlist, checkout, account, and all admin CRUD mutations are Server Actions
(`contracts/server-actions.md`), not Route Handlers, per the user's directive to prefer Server
Actions for application mutations. Product image upload also does **not** go through a Route
Handler: the admin's browser uploads directly to Firebase Storage using the Firebase client SDK,
authorized by Firebase Storage Security Rules checking the caller's `ADMIN` custom claim
(research.md §11) — this replaces the Cloudinary signed-upload Route Handler the MongoDB-era plan
used, since Firebase Storage's own security rules make a server-side signing step unnecessary.
Route Handlers here are reserved for machine-readable SEO/ops endpoints only.
