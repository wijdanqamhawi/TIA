import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

// T195 (research.md §24): the service worker is only ever registered in a
// production build/deployment, never under `next dev` — a developer's
// local iteration must never be affected by a stale cache, and PWA
// behavior can only be validated with `next build && next start` anyway.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // `@serwist/next`'s webpack plugin builds these glob-matched precache
  // URLs using the host OS's path separator, which produces broken
  // `/icons\icon-192.png`-style (backslash) URLs on Windows that always
  // 404 and leave the service worker stuck installing forever. Disabled
  // here; the same brand/icon assets are precached explicitly with
  // correct forward-slash URLs in `src/app/sw.ts` instead.
  globPublicPatterns: [],
});

const nextConfig: NextConfig = {
  // A stray lockfile in the user's home directory otherwise makes Next.js
  // infer the wrong workspace root.
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      // Production Firebase Storage download URLs (admin-uploaded product/
      // showcase images, T148/T159) — every other image in this app is a
      // local `public/` asset, which needs no entry here.
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      // The Firebase Storage emulator (dev/test only, research.md §14).
      { protocol: "http", hostname: "127.0.0.1", port: "9199" },
      { protocol: "http", hostname: "localhost", port: "9199" },
    ],
  },
};

export default withSerwist(withNextIntl(nextConfig));
