// @vitest-environment node
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resolvePostLoginPath } from "@/lib/auth/post-login-path";

/**
 * Regression: production mobile Safari customer login ended on a Next.js 404.
 *
 * `/[locale]/account/*` guards redirect a guest to `/en/login?next=/en/account` (and the
 * bottom-nav "Account" tab sends guests there from `/`). After sign-in the login page called
 * next-intl's `router.push(next)`, which prefixes the locale unconditionally -> `/en/en/account`
 * (no such route). The login page now passes `next` through `resolvePostLoginPath` first.
 */

const APP = path.resolve(__dirname, "../../src/app");

/** Does a page exist for this URL path in the real `src/app` tree? (route groups + [params]) */
function routeExists(urlPath: string, dir = APP, segments = urlPath.split("/").filter(Boolean)): boolean {
  if (segments.length === 0) {
    if (existsSync(path.join(dir, "page.tsx"))) return true;
    return readdirSync(dir, { withFileTypes: true }).some(
      (e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && routeExists("", path.join(dir, e.name), []),
    );
  }
  const [head, ...rest] = segments;
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .some((e) => {
      const group = /^\(.+\)$/.test(e.name);
      const dynamic = /^\[[^\]]+\]$/.test(e.name);
      const sub = path.join(dir, e.name);
      if (group) return routeExists(urlPath, sub, segments);
      if (e.name === head || dynamic) return routeExists(urlPath, sub, rest);
      return false;
    });
}

/** What next-intl's `useRouter().push(href)` navigates to with `localePrefix: "always"`. */
const intlPush = (locale: string, href: string) => `/${locale}${href === "/" ? "" : href}`;

describe("route-existence helper sanity", () => {
  it("knows the real routes and rejects the double-prefixed one", () => {
    expect(routeExists("/en/account")).toBe(true);
    expect(routeExists("/ar/account/orders")).toBe(true);
    expect(routeExists("/en")).toBe(true);
    expect(routeExists("/en/en/account")).toBe(false);
  });
});

describe("customer login redirect (production-style root/locale flow)", () => {
  // Exactly what the app puts in ?next= today.
  const nextFromGuards = (l: string) => [
    `/${l}/account`, // account/page, account/layout, account/orders
    `/${l}/wishlist`, // wishlist/layout
    `/${l}/account/orders/ELR-1/edit`, // order edit guard
    `/${l}/shop/gold-ring`, // ProductCard/ImageGallery heart (next/navigation pathname)
  ];

  it.each(["en", "ar"])("lands on an existing URL, never /%s/%s/... (%s)", (locale) => {
    for (const rawNext of nextFromGuards(locale)) {
      const landed = intlPush(locale, resolvePostLoginPath(rawNext));
      expect(landed, rawNext).toBe(rawNext);
      expect(routeExists(landed), landed).toBe(true);
    }
  });

  it("customer who opened the root and tapped Account lands on /en/account", () => {
    // `/` -> middleware -> `/en`; tab "/account" -> `/en/account`; guard -> login?next=/en/account
    expect(intlPush("en", resolvePostLoginPath("/en/account"))).toBe("/en/account");
    expect(intlPush("ar", resolvePostLoginPath("/ar/account"))).toBe("/ar/account");
  });

  it("locale-less and absent next values still resolve to existing pages", () => {
    expect(intlPush("en", resolvePostLoginPath("/account"))).toBe("/en/account");
    expect(intlPush("ar", resolvePostLoginPath(null))).toBe("/ar");
    expect(intlPush("en", resolvePostLoginPath(""))).toBe("/en");
    expect(routeExists(intlPush("en", resolvePostLoginPath("/en")))).toBe(true);
  });

  it("keeps query strings and leaves /admin untouched (admin login uses a full navigation)", () => {
    expect(resolvePostLoginPath("/en/shop?sort=new")).toBe("/shop?sort=new");
    expect(resolvePostLoginPath("/admin")).toBe("/admin");
    expect(resolvePostLoginPath("/admin/orders")).toBe("/admin/orders");
  });

  it("does not strip look-alike segments and rejects off-site targets", () => {
    expect(resolvePostLoginPath("/english")).toBe("/english");
    expect(resolvePostLoginPath("//evil.example")).toBe("/");
    expect(resolvePostLoginPath("/" + String.fromCharCode(92) + "evil.example")).toBe("/");
    expect(resolvePostLoginPath("https://evil.example")).toBe("/");
  });
});

describe("middleware: the unprefixed production root keeps a locale", () => {
  vi.stubEnv("NODE_ENV", "test");
  it.each([
    ["https://tia-rosy.vercel.app/", "/en"],
    ["https://tia-rosy.vercel.app/account", "/en/account"],
    ["https://tia-rosy.vercel.app/login", "/en/login"],
  ])("%s redirects to %s", async (url, expected) => {
    const { default: middleware } = await import("@/middleware");
    const res = middleware(new NextRequest(url));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe(expected);
  });

  it("honours an Arabic Accept-Language on the root", async () => {
    const { default: middleware } = await import("@/middleware");
    const res = middleware(new NextRequest("https://tia-rosy.vercel.app/", { headers: { "accept-language": "ar" } }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/ar");
  });
});
