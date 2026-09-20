import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Integration tests run against the Firebase Local Emulator Suite
// (research.md §14). Start it first: `firebase emulators:start`.
// `npm run test:unit` never needs the emulators running.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // The real `server-only` package unconditionally throws — Next.js's
      // own webpack config aliases it to a no-op in server bundles; do the
      // same here so server-side modules are importable under Vitest.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          globals: true,
          include: ["tests/integration/**/*.test.ts"],
          testTimeout: 20000,
          // Every integration file talks to the *same* emulator database,
          // so running files in parallel lets one file's writes land in
          // the middle of another's read. `export-sold-out.test.ts`, for
          // instance, asserts the SOLD OUT export matches the whole
          // `products` collection exactly — true of any single consistent
          // state, but not of a collection another worker is mutating
          // mid-assertion. One file at a time keeps the shared database a
          // sequence of known states (the same reason e2e runs
          // `--workers=1`); the whole project is only a few seconds.
          fileParallelism: false,
        },
      },
    ],
  },
});
