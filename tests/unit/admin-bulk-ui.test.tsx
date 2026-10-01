import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

/**
 * The page-level bulk button (Delete All products / Remove All offers): the confirmation dialog, the
 * exact record count, cancel, loading state, double-click protection, success and every failure mode,
 * in English and Arabic. The server actions are mocked — nothing touches Firebase.
 */

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock, push: vi.fn() }) }));
const deleteAllMock = vi.fn();
const removeOffersMock = vi.fn();
vi.mock("@/actions/admin/bulk.actions", () => ({
  deleteAllProductsAction: (input: unknown) => deleteAllMock(input),
  removeAllOffersAction: (input: unknown) => removeOffersMock(input),
}));

const { BulkActionButton } = await import("@/components/admin/BulkActionButton");

// jsdom has no <dialog>.showModal(): open the element so its content is reachable.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  deleteAllMock.mockReset();
  removeOffersMock.mockReset();
  refreshMock.mockReset();
  deleteAllMock.mockResolvedValue({ ok: true, data: { count: 22 } });
  removeOffersMock.mockResolvedValue({ ok: true, data: { count: 4 } });
});
afterEach(cleanup);

function renderButton(kind: "products" | "offers", count: number, locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? en : ar;
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={
        { AdminProducts: messages.AdminProducts, AdminOffers: messages.AdminOffers } as never
      }
    >
      <BulkActionButton kind={kind} count={count} />
    </NextIntlClientProvider>,
  );
}

const open = () => fireEvent.click(screen.getByTestId("bulk-action-button"));
const dialog = () => screen.getByRole("alertdialog", { hidden: true });
const confirmButton = () =>
  within(dialog())
    .getAllByRole("button", { hidden: true })
    .find((b) => b.textContent?.trim() !== "Cancel" && b.textContent?.trim() !== "إلغاء")!;

