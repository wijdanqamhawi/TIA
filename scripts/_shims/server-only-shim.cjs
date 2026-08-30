/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * CJS preload that no-ops `require("server-only")` for standalone CLI
 * scripts (scripts/*.ts run via `tsx`, outside Next.js's webpack build).
 *
 * `server-only` unconditionally throws when required directly — Next.js
 * only makes it a safe no-op by aliasing it away for server bundles at
 * webpack build time. A CLI script has no client/server bundle split at
 * all (it's just Node), so that guard is meaningless here and would
 * otherwise break every script that imports `src/lib/firebase/*`
 * (research.md §2, §8) — this restores the same no-op behavior Next
 * gives those modules for free inside the app itself. Loaded via
 * `node --require` (a CJS preload) rather than an ESM loader hook,
 * because tsx transpiles a `.ts` file with no `"type": "module"` in
 * package.json to CommonJS, so only patching `Module._load` intercepts
 * the `require("server-only")` call.
 */
const Module = require("module");
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};
