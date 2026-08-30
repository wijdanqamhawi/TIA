// Vitest stub for the `server-only` package (mirrors what Next.js's own
// webpack config does: aliases it to a no-op for server-side bundles/tests,
// since the real package unconditionally throws when imported outside
// Next's build-time client/server aliasing).
export {};
