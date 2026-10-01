import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Client/server boundary guard. A Client Component's static import graph must
 * never reach `firebase-admin`, `server-only` or a Node built-in — webpack
 * cannot bundle them for the browser ("Module not found: Can't resolve
 * 'net'"). This walks the real import graph of the client entry points, the
 * same way the bundler would: runtime imports only (type-only imports are
 * erased), and it stops at `"use server"` modules because a client import of
 * a Server Action is replaced by an RPC reference, never bundled.
 */

const ROOT = process.cwd();
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];
const NODE_ONLY = new Set(builtinModules);

type Crawl = { files: Set<string>; serverActionBoundaries: Set<string>; forbidden: string[] };

function resolveLocal(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? resolve(ROOT, "src", specifier.slice(2))
    : resolve(dirname(from), specifier);
  for (const ext of ["", ...EXTENSIONS]) {
    const candidate = base + ext;
    if (/\.(ts|tsx)$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Specifiers of the module's RUNTIME imports/re-exports (type-only ones removed). */
function runtimeSpecifiers(source: string): string[] {
  const found: string[] = [];
  const importFrom = /(?:^|\n)\s*import\s+(type\s+)?([\w$*\s{},]+?)\s+from\s*["']([^"']+)["']/g;
  const sideEffect = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;
  const reExport =
    /(?:^|\n)\s*export\s+(type\s+)?(\*|\{[^}]*\})(?:\s+as\s+\w+)?\s*from\s*["']([^"']+)["']/g;

  for (const [, typeOnly, clause, specifier] of source.matchAll(importFrom)) {
    if (typeOnly) continue;
    const named = clause!.match(/\{([^}]*)\}/)?.[1];
    const defaultOrNamespace = clause!.replace(/\{[^}]*\}/, "").replace(/[,\s]/g, "");
    const allInlineTypes =
      named !== undefined &&
      !defaultOrNamespace &&
      named
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .every((part) => part.startsWith("type "));
    if (!allInlineTypes) found.push(specifier!);
  }
  for (const [, specifier] of source.matchAll(sideEffect)) found.push(specifier!);
  for (const [, typeOnly, , specifier] of source.matchAll(reExport)) {
    if (!typeOnly) found.push(specifier!);
  }
  return found;
}

function crawl(entry: string): Crawl {
  const result: Crawl = { files: new Set(), serverActionBoundaries: new Set(), forbidden: [] };
  const queue = [resolve(ROOT, entry)];

  while (queue.length) {
    const file = queue.pop()!;
    if (result.files.has(file)) continue;
    result.files.add(file);
    const source = readFileSync(file, "utf8");
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");

    for (const specifier of runtimeSpecifiers(source)) {
      const bare = specifier.replace(/^node:/, "");
      const local = specifier.startsWith("@/") || specifier.startsWith(".");
      if (!local) {
        if (
          specifier === "server-only" ||
          specifier === "firebase-admin" ||
          specifier.startsWith("firebase-admin/") ||
          specifier.startsWith("node:") ||
          NODE_ONLY.has(bare.split("/")[0]!)
        ) {
          result.forbidden.push(`${rel} → ${specifier}`);
        }
        continue;
      }
      const target = resolveLocal(file, specifier);
      if (!target) continue;
      if (
        /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*["']use server["']/.test(
          readFileSync(target, "utf8"),
        )
      ) {
        result.serverActionBoundaries.add(target.slice(ROOT.length + 1).replace(/\\/g, "/"));
        continue;
      }
      queue.push(target);
    }
  }
  return result;
}

const rel = (files: Set<string>) =>
  [...files].map((f) => f.slice(ROOT.length + 1).replace(/\\/g, "/"));

describe("client bundle boundary", () => {
  it("the walker itself works: it flags a server-only module's import of the Admin SDK", () => {
    const { forbidden } = crawl("src/lib/domain/admin/dashboard.service.ts");
    expect(forbidden.some((entry) => entry.includes("server-only"))).toBe(true);
    expect(forbidden.some((entry) => entry.includes("firebase-admin"))).toBe(true);
  });

  it("the Special Offers client page never reaches firebase-admin, server-only or a Node built-in", () => {
    const { files, forbidden, serverActionBoundaries } = crawl(
      "src/components/admin/AdminOffersManager.tsx",
    );
    expect(forbidden).toEqual([]);

    const graph = rel(files);
    // It really walked into the offer logic (so an empty graph can't pass this test)…
    expect(graph).toContain("src/lib/domain/admin/offer-list.ts");
    expect(graph).toContain("src/lib/domain/catalog/offer.ts");
    // …and never into the Firebase helpers.
    expect(graph.filter((f) => /src\/lib\/firebase\//.test(f))).toEqual([]);
    // The save goes through a Server Action, which is a boundary, not client code.
    expect([...serverActionBoundaries]).toContain("src/actions/admin/product.actions.ts");
  });

  it("the product form (the second offer editor) is client-safe too", () => {
    const { forbidden, files } = crawl("src/components/admin/ProductForm.tsx");
    expect(forbidden).toEqual([]);
    expect(rel(files)).toContain("src/lib/domain/catalog/offer-discount.ts");
  });

  it("the shared offer logic stays pure", () => {
    for (const entry of [
      "src/lib/domain/catalog/offer.ts",
      "src/lib/domain/catalog/offer-discount.ts",
      "src/lib/domain/admin/offer-list.ts",
    ]) {
      expect(crawl(entry).forbidden, entry).toEqual([]);
    }
  });
});
