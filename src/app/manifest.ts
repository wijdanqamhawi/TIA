import type { MetadataRoute } from "next";
import { PWA_THEME_COLOR, PWA_BACKGROUND_COLOR } from "@/lib/config/brandColors";

/**
 * The web app manifest (T189, research.md §23), served at
 * `/manifest.webmanifest` via Next.js App Router's built-in metadata-route
 * convention. Icons come from the set generated in `public/icons/`
 * (T190, `scripts/generate-pwa-icons.mjs`) from the single official logo
 * asset — never a separate generated mark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TIA — Accessories & More",
    short_name: "TIA",
    description: "TIA — Accessories & More. Rings, earrings, bracelets and necklaces.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: PWA_THEME_COLOR,
    background_color: PWA_BACKGROUND_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
