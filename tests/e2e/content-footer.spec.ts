import { test, expect, type Page } from "./fixtures/base";

/**
 * T217: About/Contact/Footer render correctly, all four legal routes
 * resolve, and footer social links (Phase 13) match the Navbar's
 * destinations, in both languages.
 */

const LEGAL_ROUTES = [
  { path: "/shipping-delivery", en: "Shipping & Delivery", ar: "الشحن والتوصيل" },
  { path: "/returns-exchange", en: "Returns & Exchange", ar: "الإرجاع والاستبدال" },
  { path: "/privacy-policy", en: "Privacy Policy", ar: "سياسة الخصوصية" },
  { path: "/terms-conditions", en: "Terms & Conditions", ar: "الشروط والأحكام" },
] as const;

async function socialIsConfigured(page: Page): Promise<{ instagram: boolean; whatsapp: boolean }> {
  await page.goto("/en");
  const footer = page.getByRole("contentinfo");
  return {
    instagram: (await footer.locator('a[href*="instagram.com"]').count()) > 0,
    whatsapp: (await footer.locator('a[href*="wa.me"]').count()) > 0,
  };
}

test.describe("content pages — About", () => {
  test("renders the brand-identity content in English and Arabic", async ({ page }) => {
    await page.goto("/en/about");
    await expect(page.getByRole("heading", { name: "About ELORA JEWELLERY", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Our Story" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/en/contact");

    await page.goto("/ar/about");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "من نحن - إيلورا للمجوهرات", level: 1 })).toBeVisible();
  });
});

test.describe("content pages — Contact", () => {
  test("presents only real, centrally-configured channels — never a fabricated contact detail", async ({ page }) => {
    const configured = await socialIsConfigured(page);

    await page.goto("/en/contact");
    await expect(page.getByRole("heading", { name: "Contact Us", level: 1 })).toBeVisible();

    if (configured.whatsapp) {
      const whatsappCta = page.getByRole("link", { name: /Chat with us on WhatsApp/ });
      await expect(whatsappCta).toBeVisible();
      const href = await whatsappCta.getAttribute("href");
      expect(href).toMatch(/^https:\/\/wa\.me\/\d+/);
      await expect(whatsappCta).toHaveAttribute("target", "_blank");
      const rel = (await whatsappCta.getAttribute("rel")) ?? "";
      expect(rel).toContain("noopener");
    } else {
      await expect(page.getByText("Our contact channels are being set up")).toBeVisible();
    }

    await page.goto("/ar/contact");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "تواصلي معنا", level: 1 })).toBeVisible();
  });
});

test.describe("content pages — legal placeholders", () => {
  for (const route of LEGAL_ROUTES) {
    test(`${route.path} resolves with a clearly-marked placeholder notice, in both languages`, async ({ page }) => {
      await page.goto(`/en${route.path}`);
      await expect(page.getByRole("heading", { name: route.en, level: 1 })).toBeVisible();
      await expect(page.getByText("Content Pending")).toBeVisible();
      // Never a fabricated policy paragraph — only the pending notice.
      await expect(page.getByText(/store owner/i)).toBeVisible();

      await page.goto(`/ar${route.path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByRole("heading", { name: route.ar, level: 1 })).toBeVisible();
      await expect(page.getByText("المحتوى قيد الإعداد")).toBeVisible();
    });
  }
});

test.describe("content pages — Footer", () => {
  test("every footer link resolves (no 404) in English", async ({ page, request }) => {
    await page.goto("/en");
    const footer = page.getByRole("contentinfo");

    const hrefs = await footer.locator("a").evaluateAll((anchors) =>
      anchors
        .map((a) => a.getAttribute("href"))
        .filter((href): href is string => Boolean(href) && href!.startsWith("/")),
    );

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const response = await request.get(new URL(href, page.url()).toString());
      expect(response.status(), `expected ${href} to resolve, got ${response.status()}`).toBeLessThan(400);
    }
  });

  test("reflows to a single stacked column on mobile and a multi-column row on desktop, with no horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    const overflowMobile = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(overflowMobile).toBe(true);

    const footer = page.getByRole("contentinfo");
    const logoBox = await footer.locator("img").first().boundingBox();
    const shopHeadingBox = await footer.getByRole("heading", { name: "Shop" }).boundingBox();
    // Stacked: the second column's heading starts below the first column's logo.
    expect(shopHeadingBox!.y).toBeGreaterThan(logoBox!.y);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    const overflowDesktop = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(overflowDesktop).toBe(true);

    const logoBoxDesktop = await footer.locator("img").first().boundingBox();
    const shopHeadingBoxDesktop = await footer.getByRole("heading", { name: "Shop" }).boundingBox();
    // Side-by-side: roughly the same y, not stacked.
    expect(Math.abs(shopHeadingBoxDesktop!.y - logoBoxDesktop!.y)).toBeLessThan(40);
  });

  test("never leaves an empty desktop column when social links are unconfigured", async ({ page }) => {
    const configured = await socialIsConfigured(page);
    test.skip(configured.instagram || configured.whatsapp, "This check only applies when social links are unconfigured.");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en");
    const footer = page.getByRole("contentinfo");
    const columns = await footer.locator(":scope > div").first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.gridTemplateColumns.split(" ").length;
    });
    // With no "Follow Us" column, the grid should have 3 tracks, not a
    // stale 4th empty one.
    expect(columns).toBe(3);
  });

  test("footer Instagram/WhatsApp destinations exactly match the Navbar's (Phase 13)", async ({ page }) => {
    const configured = await socialIsConfigured(page);
    test.skip(!configured.instagram && !configured.whatsapp, "No social channels configured on this server instance.");

    await page.goto("/en");
    const header = page.getByRole("banner");
    const footer = page.getByRole("contentinfo");

    if (configured.instagram) {
      const headerHref = await header.locator('a[href*="instagram.com"]').first().getAttribute("href");
      const footerHref = await footer.locator('a[href*="instagram.com"]').first().getAttribute("href");
      expect(footerHref).toBe(headerHref);
    }
    if (configured.whatsapp) {
      const headerHref = await header.locator('a[href*="wa.me"]').first().getAttribute("href");
      const footerHref = await footer.locator('a[href*="wa.me"]').first().getAttribute("href");
      expect(footerHref).toBe(headerHref);
    }
  });
});
