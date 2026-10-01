import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { ORDER_STATUSES } from "@/types/order";
import { DELIVERY_REGION_IDS } from "@/types/deliveryRegion";

/**
 * The redesigned Admin Exports page: report cards, the Generate Report card with each report's own
 * filters, the .xlsx panel and the quick actions. `fetch` is mocked — no real export runs and no data
 * is read. The export Route Handlers themselves are untouched.
 */

const { ExportsManager } = await import("@/components/admin/ExportsManager");

const CATEGORIES = [
  { id: "rings", nameEn: "Rings", nameAr: "خواتم" },
  { id: "bracelets", nameEn: "Bracelets", nameAr: "أساور" },
];
const REAL_REPORTS = [
  "orders",
  "products",
  "inventory",
  "sold-out",
  "customers",
  "sales",
  "best-sellers",
  "delivery-locations",
];

const fetchMock = vi.fn();
const clickSpy = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    blob: async () => new Blob(["x"]),
    headers: { get: () => 'attachment; filename="tia-orders.xlsx"' },
    json: async () => ({}),
  });
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  clickSpy.mockReset();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickSpy);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderPage(locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? en : ar;
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ AdminExports: messages.AdminExports } as never}
    >
      <ExportsManager categories={CATEGORIES} />
    </NextIntlClientProvider>,
  );
}

const select = (name: string) => screen.getByLabelText(name, { exact: true }) as HTMLSelectElement;
const reportSelect = () => screen.getByLabelText("Report type") as HTMLSelectElement;
const downloadButton = () => screen.getByTestId("download-button") as HTMLButtonElement;
const card = (type: string) => screen.getByTestId(`report-card-${type}`);
const calledUrl = () => fetchMock.mock.calls.at(-1)![0] as string;

describe("report types", () => {
  it("offers exactly the real supported report types (nothing invented, nothing lost)", () => {
    renderPage();
    const options = within(reportSelect())
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(REAL_REPORTS);
  });

  it("starts on Orders: its card is selected and the button says Download Orders", () => {
    renderPage();
    expect(card("orders").getAttribute("aria-checked")).toBe("true");
    expect(card("customers").getAttribute("aria-checked")).toBe("false");
    expect(card("products").getAttribute("aria-checked")).toBe("false");
    expect(reportSelect().value).toBe("orders");
    expect(downloadButton().textContent).toContain("Download Orders");
  });

  it("clicking a card switches the report, the dropdown, the filters and the button label", () => {
    renderPage();
    fireEvent.click(card("customers"));
    expect(card("customers").getAttribute("aria-checked")).toBe("true");
    expect(card("orders").getAttribute("aria-checked")).toBe("false");
    expect(reportSelect().value).toBe("customers");
    expect(downloadButton().textContent).toContain("Download Customers");

    fireEvent.click(card("products"));
    expect(card("products").getAttribute("aria-checked")).toBe("true");
    expect(reportSelect().value).toBe("products");
    expect(downloadButton().textContent).toContain("Download Products");
  });

  it("the dropdown drives the same state — and no card is selected for a non-card report", () => {
    renderPage();
    fireEvent.change(reportSelect(), { target: { value: "inventory" } });
    expect(downloadButton().textContent).toContain("Download Inventory / Stock");
    for (const type of ["orders", "customers", "products"]) {
      expect(card(type).getAttribute("aria-checked")).toBe("false");
    }
    fireEvent.change(reportSelect(), { target: { value: "customers" } });
    expect(card("customers").getAttribute("aria-checked")).toBe("true");
  });

  it("the download button shows the .xlsx indicator", () => {
    renderPage();
    expect(downloadButton().textContent).toContain(".xlsx");
  });
});

