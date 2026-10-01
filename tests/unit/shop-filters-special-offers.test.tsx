import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

/**
 * The Special Offers option in the Shop's Category filter: a virtual,
 * URL-driven scope (not a Firestore category), listed after the real
 * categories, styled exactly like them, and working alongside them.
 */

const pushMock = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const { ShopFilters } = await import("@/components/storefront/shop/ShopFilters");

const CATEGORIES = [
  { slug: "bracelets", label: "Bracelets" },
  { slug: "rings", label: "Rings" },
  { slug: "earrings", label: "Earrings" },
  { slug: "watches", label: "Watches" },
];

function renderFilters(
  props: Partial<Parameters<typeof ShopFilters>[0]> = {},
  locale: "en" | "ar" = "en",
) {
  const messages = (locale === "en" ? en : ar) as never;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ShopFilters
        pathname="/shop"
        current={{}}
        categories={
          locale === "en" ? CATEGORIES : CATEGORIES.map((c) => ({ ...c, label: `${c.label}-ar` }))
        }
        activeCategorySlug=""
        priceDisabled={false}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

/** The rows of the Category section (excluding its collapse header). */
function categoryRows(label = "Category") {
  const section = screen.getByText(label).closest("section")!;
  return within(section).getAllByRole("button").slice(1);
}

beforeEach(() => pushMock.mockReset());
afterEach(cleanup);

describe("Special Offers filter row", () => {
  it("appears after Watches, in the requested order", () => {
    renderFilters();
    expect(categoryRows().map((row) => row.textContent)).toEqual([
      "All Products",
      "Bracelets",
      "Rings",
      "Earrings",
      "Watches",
      "Special Offers",
    ]);
  });

  it("is a virtual option: the real category list it is given is not changed or extended", () => {
    renderFilters();
    // Four real categories were passed in; the extra row comes from the component, not from data.
    expect(CATEGORIES).toHaveLength(4);
    expect(categoryRows()).toHaveLength(6);
  });

  it("looks exactly like the category rows: same checkbox, typography, spacing and behaviour classes", () => {
    renderFilters();
    const rows = categoryRows();
    const watches = rows[4]!;
    const offers = rows[5]!;
    expect(offers.className).toBe(watches.className);
    expect(offers.tagName).toBe(watches.tagName);
    expect(offers.querySelector("span")!.className).toBe(watches.querySelector("span")!.className); // the checkbox
  });

  it("is unchecked by default, with All Products checked", () => {
    renderFilters();
    const rows = categoryRows();
    const checked = (row: HTMLElement) =>
      row.querySelector("span")!.className.includes("bg-brand-burgundy");
    expect(checked(rows[0]!)).toBe(true);
    expect(checked(rows[5]!)).toBe(false);
  });

  it("when selected, it is checked and All Products is not (no category is checked either)", () => {
    renderFilters({ specialOffersActive: true });
    const rows = categoryRows();
    const checked = (row: HTMLElement) =>
      row.querySelector("span")!.className.includes("bg-brand-burgundy");
    expect(rows.map(checked)).toEqual([false, false, false, false, false, true]);
  });

  it("selecting it goes to /shop?collection=special-offers — from a clean URL, dropping every other filter", () => {
    renderFilters({
      current: { category: "rings", q: "gold", min: "10000", sort: "price" },
      activeCategorySlug: "rings",
    });
    fireEvent.click(categoryRows()[5]!);
    expect(pushMock).toHaveBeenCalledWith("/shop?collection=special-offers");
  });

  it("clicking it again turns the scope off", () => {
    renderFilters({ current: { collection: "special-offers" }, specialOffersActive: true });
    fireEvent.click(categoryRows()[5]!);
    expect(pushMock).toHaveBeenCalledWith("/shop");
  });

  it("the real category filters keep working, from the offers scope and from each other", () => {
    renderFilters({ current: { collection: "special-offers" }, specialOffersActive: true });
    fireEvent.click(categoryRows()[2]!); // Rings
    expect(pushMock).toHaveBeenLastCalledWith("/shop?category=rings");
    fireEvent.click(categoryRows()[0]!); // All Products
    expect(pushMock).toHaveBeenLastCalledWith("/shop");
    cleanup();

    renderFilters({ current: { category: "rings" }, activeCategorySlug: "rings" });
    fireEvent.click(categoryRows()[4]!); // Watches
    expect(pushMock).toHaveBeenLastCalledWith("/shop?category=watches");
    fireEvent.click(categoryRows()[2]!); // Rings again — toggles off
    expect(pushMock).toHaveBeenLastCalledWith("/shop");
  });

  it("closes the mobile drawer after choosing it (onNavigate)", () => {
    const onNavigate = vi.fn();
    renderFilters({ onNavigate });
    fireEvent.click(categoryRows()[5]!);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("is labelled العروض الخاصة in Arabic, in the same last position, with no raw keys", () => {
    const { container } = renderFilters({}, "ar");
    const rows = categoryRows(ar.Shop.category);
    expect(rows.at(-1)!.textContent).toBe("العروض الخاصة");
    expect(rows).toHaveLength(6);
    expect(container.textContent).not.toMatch(/Shop\.|specialOffers/);
  });

  it("has English and Arabic strings", () => {
    expect(en.Shop.specialOffers).toBe("Special Offers");
    expect(ar.Shop.specialOffers).toBe("العروض الخاصة");
  });

  it("uses only logical (RTL-mirroring) direction classes, like the rest of the filter", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/storefront/shop/ShopFilters.tsx"),
      "utf8",
    );
    const classNames = [...source.matchAll(/className=\{?[`"]([^`"]*)[`"]/g)]
      .map((m) => m[1])
      .join(" ");
    expect(classNames).not.toMatch(/(?<![\w-])(?:ml|mr|pl|pr|left|right|text-left|text-right)-/);
  });
});
