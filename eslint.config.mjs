import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/sw.js",
      "public/swe-worker*.js",
    ],
  },
  {
    rules: {
      // Allow a deliberately-unused destructured binding named `_foo`
      // (e.g. `const { x: _x, ...rest } = obj` to omit a field) without a
      // per-line disable comment.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Playwright fixture definitions (`test.extend(...)`) take a second
    // callback parameter that Playwright itself names `use` — the
    // React-specific `react-hooks/rules-of-hooks` rule mistakes that for a
    // React Hook purely by name coincidence and misfires here; this has
    // nothing to do with React. Scoped to the one file that defines
    // fixtures, not the whole `tests/e2e` tree, so a real React-hook
    // mistake inside a spec's own test body would still be caught.
    files: ["tests/e2e/fixtures/base.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
];

export default eslintConfig;
