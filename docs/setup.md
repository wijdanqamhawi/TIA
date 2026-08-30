# ELORA JEWELLERY — Setup

## Prerequisites

- Node.js 20+
- A Firebase project (Authentication, Cloud Firestore, Storage)
- Firebase CLI (`firebase-tools`, installed as a devDependency; run via `npx firebase ...`)

Primary dependencies beyond the Next.js/React/Firebase/next-intl stack (plan.md "Primary
Dependencies"): `exceljs` (T292) — a server-only dependency, never imported from a Client
Component, used exclusively by the admin-only `/admin/api/export/*` Route Handlers (Phase 20) to
generate real `.xlsx` reports from live Firestore data; there is no corresponding import/upload
capability anywhere in the application.

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values. See that file for
the full list (Firebase client/admin config, `NEXT_PUBLIC_APP_URL`,
`ADMIN_BOOTSTRAP_*`, social config).

## Local development against the Firebase Local Emulator Suite

```bash
npm run emulators   # starts Auth (9099), Firestore (8080), Storage (9199), UI (4000)
npm run dev          # in a second terminal
```

Set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` in `.env.local` so the client
SDK also targets the emulators. The Admin SDK auto-detects the emulator via
the `FIRESTORE_EMULATOR_HOST` etc. environment variables that
`firebase emulators:start` sets automatically.

## Known placeholder — official logo asset

`public/brand/logo.svg` currently holds a **temporary placeholder wordmark**,
not the real official ELORA JEWELLERY logo. Replace that single file with
the real asset before any release — no code changes are needed elsewhere,
since every consumer (`<Logo />`, the PWA icon set generated in Phase 12)
reads from that one path.

## Firebase Console — manual step (Phase 2)

Enable the **Email/Password** sign-in provider under
**Authentication → Sign-in method** before the registration/login flow can
be tested against a real (non-emulator) project. This is a one-time,
per-Firebase-project console step — nothing in the app code can do it for
you. It is not needed against the Local Emulator Suite (the Auth emulator
accepts Email/Password sign-in by default).

## Creating the first administrator

There is no public "register as admin" page (Constitution Principle 6).
Instead, set `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` in
`.env.local` and run:

```bash
npm run create-admin
```

This creates (or reuses) that Firebase Authentication user, sets its
`role: "ADMIN"` custom claim, and mirrors `role: "ADMIN"` onto
`users/{uid}` in Firestore. It's idempotent — safe to run again (e.g. after
rotating the bootstrap password) without creating a duplicate account.
Sign in at `/en/login` (or `/ar/login`) with that email/password to reach
`/admin`.
