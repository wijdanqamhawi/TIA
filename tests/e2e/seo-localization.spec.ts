import { test, expect } from "./fixtures/base";

/**
 * T248 (Phase 17, quickstart Scenario 13 step 11): verifies the Phase 15
 * SEO work (src/lib/seo/metadata.ts, src/app/sitemap.ts) actually
 * produces distinct per-locale titles/descriptions/canonical/hreflang in
 * the rendered HTML, and that both locale variants appear in the
 * sitemap — this test verifies that existing implementation, it does not
 * build it.
 */

test.describe("localized SEO metadata", () => {
  test("home page has distinct, correctly-localized title/canonical/hreflang per locale", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/TIA/);
    const enTitle = await page.title();

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en$/);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en$/);
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveAttribute("href", /\/ar$/);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/en$/);

    await page.goto("/ar");
    const arTitle = await page.title();
    expect(arTitle).not.toBe(enTitle);
    expect(arTitle).toMatch(/تيا/);

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/ar$/);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en$/);
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveAttribute("href", /\/ar$/);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/en$/);
  });

  test("product page has distinct, correctly-localized title/canonical/hreflang per locale", async ({ page }) => {
    await page.goto("/en/shop/golden-bangle-bracelet");
    const enTitle = await page.title();
    expect(enTitle).toMatch(/Golden Bangle Bracelet/);

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/en\/shop\/golden-bangle-bracelet$/,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      "href",
      /\/en\/shop\/golden-bangle-bracelet$/,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveAttribute(
      "href",
      /\/ar\/shop\/golden-bangle-bracelet$/,
    );

    await page.goto("/ar/shop/golden-bangle-bracelet");
    const arTitle = await page.title();
    expect(arTitle).not.toBe(enTitle);
    expect(arTitle).toMatch(/سوار ذهبي/);

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/ar\/shop\/golden-bangle-bracelet$/,
    );
  });

  test("sitemap.xml includes both locale variants, with hreflang alternates, for the home and product pages", async ({
    request,
  }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);
    const body = await response.text();

    expect(body).toContain("<loc>http://localhost:3000/en</loc>");
    expect(body).toContain("<loc>http://localhost:3000/ar</loc>");
    expect(body).toContain("<loc>http://localhost:3000/en/shop/golden-bangle-bracelet</loc>");
    expect(body).toContain("<loc>http://localhost:3000/ar/shop/golden-bangle-bracelet</loc>");

    expect(body).toContain('hreflang="en" href="http://localhost:3000/en/shop/golden-bangle-bracelet"');
    expect(body).toContain('hreflang="ar" href="http://localhost:3000/ar/shop/golden-bangle-bracelet"');
    expect(body).toContain('hreflang="x-default" href="http://localhost:3000/en/shop/golden-bangle-bracelet"');
  });

  test("robots.txt disallows admin/account/cart/checkout under both locale prefixes", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBe(true);
    const body = await response.text();

    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /api");
    for (const locale of ["en", "ar"]) {
      expect(body).toContain(`Disallow: /${locale}/account`);
      expect(body).toContain(`Disallow: /${locale}/cart`);
      expect(body).toContain(`Disallow: /${locale}/checkout`);
    }
    expect(body).toContain("Sitemap: http://localhost:3000/sitemap.xml");
  });
});
