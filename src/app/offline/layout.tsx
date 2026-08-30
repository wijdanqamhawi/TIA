import "../globals.css";

/**
 * `/offline` has no shared root layout with `[locale]/**` or `admin/**`
 * (it's intentionally outside both — a single, non-locale-prefixed URL the
 * service worker can precache and fall back to, T196) — Next.js still
 * requires every route to resolve to *some* layout providing `<html>`/
 * `<body>`, so this is that minimal shell. The page itself picks the
 * actual `lang`/`dir` client-side from the `NEXT_LOCALE` cookie.
 */
export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