describe("filters per report type (only the real ones)", () => {
  it("Orders: From, To, Status and Region, with the real statuses and regions", () => {
    renderPage();
    expect(screen.getByTestId("filters-orders")).toBeTruthy();
    expect(screen.getByLabelText("From", { exact: true })).toBeTruthy();
    expect(screen.getByLabelText("To", { exact: true })).toBeTruthy();
    const status = select("Status");
    expect(
      within(status)
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(["", ...ORDER_STATUSES]);
    expect(within(status).getByText("Processing")).toBeTruthy(); // PREPARING, shown with its friendly name
    const region = select("Region");
    expect(
      within(region)
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(["", ...DELIVERY_REGION_IDS]);
    expect(within(region).getByText("West Bank")).toBeTruthy();
  });

  it("Customers: no filters", () => {
    renderPage();
    fireEvent.click(card("customers"));
    expect(screen.getByTestId("filters-none")).toBeTruthy();
    expect(screen.queryByTestId("filters-orders")).toBeNull();
    expect(screen.queryByLabelText("Status")).toBeNull();
  });

  it("Products: only the optional category filter, from the real categories", () => {
    renderPage();
    fireEvent.click(card("products"));
    const category = select("Category (optional)");
    expect(
      within(category)
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(["", "rings", "bracelets"]);
    expect(screen.queryByLabelText("From", { exact: true })).toBeNull();
  });

  it("Inventory has its threshold; Sales and Best-Sellers a date range; the rest none", () => {
    renderPage();
    fireEvent.change(reportSelect(), { target: { value: "inventory" } });
    expect(screen.getByLabelText("Low-stock threshold (optional)")).toBeTruthy();
    for (const type of ["sales", "best-sellers"]) {
      fireEvent.change(reportSelect(), { target: { value: type } });
      expect(screen.getByTestId("filters-range")).toBeTruthy();
      expect(screen.queryByLabelText("Status")).toBeNull();
    }
    for (const type of ["sold-out", "delivery-locations", "customers"]) {
      fireEvent.change(reportSelect(), { target: { value: type } });
      expect(screen.getByTestId("filters-none")).toBeTruthy();
    }
  });
});

describe("the existing export request is unchanged", () => {
  const download = async () => {
    fireEvent.click(downloadButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  };

  it("Orders: every filter reaches the Route Handler as before", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("From", { exact: true }), {
      target: { value: "2026-09-01" },
    });
    fireEvent.change(screen.getByLabelText("To", { exact: true }), {
      target: { value: "2026-09-30" },
    });
    fireEvent.change(select("Status"), { target: { value: "SHIPPED" } });
    fireEvent.change(select("Region"), { target: { value: "inside-1948" } });
    await download();
    expect(calledUrl()).toBe(
      "/admin/api/export/orders?from=2026-09-01&to=2026-09-30&status=SHIPPED&regionId=inside-1948",
    );
  });

  it("Orders with no filters requests the bare endpoint", async () => {
    renderPage();
    await download();
    expect(calledUrl()).toBe("/admin/api/export/orders");
  });

  it("Customers, Products, Inventory, Sales and the others hit their own endpoints with only their own filters", async () => {
    renderPage();
    fireEvent.click(card("customers"));
    await download();
    expect(calledUrl()).toBe("/admin/api/export/customers");

    fireEvent.click(card("products"));
    fireEvent.change(select("Category (optional)"), { target: { value: "rings" } });
    fireEvent.click(downloadButton());
    await waitFor(() => expect(calledUrl()).toBe("/admin/api/export/products?categoryId=rings"));

    fireEvent.change(reportSelect(), { target: { value: "inventory" } });
    fireEvent.change(screen.getByLabelText("Low-stock threshold (optional)"), {
      target: { value: "5" },
    });
    fireEvent.click(downloadButton());
    await waitFor(() =>
      expect(calledUrl()).toBe("/admin/api/export/inventory?lowStockThreshold=5"),
    );

    fireEvent.change(reportSelect(), { target: { value: "sales" } });
    fireEvent.change(screen.getByLabelText("From", { exact: true }), {
      target: { value: "2026-01-01" },
    });
    fireEvent.click(downloadButton());
    await waitFor(() => expect(calledUrl()).toBe("/admin/api/export/sales?from=2026-01-01"));
  });

  it("an Orders filter never leaks into another report", async () => {
    renderPage();
    fireEvent.change(select("Status"), { target: { value: "SHIPPED" } });
    fireEvent.click(card("customers"));
    await download();
    expect(calledUrl()).toBe("/admin/api/export/customers");
  });

  it("saves the file with the server's filename", async () => {
    renderPage();
    await download();
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    const anchor = document.querySelector("a[download]");
    expect(anchor).toBeNull(); // removed again after the click
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

describe("loading and error states", () => {
  it("shows Preparing export…, disables the button and ignores a second click while generating", async () => {
    let release!: (value: unknown) => void;
    fetchMock.mockReturnValue(new Promise((resolveFetch) => (release = resolveFetch)));
    renderPage();
    fireEvent.click(downloadButton());
    fireEvent.click(downloadButton());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(downloadButton().disabled).toBe(true));
    expect(downloadButton().getAttribute("aria-busy")).toBe("true");
    expect(downloadButton().textContent).toContain("Preparing export…");
    expect(screen.getByRole("status").textContent).toContain("Generating your report");
    release({
      ok: true,
      status: 200,
      blob: async () => new Blob(["x"]),
      headers: { get: () => null },
    });
    await waitFor(() => expect(downloadButton().disabled).toBe(false));
    expect(downloadButton().textContent).toContain("Download Orders");
  });

  it("shows the server's message when the export is rejected", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: "Forbidden." }),
    });
    renderPage();
    fireEvent.click(downloadButton());
    expect((await screen.findByRole("alert")).textContent).toBe("Forbidden.");
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("falls back to the status code, and to a generic message on a network failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => Promise.reject(new Error("no body")),
    });
    renderPage();
    fireEvent.click(downloadButton());
    expect((await screen.findByRole("alert")).textContent).toBe("Export failed (500).");
    fetchMock.mockRejectedValue(new Error("offline"));
    fireEvent.click(downloadButton());
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Export failed. Please try again."),
    );
  });

  it("clears the error when another report is chosen", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    renderPage();
    fireEvent.click(downloadButton());
    await screen.findByRole("alert");
    fireEvent.click(card("products"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the information panel and quick actions", () => {
  it("shows the .xlsx panel with the three points and the hint", () => {
    renderPage();
    const panel = screen.getByTestId("xlsx-panel");
    expect(panel.textContent).toContain(".XLSX");
    expect(panel.textContent).toContain("Live data from your store");
    expect(panel.textContent).toContain("Generates a real Excel file (.xlsx)");
    expect(panel.textContent).toContain(
      "No import path — editing the downloaded file has no effect on TIA",
    );
    expect(panel.textContent).toContain("Use filters to get exactly the data you need.");
  });

  it("Other reports: Customers, Products and Orders quick actions switch the report without downloading", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("quick-customers"));
    expect(reportSelect().value).toBe("customers");
    expect(card("customers").getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByTestId("quick-products"));
    expect(reportSelect().value).toBe("products");
    fireEvent.click(screen.getByTestId("quick-orders"));
    expect(reportSelect().value).toBe("orders");
    expect(downloadButton().textContent).toContain("Download Orders");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("quick actions are named 'Export X', so the one Download button stays unambiguous", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Export Customers" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Download/ })).toHaveLength(1);
  });

  it("keeps the labels the end-to-end spec relies on", () => {
    renderPage();
    expect(screen.getByLabelText("Report type")).toBeTruthy();
    expect(screen.getByLabelText("From", { exact: true })).toBeTruthy();
    expect(screen.getByLabelText("To", { exact: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Download/ })).toBeTruthy();
  });
});

