import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Timestamp } from "firebase-admin/firestore";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import {
  buildOfferData,
  computeOfferStats,
  discountPercent,
  filterOffers,
  parseOfferStatusFilter,
  toDateTimeLocalValue,
} from "@/lib/domain/admin/offer-list";
import type { OfferRow } from "@/lib/domain/admin/offer-list";
import type { Product } from "@/types/product";
import { formatCurrency } from "@/lib/utils/currency";

/**
 * Admin Special Offers at /admin/offers: the sidebar entry, the derived
 * Active / Scheduled / Expired list (read from the existing product offer
 * fields — no offers collection), and the New Offer / Edit drawers, which save
 * through the existing `updateProductAction` (mocked — nothing is written).
 */

let pathname = "/admin";
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));
vi.mock("@/components/admin/AdminLanguageToggle", () => ({ AdminLanguageToggle: () => null }));
vi.mock("@/components/admin/AdminAccountMenu", () => ({ AdminAccountMenu: () => null }));
const updateMock = vi.fn();
const deleteMock = vi.fn();
vi.mock("@/actions/admin/product.actions", () => ({
  updateProductAction: (input: unknown) => updateMock(input),
  deleteProductAction: (input: unknown) => deleteMock(input),
}));

const { AdminShell } = await import("@/components/admin/AdminShell");
const { AdminOffersManager } = await import("@/components/admin/AdminOffersManager");

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
});

beforeEach(() => {
  pathname = "/admin";
  updateMock.mockReset().mockResolvedValue({ ok: true, data: null });
  deleteMock.mockReset();
  refreshMock.mockReset();
});

afterEach(cleanup);

// ── Sidebar ───────────────────────────────────────────────────────────────────

function renderShell(locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? en : ar;
  render(
    <NextIntlClientProvider locale={locale} messages={{ AdminShell: messages.AdminShell }}>
      <AdminShell account={{} as never}>
        <p>page</p>
      </AdminShell>
    </NextIntlClientProvider>,
  );
  return within(screen.getByRole("navigation", { name: messages.AdminShell.menu }));
}