describe("Delete All products", () => {
  it("shows a Delete All button and no dialog until it is clicked", () => {
    renderButton("products", 22);
    expect(screen.getByTestId("bulk-action-button").textContent).toBe("Delete All");
    expect(screen.queryByRole("alertdialog", { hidden: true })).toBeNull();
    expect(deleteAllMock).not.toHaveBeenCalled();
  });

  it("the dialog states the exact count, what is kept, and that it cannot be undone", () => {
    renderButton("products", 22);
    open();
    const text = dialog().textContent ?? "";
    expect(text).toContain("Delete all products?");
    expect(text).toContain("22 products");
    expect(text).toContain("cannot be undone");
    expect(text).toContain("Past orders, customers, categories and showcases are not affected");
  });

  it("singular count reads naturally", () => {
    renderButton("products", 1);
    open();
    expect(dialog().textContent).toContain("1 product.");
  });

  it("Cancel closes the dialog and runs nothing", () => {
    renderButton("products", 22);
    open();
    fireEvent.click(within(dialog()).getByText("Cancel", { exact: false }));
    expect(screen.queryByRole("alertdialog", { hidden: true })).toBeNull();
    expect(deleteAllMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("confirming sends the confirmed count, refreshes the page data and shows a success notice", async () => {
    renderButton("products", 22);
    open();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(deleteAllMock).toHaveBeenCalledWith({ expectedCount: 22 }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", { hidden: true })).toBeNull());
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("bulk-notice").textContent).toBe("22 products deleted.");
  });

  it("while running: both buttons are disabled and a second click never reaches the server", async () => {
    let release!: (value: unknown) => void;
    deleteAllMock.mockReturnValue(new Promise((resolveAction) => (release = resolveAction)));
    renderButton("products", 22);
    open();
    const confirm = confirmButton();
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(deleteAllMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect((confirmButton() as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByTestId("bulk-action-button") as HTMLButtonElement).disabled).toBe(true);
    release({ ok: true, data: { count: 22 } });
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(deleteAllMock).toHaveBeenCalledTimes(1);
  });

  it("a permission failure keeps the dialog open with the reason and does not refresh", async () => {
    deleteAllMock.mockResolvedValue({ ok: false, error: { code: "FORBIDDEN", message: "x" } });
    renderButton("products", 22);
    open();
    fireEvent.click(confirmButton());
    expect(await screen.findByText(en.AdminProducts.bulk.errors.forbidden)).toBeTruthy();
    expect(screen.getByRole("alertdialog", { hidden: true })).toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("bulk-notice")).toBeNull();
  });

  it("a stale count asks the admin to review, and refreshes so the real list shows", async () => {
    deleteAllMock.mockResolvedValue({ ok: false, error: { code: "STALE_COUNT", message: "x" } });
    renderButton("products", 22);
    open();
    fireEvent.click(confirmButton());
    expect(await screen.findByText(en.AdminProducts.bulk.errors.staleCount)).toBeTruthy();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("a partial failure says how many were deleted and how many remain, and refreshes", async () => {
    deleteAllMock.mockResolvedValue({
      ok: false,
      error: {
        code: "PARTIAL_FAILURE",
        message: "x",
        fieldErrors: { done: ["400"], remaining: ["550"] },
      },
    });
    renderButton("products", 950);
    open();
    fireEvent.click(confirmButton());
    expect(
      await screen.findByText(
        "Only some products were deleted: 400 deleted, 550 remain. You can run Delete All again.",
      ),
    ).toBeTruthy();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("a thrown/network failure is reported generically and the button works again", async () => {
    deleteAllMock.mockRejectedValueOnce(new Error("offline"));
    renderButton("products", 22);
    open();
    fireEvent.click(confirmButton());
    expect(await screen.findByText(en.AdminProducts.bulk.errors.generic)).toBeTruthy();
    await waitFor(() => expect((confirmButton() as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(confirmButton());
    await waitFor(() => expect(deleteAllMock).toHaveBeenCalledTimes(2));
  });

  it("is disabled when there is nothing to delete", () => {
    renderButton("products", 0);
    expect((screen.getByTestId("bulk-action-button") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Delete All products — Storage image cleanup is reported honestly", () => {
  it("a clean run says the products were deleted, with no warning", async () => {
    deleteAllMock.mockResolvedValue({
      ok: true,
      data: { count: 22, imagesDeleted: 40, imagesFailed: 0 },
    });
    renderButton("products", 22);
    open();
    fireEvent.click(confirmButton());
    const notice = await screen.findByTestId("bulk-notice");
    expect(notice.textContent).toBe("22 products deleted.");
    expect(notice.getAttribute("data-warn")).toBe("false");
  });

  it("never claims plain success when some image files could not be removed — it says how many remain", async () => {
    deleteAllMock.mockResolvedValue({
      ok: true,
      data: { count: 22, imagesDeleted: 38, imagesFailed: 2 },
    });
    renderButton("products", 22);
    open();
    fireEvent.click(confirmButton());
    const notice = await screen.findByTestId("bulk-notice");
    expect(notice.textContent).toBe(
      "22 products deleted, but 2 image files couldn't be removed from Storage and still remain there.",
    );
    expect(notice.textContent).not.toBe("22 products deleted.");
    expect(notice.getAttribute("data-warn")).toBe("true");
    expect(refreshMock).toHaveBeenCalledTimes(1); // the products are gone, so the page still refreshes
  });

  it("uses the singular for one leftover file", async () => {
    deleteAllMock.mockResolvedValue({
      ok: true,
      data: { count: 1, imagesDeleted: 0, imagesFailed: 1 },
    });
    renderButton("products", 1);
    open();
    fireEvent.click(confirmButton());
    expect((await screen.findByTestId("bulk-notice")).textContent).toBe(
      "1 product deleted, but 1 image file couldn't be removed from Storage and still remain there.",
    );
  });

  it("a partial run adds the leftover-image count to the message", async () => {
    deleteAllMock.mockResolvedValue({
      ok: false,
      error: {
        code: "PARTIAL_FAILURE",
        message: "x",
        fieldErrors: { done: ["400"], remaining: ["50"], imagesFailed: ["3"] },
      },
    });
    renderButton("products", 450);
    open();
    fireEvent.click(confirmButton());
    const text = (await screen.findByRole("alertdialog", { hidden: true })).textContent ?? "";
    expect(text).toContain("Only some products were deleted: 400 deleted, 50 remain.");
    expect(text).toContain("3 image files couldn't be removed from Storage.");
  });

  it("is translated in Arabic with the right plurals", async () => {
    deleteAllMock.mockResolvedValue({
      ok: true,
      data: { count: 22, imagesDeleted: 0, imagesFailed: 2 },
    });
    renderButton("products", 22, "ar");
    open();
    fireEvent.click(confirmButton());
    const text = (await screen.findByTestId("bulk-notice")).textContent ?? "";
    expect(text).toContain("22 منتجًا");
    expect(text).toContain("ملفا صورة");
    expect(text).not.toMatch(/AdminProducts\.|\{failed\}|\{count/);
  });

  it("the single-delete notice exists in both languages", () => {
    expect(en.AdminProducts.imagesFailedNotice).toContain("couldn't be removed from Storage");
    expect(ar.AdminProducts.imagesFailedNotice).toContain("تعذّرت إزالة");
    const table = readFileSync(
      resolve(__dirname, "../../src/components/admin/AdminProductsTable.tsx"),
      "utf8",
    );
    expect(table).toContain("imagesFailedNotice");
    expect(table).toContain("result.data.imagesFailed > 0");
  });
});

describe("Remove All offers", () => {
  it("is labelled Remove All and the dialog says the products are kept", () => {
    renderButton("offers", 4);
    expect(screen.getByTestId("bulk-action-button").textContent).toBe("Remove All");
    open();
    const text = dialog().textContent ?? "";
    expect(text).toContain("4 offers");
    expect(text).toContain("The products themselves are kept");
    expect(text).toContain("cannot be undone");
  });

  it("runs the offers action (never the products one) with the confirmed count", async () => {
    renderButton("offers", 4);
    open();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(removeOffersMock).toHaveBeenCalledWith({ expectedCount: 4 }));
    expect(deleteAllMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId("bulk-notice").textContent).toBe("4 offers removed."),
    );
    expect(refreshMock).toHaveBeenCalled();
  });
});

describe("Arabic", () => {
  it("labels the button حذف الكل and states the count with correct plurals", () => {
    renderButton("products", 22, "ar");
    expect(screen.getByTestId("bulk-action-button").textContent).toBe("حذف الكل");
    open();
    const text = dialog().textContent ?? "";
    expect(text).toContain("حذف جميع المنتجات؟");
    expect(text).toContain("22 منتجًا");
    expect(text).toContain("لا يمكن التراجع عن هذا الإجراء");
    expect(text).not.toMatch(/AdminProducts\.|\{count/);
  });

  it("uses the Arabic plural forms for one and two", () => {
    renderButton("products", 2, "ar");
    open();
    expect(dialog().textContent).toContain("منتجين");
    cleanup();
    renderButton("offers", 1, "ar");
    open();
    expect(dialog().textContent).toContain("عرض واحد");
  });

  it("Remove All is إزالة الكل and the success/partial messages are Arabic", async () => {
    renderButton("offers", 4, "ar");
    expect(screen.getByTestId("bulk-action-button").textContent).toBe("إزالة الكل");
    open();
    fireEvent.click(confirmButton());
    await waitFor(() =>
      expect(screen.getByTestId("bulk-notice").textContent).toBe("تمت إزالة 4 عروض."),
    );
    expect(ar.AdminProducts.bulk.errors.partial).toContain("{done}");
  });

  it("the button uses only logical (RTL-safe) spacing", () => {
    const { container } = renderButton("products", 3, "ar");
    expect(container.innerHTML).not.toMatch(/\b(?:ml|mr|pl|pr)-\d/);
  });
});

describe("where the bulk actions exist — and where they must not", () => {
  const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

  it("Products and Special Offers each get exactly their own action, wired to the real counts", () => {
    expect(read("src/app/admin/products/page.tsx")).toMatch(
      /<BulkActionButton kind="products" count=\{rows\.length\}/,
    );
    expect(read("src/components/admin/AdminOffersManager.tsx")).toMatch(
      /<BulkActionButton kind="offers" count=\{offers\.length\}/,
    );
  });

  it.each([
    "src/app/admin/orders/page.tsx",
    "src/components/admin/AdminOrdersList.tsx",
    "src/app/admin/customers/page.tsx",
    "src/components/admin/AdminCustomersList.tsx",
    "src/app/admin/categories/page.tsx",
    "src/components/admin/CategoryManager.tsx",
    "src/app/admin/showcases/page.tsx",
    "src/components/admin/ShowcaseManager.tsx",
    "src/app/admin/team/page.tsx",
    "src/components/admin/TeamManager.tsx",
    "src/app/admin/locations/page.tsx",
    "src/components/admin/DeliveryLocationManager.tsx",
    "src/app/admin/exports/page.tsx",
  ])("%s has no bulk destructive action (it would damage history or relations)", (path) => {
    expect(read(path)).not.toMatch(/BulkActionButton|deleteAll|removeAll/i);
  });

  it("the bulk actions never write to orders, users, categories, showcases or locations", () => {
    const service = read("src/lib/domain/admin/bulk.service.ts");
    expect(service).not.toMatch(
      /ordersCollection|usersCollection|categoriesCollection|categoryShowcasesCollection|deliveryLocationsCollection|getAdminAuth/,
    );
    expect(service).toContain("productsCollection");
  });

  it("both actions are guarded by the admin check before any input is read", () => {
    const actions = read("src/actions/admin/bulk.actions.ts");
    expect(actions.indexOf("guardAdmin()")).toBeLessThan(actions.indexOf("safeParse(input)"));
    expect(actions).toContain("requireAdmin");
  });
});
