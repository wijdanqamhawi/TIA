import type { Config } from "tailwindcss";

// Tailwind CSS v4 is CSS-first — brand design tokens live in
// `src/app/globals.css` via `@theme` (T004). This file exists for
// editor/tooling support and any future JS-side config (plugins, safelist)
// that CSS-first config can't express.
const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./messages/**/*.json",
  ],
};

export default config;
