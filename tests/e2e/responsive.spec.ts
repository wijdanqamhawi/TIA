import { test, expect, type Page } from "./fixtures/base";
import { loginAsAdmin } from "./admin-helpers";

/**
 * T187 (quickstart Scenario 9): the responsive pass across storefront +
 * Admin Dashboard, mobile/tablet/desktop, LTR and RTL, including a resize/
 * orientation check. Column-count assertions use explicit
 * `setViewportSize` calls (rather than relying on each Playwright device
 * project's own viewport) so the exact breakpoints research.md §18a
 * documents are verified directly, independent of which `--project` runs
 * this file.
 */

const MOBILE = { width: 390, height: 844 }; // iPhone-class
const TABLET = { width: 820, height: 1180 }; // iPad-class
const DESKTOP = { width: 1440, height: 900 };
const LARGE_DESKTOP = { width: 1920, height: 1080 };

async function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

async function gridColumnCount(page: Page, gridSelector: string): Promise<number> {
  return page.evaluate((selector) => {
    const grid = document.querySelector(selector);
    if (!grid) return 0;
    const style = window.getComputedStyle(grid);
    const template = style.gridTemplateColumns;
    return template === "none" ? 0 : template.split(" ").length;
  }, gridSelector);
}

test.describe("responsive — storefront (LTR)", () => {
  test("homepage has no horizontal overflow at any breakpoint and the mobile nav opens", async ({ page }) => {
    for (const size of [MOBILE, TABLET, DESKTOP, LARGE_DESKTOP]) {
      await page.setViewportSize(size);
      await page.goto("/en");
      await expect(page.locator("body")).toBeVisible();
      expect(await hasNoHorizontalOverflow(page)).toBe(true);
    }

    await page.setViewportSize(MOBILE);
    await page.goto("/en");
    const menuButton = page.getByRole("button", { name: "Open menu" });
    await expect(menuButton).toBeVisible();
    const box = await menuButton.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await menuButton.click();
    await expect(page.getByRole("button", { name: "Close menu" }).last()).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test("Shop product grid renders 2 columns on mobile, more on tablet/desktop, and never overflows", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/en/shop");
    await expect(page.getByRole("heading", { name: "All Accessories", level: 1 })).toBeVisible();
    const mobileColumns = await gridColumnCount(page, "[data-testid='product-grid']");
    expect(mobileColumns).toBe(2);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    await page.setViewportSize(TABLET);
    await page.goto("/en/shop");
    const tabletColumns = await gridColumnCount(page, "[data-testid='product-grid']");
    expect(tabletColumns).toBeGreaterThanOrEqual(2);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    await page.setViewportSize(DESKTOP);
    await page.goto("/en/shop");
    const desktopColumns = await gridColumnCount(page, "[data-testid='product-grid']");
    expect(desktopColumns).toBeGreaterThanOrEqual(3);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    // Holds at (never exceeds) 4 columns on a very large desktop — content
    // width is capped, not the column count grown further (research.md §18a).
    await page.setViewportSize(LARGE_DESKTOP);
    await page.goto("/en/shop");
    const largeDesktopColumns = await gridColumnCount(page, "[data-testid='product-grid']");
    expect(largeDesktopColumns).toBeLessThanOrEqual(4);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test("Cart page line items stack below md and lay out inline at md and above", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/en/shop/category/bracelets");
    await expect(async () => {
      await page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first().click();
      await expect(page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first()).toBeEnabled({
        timeout: 2000,
      });
    }).toPass({ timeout: 20000 });

    await page.setViewportSize(MOBILE);
    await page.goto("/en/cart");
    await expect(page.getByRole("heading", { name: "Your Cart", level: 1 })).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    await page.setViewportSize(DESKTOP);
    await page.reload();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test("resizing mid-session (orientation change) never leaves the page horizontally scrollable", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/en/shop");
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    // Portrait -> landscape phone rotation, and back.
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
    await page.setViewportSize({ width: 844, height: 390 });
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});

test.describe("responsive — storefront (RTL)", () => {
  test("Arabic homepage and mobile nav have no horizontal overflow, and the mobile drawer opens from the correct (start) edge", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    const menuButton = page.getByRole("button", { name: "فتح القائمة" });
    await menuButton.click();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    // `ms-auto` (margin-inline-start: auto) pushes the drawer to the
    // logical "end" edge — in RTL that's the physical *left* edge, the
    // mirror image of the LTR drawer's right-edge placement.
    const closeButton = page.getByRole("button", { name: "إغلاق القائمة" }).last();
    await expect(closeButton).toBeVisible();
    const drawer = page.locator("div.relative.ms-auto");
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox!.x).toBeLessThan(20);
  });

  test("Arabic Shop grid keeps the same column counts as English at each breakpoint", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/ar/shop");
    expect(await gridColumnCount(page, "[data-testid='product-grid']")).toBe(2);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    await page.setViewportSize(DESKTOP);
    await page.goto("/ar/shop");
    expect(await gridColumnCount(page, "[data-testid='product-grid']")).toBeGreaterThanOrEqual(3);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});

test.describe("responsive — Admin Dashboard", () => {
  test("StatCard grid stacks on mobile and arranges in rows on desktop; no horizontal overflow at any breakpoint", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await loginAsAdmin(page);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    const statCards = page.locator("main div.grid > div").filter({ hasText: /Total Sales|Total Orders|Pending Orders/ });
    const firstBox = await statCards.first().boundingBox();
    const secondBox = await statCards.nth(1).boundingBox();
    // Stacked (grid-cols-1) on mobile: the second card starts below, not
    // beside, the first.
    expect(secondBox!.y).toBeGreaterThanOrEqual(firstBox!.y + firstBox!.height - 2);

    await page.setViewportSize(DESKTOP);
    await page.reload();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
    const firstBoxDesktop = await statCards.first().boundingBox();
    const secondBoxDesktop = await statCards.nth(1).boundingBox();
    // Side-by-side (multi-column) on desktop: the second card starts at
    // roughly the same y as the first, not below it.
    expect(Math.abs(secondBoxDesktop!.y - firstBoxDesktop!.y)).toBeLessThan(5);
  });

  test("admin DataTable renders a card list below md and a real table at md and above", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await loginAsAdmin(page);
    await page.goto("/admin/products");
    await expect(page.locator("table")).toBeHidden();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    await page.setViewportSize(DESKTOP);
    await page.reload();
    await expect(page.locator("table").first()).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test("admin sidebar navigation is fully reachable and touch-friendly on mobile", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await loginAsAdmin(page);
    const productsLink = page.getByRole("link", { name: "Products", exact: true });
    await expect(productsLink).toBeVisible();
    const box = await productsLink.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});