describe("sidebar — Special Offers", () => {
  it("links to /admin/offers, and the App Router page for it exists", () => {
    const nav = renderShell();
    expect(nav.getByRole("link", { name: "Special Offers" }).getAttribute("href")).toBe(
      "/admin/offers",
    );
    expect(existsSync(resolve(process.cwd(), "src/app/admin/offers/page.tsx"))).toBe(true);
  });

  it("is the active item on /admin/offers, and Products is not", () => {
    pathname = "/admin/offers";
    const nav = renderShell();
    expect(nav.getByRole("link", { name: "Special Offers" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(nav.getByRole("link", { name: "Products" }).getAttribute("aria-current")).toBeNull();
  });

  it("stays inactive elsewhere: on Products only Products is active", () => {
    pathname = "/admin/products";
    const nav = renderShell();
    expect(nav.getByRole("link", { name: "Products" }).getAttribute("aria-current")).toBe("page");
    expect(
      nav.getByRole("link", { name: "Special Offers" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("no longer uses the old /admin/products?status=onSale navigation, in either language", () => {
    for (const locale of ["en", "ar"] as const) {
      const nav = renderShell(locale);
      const hrefs = nav.getAllByRole("link").map((link) => link.getAttribute("href"));
      expect(
        hrefs.filter((href) => href?.includes("onSale") || href?.includes("?status=")),
      ).toEqual([]);
      expect(hrefs.filter((href) => href === "/admin/products")).toHaveLength(1);
      expect(hrefs).toContain("/admin/offers");
      cleanup();
    }
  });
});

// ── Pure logic ────────────────────────────────────────────────────────────────

const NOW = Timestamp.fromMillis(Date.UTC(2026, 8, 30, 12, 0, 0));
const DAY = 24 * 60 * 60 * 1000;

function product(id: string, name: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    name: { en: name, ar: null },
    images: [],
    price: 10000,
    isOnSale: false,
    salePrice: null,
    saleStartAt: null,
    saleEndAt: null,
    ...overrides,
  } as Product;
}

const at = (offsetDays: number) => Timestamp.fromMillis(NOW.toMillis() + offsetDays * DAY);

const CATALOG: Product[] = [
  product("expired", "Expired Ring", {
    isOnSale: true,
    salePrice: 8000,
    saleStartAt: at(-10),
    saleEndAt: at(-1),
  }),
  product("active", "Active Ring", { isOnSale: true, salePrice: 7500, saleEndAt: at(5) }),
  product("scheduled", "Scheduled Ring", {
    isOnSale: true,
    salePrice: 9000,
    saleStartAt: at(3),
    name: { en: "Scheduled Ring", ar: "خاتم مجدول" },
  }),
  product("plain", "Plain Band"),
  product("off", "Switched Off", { isOnSale: false, salePrice: 5000 }),
  product("noprice", "Flag Without Price", { isOnSale: true, salePrice: null }),
];

describe("buildOfferData / computeOfferStats", () => {
  const { offers, choices } = buildOfferData(CATALOG, NOW, "en");

  it("lists every product that stores a sale price with its derived status — Active, Scheduled, Expired, then Disabled", () => {
    expect(offers.map((o) => [o.productId, o.status])).toEqual([
      ["active", "ACTIVE"],
      ["scheduled", "SCHEDULED"],
      ["expired", "EXPIRED"],
      ["off", "DISABLED"], // switched off, stored details kept — it can be started again
    ]);
  });

  it("offers only products with no stored sale price to New Offer", () => {
    expect(choices.map((c) => c.id).sort()).toEqual(["noprice", "plain"]);
    expect(choices.find((c) => c.id === "plain")).toMatchObject({
      name: "Plain Band",
      price: 10000,
    });
  });

  it("carries the stored offer fields through unchanged", () => {
    const active = offers.find((o) => o.productId === "active")!;
    expect(active).toMatchObject({
      price: 10000,
      salePrice: 7500,
      startAt: null,
      endAt: at(5).toMillis(),
    });
  });

  it("counts total / active / scheduled / expired from the same derived statuses", () => {
    expect(computeOfferStats(offers)).toEqual({
      total: 4,
      active: 1,
      scheduled: 1,
      expired: 1,
      disabled: 1,
    });
    expect(computeOfferStats([])).toEqual({
      total: 0,
      active: 0,
      scheduled: 0,
      expired: 0,
      disabled: 0,
    });
  });

  it("uses the Arabic name in the Arabic admin, falling back to English", () => {
    const arabic = buildOfferData(CATALOG, NOW, "ar").offers;
    expect(arabic.find((o) => o.productId === "scheduled")!.name).toBe("خاتم مجدول");
    expect(arabic.find((o) => o.productId === "active")!.name).toBe("Active Ring");
  });
});

describe("filterOffers / helpers", () => {
  const { offers } = buildOfferData(CATALOG, NOW, "en");

  it("filters by status and by product name in either language", () => {
    expect(filterOffers(offers, { query: "", status: "ACTIVE" }).map((o) => o.productId)).toEqual([
      "active",
    ]);
    expect(filterOffers(offers, { query: "RING", status: "all" })).toHaveLength(3);
    expect(filterOffers(offers, { query: "zzz", status: "all" })).toEqual([]);
    const arabic = buildOfferData(CATALOG, NOW, "ar").offers;
    expect(filterOffers(arabic, { query: "مجدول", status: "all" }).map((o) => o.productId)).toEqual(
      ["scheduled"],
    );
  });

  it("parses only real statuses, computes the discount, and formats datetime-local values", () => {
    expect(parseOfferStatusFilter("EXPIRED")).toBe("EXPIRED");
    expect(parseOfferStatusFilter("DISABLED")).toBe("DISABLED");
    expect(parseOfferStatusFilter("NOPE")).toBe("all");
    expect(discountPercent(10000, 7500)).toBe(25);
    expect(discountPercent(10000, 10000)).toBeNull();
    expect(toDateTimeLocalValue(null)).toBe("");
    expect(toDateTimeLocalValue(new Date(2026, 9, 1, 9, 5).getTime())).toBe("2026-10-01T09:05");
  });
});

// ── The page component ────────────────────────────────────────────────────────

const DATA = buildOfferData(CATALOG, NOW, "en");

function renderManager(
  props: Partial<Parameters<typeof AdminOffersManager>[0]> = {},
  locale: "en" | "ar" = "en",
) {
  const messages = locale === "en" ? en : ar;
  return render(
    <NextIntlClientProvider locale={locale} messages={{ AdminOffers: messages.AdminOffers }}>
      <AdminOffersManager offers={DATA.offers} choices={DATA.choices} {...props} />
    </NextIntlClientProvider>,
  );
}

const dialog = () => screen.getByRole("dialog");

describe("AdminOffersManager", () => {
  it("shows the summary cards and one row per offer with its derived status", () => {
    renderManager();
    expect(screen.getByRole("heading", { level: 1, name: "Special Offers" })).toBeTruthy();
    for (const label of ["Total Offers", "Active", "Scheduled", "Expired", "Disabled"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    const rows = screen.getAllByTestId("admin-row");
    expect(rows).toHaveLength(8); // table + card list, 4 offers each
    expect(within(rows[0]!).getByText("Active Ring")).toBeTruthy();
    expect(within(rows[0]!).getByText("−25%")).toBeTruthy();
    expect(rows[0]!.querySelector('[data-status="ACTIVE"]')).toBeTruthy();
    expect(rows[1]!.querySelector('[data-status="SCHEDULED"]')).toBeTruthy();
    expect(rows[2]!.querySelector('[data-status="EXPIRED"]')).toBeTruthy();
    expect(screen.getAllByText("No end date").length).toBeGreaterThan(0);
  });

  it("filters by status and search, and shows an empty state with Clear filters", () => {
    renderManager();
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "SCHEDULED" },
    });
    expect(screen.getAllByTestId("admin-row")).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    const empty = screen.getByTestId("offers-empty");
    expect(within(empty).getByRole("heading", { name: "No offers found" })).toBeTruthy();
    fireEvent.click(within(empty).getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByTestId("admin-row")).toHaveLength(8);
  });

  it("shows a neutral empty state when there are no offers at all", () => {
    renderManager({ offers: [] });
    const empty = screen.getByTestId("offers-empty");
    expect(within(empty).getByText(/No products are on sale yet/)).toBeTruthy();
    expect(within(empty).queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("disables New Offer, with the reason, when every product already has an offer", () => {
    renderManager({ choices: [] });
    expect((screen.getByRole("button", { name: "New Offer" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText("Every product already has an offer.")).toBeTruthy();
  });

  it("creates an offer through the existing updateProductAction, on the chosen product's own fields", async () => {
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "New Offer" }));
    const d = dialog();
    expect(within(d).getByRole("heading", { name: "New Offer" })).toBeTruthy();
    expect(
      within(d)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Select a product", "Flag Without Price", "Plain Band"]);

    fireEvent.change(within(d).getByRole("combobox"), { target: { value: "plain" } });
    expect(within(d).getByText(/100\.00/)).toBeTruthy(); // regular price shown, read-only
    // The admin enters a discount; the sale price is calculated (read-only) and shown live.
    expect(within(d).getByTestId("offer-sale-price").textContent).toBe("—");
    fireEvent.change(within(d).getByLabelText("Discount (%)"), { target: { value: "25" } });
    expect(within(d).getByTestId("offer-sale-price").textContent).toBe(
      formatCurrency(7500, "en-US"),
    );
    fireEvent.change(within(d).getByLabelText(/Start date/), {
      target: { value: "2026-10-01T09:00" },
    });
    await act(async () => {
      fireEvent.click(within(d).getByRole("button", { name: "Create Offer" }));
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    const payload = updateMock.mock.calls[0]![0];
    expect(payload).toMatchObject({
      productId: "plain",
      isOnSale: true,
      salePrice: 7500,
      saleEndAt: null,
    });
    expect(payload.saleStartAt.toISOString()).toBe(new Date("2026-10-01T09:00").toISOString());
    expect(refreshMock).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("validates before saving: a product, a positive price, and a price below the regular price", async () => {
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "New Offer" }));
    const d = dialog();

    fireEvent.submit(d.querySelector("form")!);
    expect(await within(d).findByText("Select a product.")).toBeTruthy();

    fireEvent.change(within(d).getByRole("combobox"), { target: { value: "plain" } });
    fireEvent.submit(d.querySelector("form")!);
    expect(await within(d).findByText("Enter a discount percentage.")).toBeTruthy();

    for (const bad of ["0", "100", "-5", "150"]) {
      fireEvent.change(within(d).getByLabelText("Discount (%)"), { target: { value: bad } });
      fireEvent.submit(d.querySelector("form")!);
      expect(await within(d).findByText(/Enter a discount above 0% and below 100%/)).toBeTruthy();
      expect(within(d).getByTestId("offer-sale-price").textContent).toBe("—");
    }
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("edits an existing offer: prefilled from the product, saved to the same product", async () => {
    renderManager();
    fireEvent.click(screen.getAllByRole("button", { name: "Active Ring" })[0]!);
    const d = dialog();
    expect(within(d).getByRole("heading", { name: "Edit Offer" })).toBeTruthy();
    // Saved ₪75.00 on ₪100.00 → the percentage is derived, not stored.
    expect((within(d).getByLabelText("Discount (%)") as HTMLInputElement).value).toBe("25");
    expect(within(d).getByTestId("offer-sale-price").textContent).toBe(
      formatCurrency(7500, "en-US"),
    );
    expect(
      (within(d).getByRole("checkbox", { name: "Offer enabled" }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      within(d)
        .getByRole("link", { name: /Open product/ })
        .getAttribute("href"),
    ).toBe("/admin/products/active/edit");

    fireEvent.change(within(d).getByLabelText("Discount (%)"), { target: { value: "40" } });
    expect(within(d).getByTestId("offer-sale-price").textContent).toBe(
      formatCurrency(6000, "en-US"),
    );
    await act(async () => {
      fireEvent.click(within(d).getByRole("button", { name: "Save Changes" }));
    });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "active", isOnSale: true, salePrice: 6000 }),
    );
  });

  it("turns an offer off by unchecking Offer enabled (the stored offer details are kept)", async () => {
    renderManager();
    fireEvent.click(screen.getAllByRole("button", { name: "Active Ring" })[0]!);
    const d = dialog();
    fireEvent.click(within(d).getByRole("checkbox", { name: "Offer enabled" }));
    await act(async () => {
      fireEvent.click(within(d).getByRole("button", { name: "Save Changes" }));
    });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "active", isOnSale: false, salePrice: 7500 }),
    );
  });

  it("shows the server's message and stays open when the save is rejected", async () => {
    updateMock.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "This product no longer exists." },
    });
    renderManager();
    fireEvent.click(screen.getAllByRole("button", { name: "Active Ring" })[0]!);
    const d = dialog();
    await act(async () => {
      fireEvent.click(within(d).getByRole("button", { name: "Save Changes" }));
    });
    expect(within(d).getByText("This product no longer exists.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("reopens an offer whose percentage is not round with its exact saved price, and saves it unchanged", async () => {
    const luna = {
      ...DATA.offers[0]!,
      productId: "luna",
      name: "Luna Mesh Watch",
      nameEn: "Luna Mesh Watch",
      price: 24000,
      salePrice: 5000, // 79.1666…% — shown rounded as 79.17
    };
    renderManager({ offers: [luna] });
    fireEvent.click(screen.getAllByRole("button", { name: "Luna Mesh Watch" })[0]!);
    const d = dialog();
    expect((within(d).getByLabelText("Discount (%)") as HTMLInputElement).value).toBe("79.17");
    expect(within(d).getByTestId("offer-sale-price").textContent).toBe(
      formatCurrency(5000, "en-US"),
    );
    await act(async () => {
      fireEvent.click(within(d).getByRole("button", { name: "Save Changes" }));
    });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "luna", salePrice: 5000 }),
    );
  });

  it("calculates the documented examples live in the drawer: 240 @ 20%, 240 @ 50%, 185 @ 15%", () => {
    const choices = [
      { id: "a", name: "A", price: 24000 },
      { id: "b", name: "B", price: 18500 },
    ];
    renderManager({ choices });
    fireEvent.click(screen.getByRole("button", { name: "New Offer" }));
    const d = dialog();
    const output = () => within(d).getByTestId("offer-sale-price").textContent;
    fireEvent.change(within(d).getByRole("combobox"), { target: { value: "a" } });
    fireEvent.change(within(d).getByLabelText("Discount (%)"), { target: { value: "20" } });
    expect(output()).toBe(formatCurrency(19200, "en-US"));
    fireEvent.change(within(d).getByLabelText("Discount (%)"), { target: { value: "50" } });
    expect(output()).toBe(formatCurrency(12000, "en-US"));
    fireEvent.change(within(d).getByRole("combobox"), { target: { value: "b" } });
    fireEvent.change(within(d).getByLabelText("Discount (%)"), { target: { value: "15" } });
    expect(output()).toBe(formatCurrency(15725, "en-US"));
    // The sale price is read-only output — there is no field to type it into.
    expect(within(d).queryByRole("spinbutton", { name: /Sale price/ })).toBeNull();
    expect(within(d).getByTestId("offer-sale-price").tagName).toBe("OUTPUT");
  });

  it("renders Arabic without raw translation keys, and English/Arabic keys match", () => {
    const { container } = renderManager({}, "ar");
    expect(screen.getByRole("heading", { level: 1, name: "العروض الخاصة" })).toBeTruthy();
    expect(within(screen.getAllByTestId("admin-row")[0]!).getByText("نشط")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "عرض جديد" }));
    expect(dialog().textContent).not.toMatch(/AdminOffers|drawer\.|errors\./);
    expect(container.textContent).not.toMatch(/AdminOffers|columns\.|status\.|filters\.|empty\./);

    const keys = (o: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" && v !== null
          ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`],
      );
    expect(keys(ar.AdminOffers).sort()).toEqual(keys(en.AdminOffers).sort());
  });
});

describe("Status pill — stop / start an offer", () => {
  const HOUR = 60 * 60 * 1000;
  const toggles = () => screen.getAllByTestId("offer-status-toggle");
  const confirmDialog = () => screen.getByRole("alertdialog");

  /** The value shown on a summary card, found by its label. */
  function cardValue(label: string): string | undefined {
    for (const p of Array.from(document.querySelectorAll("p"))) {
      const value = p.nextElementSibling;
      if (p.textContent === label && value?.getAttribute("dir") === "ltr")
        return value.textContent ?? undefined;
    }
    return undefined;
  }

  function offerRow(overrides: Partial<OfferRow> = {}): OfferRow {
    return {
      productId: "custom",
      name: "Custom Ring",
      nameEn: "Custom Ring",
      nameAr: null,
      imageUrl: null,
      price: 10000,
      salePrice: 7500,
      status: "DISABLED",
      startAt: null,
      endAt: null,
      isOnSale: false,
      ...overrides,
    };
  }

  it("ACTIVE and DISABLED pills are real buttons with a spoken hint; Scheduled and Expired are not", () => {
    const { container } = renderManager();
    const [active, disabled] = toggles();
    expect(active!.tagName).toBe("BUTTON");
    expect(active!.getAttribute("aria-label")).toBe("Active — click to stop this offer");
    expect(disabled!.getAttribute("aria-label")).toBe("Disabled — click to start this offer");
    expect(toggles()).toHaveLength(4); // 2 toggleable offers × (table + cards)
    for (const status of ["SCHEDULED", "EXPIRED"]) {
      for (const pill of Array.from(container.querySelectorAll(`[data-status="${status}"]`))) {
        expect(pill.tagName, status).toBe("SPAN");
      }
    }
    active!.focus(); // keyboard reachable
    expect(document.activeElement).toBe(active);
  });

  it("the separate Remove Offer button is gone from the Edit Offer drawer; Offer enabled stays", () => {
    renderManager();
    fireEvent.click(screen.getAllByRole("button", { name: "Active Ring" })[0]!);
    const d = dialog();
    expect(within(d).queryByRole("button", { name: /Remove Offer/ })).toBeNull();
    expect(within(d).getByRole("checkbox", { name: "Offer enabled" })).toBeTruthy();
    for (const messages of [en, ar]) {
      for (const key of ["removeOffer", "removeTitle", "removeBody", "removing"]) {
        expect(messages.AdminOffers.drawer).not.toHaveProperty(key);
      }
    }
  });

  it("clicking ACTIVE asks to confirm first, with the required wording, and changes nothing yet", () => {
    renderManager();
    fireEvent.click(toggles()[0]!);
    const c = confirmDialog();
    expect(within(c).getByRole("heading", { name: "Stop this offer?" })).toBeTruthy();
    expect(
      within(c).getByText("Customers will immediately see the regular product price."),
    ).toBeTruthy();
    expect(within(c).getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(within(c).getByRole("button", { name: "Stop Offer" })).toBeTruthy();
    expect(document.activeElement).toBe(within(c).getByRole("button", { name: "Cancel" }));
    expect(updateMock).not.toHaveBeenCalled();
    expect(cardValue("Active")).toBe("1");
  });

  it("Cancel does nothing", () => {
    renderManager();
    fireEvent.click(toggles()[0]!);
    fireEvent.click(within(confirmDialog()).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(toggles()[0]!.getAttribute("data-status")).toBe("ACTIVE");
    expect(cardValue("Active")).toBe("1");
  });

  it("confirming stops the offer through updateProductAction with ONLY isOnSale: false — the product is not deleted", async () => {
    renderManager();
    fireEvent.click(toggles()[0]!);
    await act(async () => {
      fireEvent.click(within(confirmDialog()).getByRole("button", { name: "Stop Offer" }));
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    // Nothing else is sent, so the stored sale price and dates are kept by the model.
    expect(updateMock).toHaveBeenCalledWith({ productId: "active", isOnSale: false });
    expect(deleteMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("the row's status becomes DISABLED and the cards and filter follow, immediately", async () => {
    renderManager();
    expect([cardValue("Total Offers"), cardValue("Active"), cardValue("Disabled")]).toEqual([
      "4",
      "1",
      "1",
    ]);
    fireEvent.click(toggles()[0]!);
    await act(async () => {
      fireEvent.click(within(confirmDialog()).getByRole("button", { name: "Stop Offer" }));
    });

    const row = screen.getAllByTestId("admin-row")[0]!;
    expect(within(row).getByText("Active Ring")).toBeTruthy(); // still listed — only its status changed
    expect(row.querySelector('[data-status="DISABLED"]')).toBeTruthy();
    expect([cardValue("Total Offers"), cardValue("Active"), cardValue("Disabled")]).toEqual([
      "4",
      "0",
      "2",
    ]);

    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "DISABLED" },
    });
    expect(screen.getAllByTestId("admin-row")).toHaveLength(4); // Active Ring + Switched Off, × 2 layouts
  });

  it("shows a spinner and ignores a second click while saving (no double submit)", async () => {
    let finish!: (value: unknown) => void;
    updateMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderManager();
    fireEvent.click(toggles()[0]!);
    await act(async () => {
      fireEvent.click(within(confirmDialog()).getByRole("button", { name: "Stop Offer" }));
    });

    const pill = screen.getAllByTestId("offer-status-toggle")[0]!;
    expect(pill.getAttribute("aria-busy")).toBe("true");
    expect(pill.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(pill);
    fireEvent.click(pill);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(updateMock).toHaveBeenCalledTimes(1);

    await act(async () => finish({ ok: true, data: null }));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("rolls the pill, counts and filter back and explains when the save fails", async () => {
    updateMock.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "raw server text" },
    });
    renderManager();
    fireEvent.click(toggles()[0]!);
    await act(async () => {
      fireEvent.click(within(confirmDialog()).getByRole("button", { name: "Stop Offer" }));
    });

    expect(toggles()[0]!.getAttribute("data-status")).toBe("ACTIVE");
    expect([cardValue("Active"), cardValue("Disabled")]).toEqual(["1", "1"]);
    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn't update the offer. Please try again.",
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("rolls back when the request throws", async () => {
    updateMock.mockRejectedValue(new Error("network"));
    renderManager();
    fireEvent.click(toggles()[0]!);
    await act(async () => {
      fireEvent.click(within(confirmDialog()).getByRole("button", { name: "Stop Offer" }));
    });
    expect(toggles()[0]!.getAttribute("data-status")).toBe("ACTIVE");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("starts a DISABLED offer whose period is still valid, repeating its stored sale price (dates untouched)", async () => {
    renderManager();
    fireEvent.click(toggles()[1]!); // Switched Off: ₪50.00 on ₪100.00, no dates
    const c = confirmDialog();
    expect(within(c).getByRole("heading", { name: "Start this offer?" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(c).getByRole("button", { name: "Start Offer" }));
    });
    expect(updateMock).toHaveBeenCalledWith({ productId: "off", isOnSale: true, salePrice: 5000 });
    expect(updateMock.mock.calls[0]![0]).not.toHaveProperty("saleStartAt");
    expect(updateMock.mock.calls[0]![0]).not.toHaveProperty("saleEndAt");
    expect([cardValue("Active"), cardValue("Disabled")]).toEqual(["2", "0"]);
  });

  it("starting an offer whose start date is still ahead makes it SCHEDULED, never ACTIVE", async () => {
    const future = offerRow({ startAt: Date.now() + 5 * HOUR, endAt: Date.now() + 9 * HOUR });
    renderManager({ offers: [future] });
    fireEvent.click(toggles()[0]!);
    await act(async () => {
      fireEvent.click(within(confirmDialog()).getByRole("button", { name: "Start Offer" }));
    });
    expect(
      screen.getAllByTestId("admin-row")[0]!.querySelector('[data-status="SCHEDULED"]'),
    ).toBeTruthy();
    expect(cardValue("Scheduled")).toBe("1");
    expect(cardValue("Active")).toBe("0");
  });

  it("does NOT start a DISABLED offer whose period has ended — it explains and points to Edit Offer", () => {
    renderManager({ offers: [offerRow({ endAt: Date.now() - HOUR })] });
    fireEvent.click(toggles()[0]!);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe(
      "This offer's period has ended, so it can't be started. Use Edit Offer to set new dates.",
    );
    expect(updateMock).not.toHaveBeenCalled();
    expect(toggles()[0]!.getAttribute("data-status")).toBe("DISABLED");
  });

  it("does NOT start a DISABLED offer whose stored sale price is no longer below the regular price", () => {
    renderManager({ offers: [offerRow({ salePrice: 10000 })] });
    fireEvent.click(toggles()[0]!);
    expect(screen.getByRole("alert").textContent).toContain("not below the regular price");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("Scheduled and Expired pills cannot be toggled", () => {
    const { container } = renderManager();
    for (const status of ["SCHEDULED", "EXPIRED"]) {
      for (const pill of Array.from(container.querySelectorAll(`[data-status="${status}"]`))) {
        fireEvent.click(pill);
      }
    }
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("is fully translated in Arabic", async () => {
    renderManager({}, "ar");
    const [active, disabled] = toggles();
    expect(active!.getAttribute("aria-label")).toBe("نشط — انقر لإيقاف هذا العرض");
    expect(disabled!.getAttribute("aria-label")).toBe("معطّل — انقر لتفعيل هذا العرض");

    fireEvent.click(active!);
    let c = confirmDialog();
    expect(within(c).getByRole("heading", { name: "إيقاف هذا العرض؟" })).toBeTruthy();
    expect(within(c).getByText("سيرى العملاء فورًا السعر الأصلي للمنتج.")).toBeTruthy();
    expect(within(c).getByRole("button", { name: "إلغاء" })).toBeTruthy();
    expect(within(c).getByRole("button", { name: "إيقاف العرض" })).toBeTruthy();
    fireEvent.click(within(c).getByRole("button", { name: "إلغاء" }));

    fireEvent.click(toggles()[1]!);
    c = confirmDialog();
    expect(within(c).getByRole("heading", { name: "تفعيل هذا العرض؟" })).toBeTruthy();
    expect(c.textContent).not.toMatch(/AdminOffers|toggle\./);
  });
});