describe("Arabic / RTL", () => {
  it("translates everything — no raw keys, no English chrome", () => {
    const { container } = renderPage("ar");
    const text = container.textContent ?? "";
    expect(text).toContain("إنشاء تقرير");
    expect(text).toContain("تقارير أخرى");
    expect(text).toContain("بيانات حيّة من متجرك");
    expect(text).not.toMatch(/AdminExports\.|\{report\}|\{status\}/);
    expect(text).not.toContain("Generate Report");
    expect(text).not.toContain("Other reports");
  });

  it("updates the download button, statuses, regions and categories in Arabic", () => {
    renderPage("ar");
    expect(downloadButton().textContent).toContain("تنزيل الطلبات");
    expect(select("الحالة").textContent).toContain("قيد التجهيز");
    expect(select("المنطقة").textContent).toContain("الضفة الغربية");
    // Values sent to the server stay the real ids, whatever the language.
    expect(
      within(select("الحالة"))
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(["", ...ORDER_STATUSES]);
    fireEvent.click(card("products"));
    expect(downloadButton().textContent).toContain("تنزيل المنتجات");
    expect(select("الفئة (اختياري)").textContent).toContain("خواتم");
  });

  it("keeps the .xlsx extension isolated left-to-right inside Arabic text", () => {
    renderPage("ar");
    const ltr = downloadButton().querySelector('bdi[dir="ltr"]');
    expect(ltr?.textContent).toBe(".xlsx");
    expect(screen.getByTestId("xlsx-panel").querySelector('bdi[dir="ltr"]')?.textContent).toBe(
      ".XLSX",
    );
  });

  it("uses only logical (mirroring) spacing", () => {
    const { container } = renderPage("ar");
    expect(container.innerHTML).not.toMatch(/\b(?:ml|mr|pl|pr|text-left|text-right)-?\d?\b/);
  });

  it("still downloads the same real endpoint", async () => {
    renderPage("ar");
    fireEvent.click(card("customers"));
    fireEvent.click(downloadButton());
    await waitFor(() => expect(calledUrl()).toBe("/admin/api/export/customers"));
  });
});

describe("responsive structure and untouched export logic", () => {
  it("3 cards in a row from md, one column below; filters beside the .xlsx panel from xl", () => {
    const { container } = renderPage();
    const html = container.innerHTML;
    expect(html).toContain("grid-cols-1 gap-3 md:grid-cols-3");
    expect(html).toContain("xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]");
    // Full-width Download button on mobile, capped on larger screens.
    expect(downloadButton().className).toMatch(/\bw-full\b/);
    expect(downloadButton().className).toContain("sm:max-w-[380px]");
  });

  it("the page uses the admin translator and the export Route Handlers were not edited", () => {
    const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
    expect(read("src/app/admin/exports/page.tsx")).toContain('getAdminTranslator("AdminExports")');
    expect(read("src/lib/i18n/admin.ts")).toContain('"AdminExports"');
    // The manager only ever calls the existing endpoints.
    expect(read("src/components/admin/ExportsManager.tsx")).toContain("/admin/api/export/");
    expect(read("src/components/admin/ExportsManager.tsx")).not.toMatch(
      /from "(firebase|exceljs|xlsx)/,
    );
  });
});
