import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { formatCurrency } from "@/lib/utils/currency";
import type { Order, OrderStatus } from "@/types/order";

/**
 * The customer Edit Order UI: the form's behaviour (quantity limits, removal, last-item rule,
 * payload, errors, double submit), the Edit button's visibility, the not-editable state, EN/AR
 * and the compact responsive markup. The server action is mocked — nothing touches Firebase.
 */

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock, refresh: refreshMock }) }));
const saveMock = vi.fn();
vi.mock("@/actions/order.actions", () => ({
  updateCustomerOrderAction: (input: unknown) => saveMock(input),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={`/en${href}`} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({
      locale,
      messages: (locale === "ar" ? ar : en) as never,
      namespace: namespace as never,
    }),
}));

const { OrderEditForm } = await import("@/components/storefront/checkout/OrderEditForm");
const { OrderEditView } = await import("@/components/storefront/checkout/OrderEditView");
const { OrderConfirmationView } =
  await import("@/components/storefront/checkout/OrderConfirmationView");

const REGIONS = [
  { id: "west-bank" as const, name: { en: "West Bank", ar: "الضفة الغربية" } },
  { id: "inside-1948" as const, name: { en: "Inside 1948", ar: "الداخل" } },
];
const LOCATIONS = {
  "west-bank": [
    { id: "ramallah", name: { en: "Ramallah", ar: "رام الله" } },
    { id: "nablus", name: { en: "Nablus", ar: "نابلس" } },
  ],
  "inside-1948": [{ id: "haifa", name: { en: "Haifa", ar: "حيفا" } }],
};
const LINES = [
  {
    productId: "watch",
    optionKey: null,
    valueKey: null,
    name: { en: "Luna Mesh Watch", ar: "ساعة لونا" },
    optionLabel: null,
    thumbnail: null,
    unitPrice: 12000,
    originalPrice: 24000,
    wasOnSale: true,
    quantity: 2,
    maxQuantity: 4,
  },
  {
    productId: "cuff",
    optionKey: "color",
    valueKey: "gold",
    name: { en: "Aurelia Cuff", ar: "سوار أوريليا" },
    optionLabel: { en: "Gold", ar: "ذهبي" },
    thumbnail: null,
    unitPrice: 18500,
    originalPrice: 18500,
    wasOnSale: false,
    quantity: 1,
    maxQuantity: 3,
  },
];

function renderForm(locale: "en" | "ar" = "en", lines = LINES) {
  const messages = locale === "en" ? en : ar;
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={
        {
          OrderEdit: messages.OrderEdit,
          Checkout: messages.Checkout,
          Common: messages.Common,
          Cart: messages.Cart,
          OrderConfirmation: messages.OrderConfirmation,
        } as never
      }
    >
      <OrderEditForm
        locale={locale}
        orderNumber="ELR-20260930-0001"
        lines={lines}
        phone="0599000000"
        regionId="west-bank"
        locationId="ramallah"
        fullAddress="Old street 1"
        notes="Ring twice"
        regions={REGIONS}
        locationsByRegion={LOCATIONS}
      />
    </NextIntlClientProvider>,
  );
}

const quantities = () => screen.getAllByTestId("edit-quantity").map((el) => el.textContent);
const lineFor = (name: string) =>
  screen.getAllByTestId("edit-line").find((li) => li.textContent?.includes(name))!;

beforeEach(() => {
  saveMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
  saveMock.mockResolvedValue({ ok: true, data: { orderNumber: "ELR-20260930-0001", total: 1 } });
});
afterEach(cleanup);

describe("OrderEditForm", () => {
  it("shows every line with stored prices (sale shown as bought), quantity controls and totals", () => {
    renderForm();
    expect(screen.getAllByTestId("edit-line")).toHaveLength(2);
    const watch = lineFor("Luna Mesh Watch");
    expect(within(watch).getByTestId("edit-unit-price").textContent).toContain(
      formatCurrency(24000, "en"),
    );
    expect(within(watch).getByTestId("edit-unit-price").textContent).toContain(
      formatCurrency(12000, "en"),
    );
    expect(within(watch).getByText(en.Common.onSale)).toBeTruthy();
    expect(
      within(watch).getByText(formatCurrency(24000, "en"), { selector: "span.shrink-0" }),
    ).toBeTruthy();
    expect(lineFor("Aurelia Cuff").textContent).toContain("Option: Gold");
    // subtotal and total = stored unit price x quantity.
    expect(screen.getAllByText(formatCurrency(42500, "en"))).toHaveLength(2);
    expect(quantities()).toEqual(["2", "1"]);
  });

  it("prefills the delivery fields and notes", () => {
    renderForm();
    expect((screen.getByLabelText(/Mobile Phone|Phone/i) as HTMLInputElement).value).toBe(
      "0599000000",
    );
    expect((screen.getByDisplayValue("Old street 1") as HTMLTextAreaElement).value).toBe(
      "Old street 1",
    );
    expect(screen.getByDisplayValue("Ring twice")).toBeTruthy();
  });

  it("increases and decreases quantities, recomputing the preview from stored prices", () => {
    renderForm();
    const watch = lineFor("Luna Mesh Watch");
    fireEvent.click(within(watch).getByLabelText(en.OrderEdit.increase));
    expect(quantities()[0]).toBe("3");
    expect(screen.getAllByText(formatCurrency(12000 * 3 + 18500, "en"))).toHaveLength(2);
    fireEvent.click(within(watch).getByLabelText(en.OrderEdit.decrease));
    fireEvent.click(within(watch).getByLabelText(en.OrderEdit.decrease));
    expect(quantities()[0]).toBe("1");
  });

  it("never goes below 1 and never above the available stock", () => {
    renderForm();
    const cuff = lineFor("Aurelia Cuff");
    expect((within(cuff).getByLabelText(en.OrderEdit.decrease) as HTMLButtonElement).disabled).toBe(
      true,
    );
    const inc = within(cuff).getByLabelText(en.OrderEdit.increase) as HTMLButtonElement;
    fireEvent.click(inc);
    fireEvent.click(inc);
    expect(quantities()[1]).toBe("3");
    expect(inc.disabled).toBe(true);
    expect(within(cuff).getByText("Only 3 available")).toBeTruthy();
  });

  it("removes a line, and refuses to remove the last one with an explanation", () => {
    renderForm();
    fireEvent.click(within(lineFor("Aurelia Cuff")).getByText(en.OrderEdit.remove));
    expect(screen.getAllByTestId("edit-line")).toHaveLength(1);
    expect(screen.queryByTestId("last-item-notice")).toBeNull();
    fireEvent.click(within(lineFor("Luna Mesh Watch")).getByText(en.OrderEdit.remove));
    expect(screen.getAllByTestId("edit-line")).toHaveLength(1);
    expect(screen.getByTestId("last-item-notice").textContent).toContain(en.OrderEdit.lastItem);
    expect(screen.getByRole("link", { name: en.OrderEdit.contactUs }).getAttribute("href")).toBe(
      "/en/contact",
    );
  });

  it("sends only lines, quantities and delivery fields — no price, total, status or uid", async () => {
    renderForm();
    fireEvent.click(within(lineFor("Luna Mesh Watch")).getByLabelText(en.OrderEdit.increase));
    fireEvent.click(within(lineFor("Aurelia Cuff")).getByText(en.OrderEdit.remove));
    fireEvent.submit(screen.getByTestId("order-edit-form"));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock.mock.calls[0][0]).toEqual({
      orderNumber: "ELR-20260930-0001",
      items: [{ productId: "watch", optionKey: null, valueKey: null, quantity: 3 }],
      phone: "0599000000",
      regionId: "west-bank",
      locationId: "ramallah",
      fullAddress: "Old street 1",
      notes: "Ring twice",
    });
    const sent = JSON.stringify(saveMock.mock.calls[0][0]);
    expect(sent).not.toMatch(/price|total|status|userId|stock/i);
  });

  it("returns to the order with the updated notice after a successful save", async () => {
    renderForm();
    fireEvent.submit(screen.getByTestId("order-edit-form"));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/en/order-confirmation/ELR-20260930-0001?updated=1"),
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it("shows the exact message when the status changed under the customer — and does not navigate", async () => {
    saveMock.mockResolvedValue({
      ok: false,
      error: { code: "NOT_EDITABLE", message: "NOT_EDITABLE" },
    });
    renderForm();
    fireEvent.submit(screen.getByTestId("order-edit-form"));
    expect(await screen.findByText(en.OrderEdit.errors.notEditable)).toBeTruthy();
    expect(en.OrderEdit.errors.notEditable).toBe(
      "This order can no longer be edited because its status has changed.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("maps stock and other server errors to translated messages", async () => {
    saveMock.mockResolvedValue({ ok: false, error: { code: "INSUFFICIENT_STOCK", message: "x" } });
    renderForm();
    fireEvent.submit(screen.getByTestId("order-edit-form"));
    expect(await screen.findByText(en.OrderEdit.errors.insufficientStock)).toBeTruthy();
  });

  it("validates the phone/address before calling the server", async () => {
    renderForm();
    fireEvent.change(screen.getByDisplayValue("Old street 1"), { target: { value: "  " } });
    fireEvent.submit(screen.getByTestId("order-edit-form"));
    expect(await screen.findByText(en.Checkout.errors.addressRequired)).toBeTruthy();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("blocks a double submission: the second submit while saving never reaches the server", async () => {
    let release!: (value: unknown) => void;
    saveMock.mockReturnValue(new Promise((resolveSave) => (release = resolveSave)));
    renderForm();
    const form = screen.getByTestId("order-edit-form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(saveMock).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect((screen.getByTestId("edit-save") as HTMLButtonElement).disabled).toBe(true),
    );
    expect(screen.getByTestId("edit-save").textContent).toBe(en.OrderEdit.saving);
    release({ ok: true, data: { orderNumber: "ELR-20260930-0001", total: 1 } });
    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));
  });

  it("Cancel only leaves the editor: a plain link back to the order, no server call", () => {
    renderForm();
    const cancel = screen.getByTestId("edit-cancel");
    expect(cancel.textContent).toBe(en.OrderEdit.cancel);
    expect(cancel.getAttribute("href")).toBe("/en/order-confirmation/ELR-20260930-0001");
    fireEvent.click(cancel);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("changing the region clears the city until a new one is chosen", () => {
    renderForm();
    const region = screen.getByLabelText(/Region/i) as HTMLSelectElement;
    fireEvent.change(region, { target: { value: "inside-1948" } });
    const city = screen.getByLabelText(/City/i) as HTMLSelectElement;
    expect(city.value).toBe("");
    expect(within(city).getByText("Haifa")).toBeTruthy();
    expect(within(city).queryByText("Ramallah")).toBeNull();
  });

  it("renders Arabic with the requested labels, RTL-safe logical classes and no raw keys", () => {
    const { container } = renderForm("ar");
    expect(screen.getByTestId("edit-save").textContent).toBe("حفظ التعديلات");
    expect(screen.getByTestId("edit-cancel").textContent).toBe("إلغاء");
    expect(screen.getByText("ساعة لونا")).toBeTruthy();
    expect(container.textContent).not.toMatch(/OrderEdit\.|Checkout\.|Common\./);
    expect(container.innerHTML).not.toMatch(/\b(?:ml|mr|pl|pr)-\d/);
    expect(container.innerHTML).toContain("max-w-[720px]");
  });
});

function makeOrder(status: OrderStatus = "PENDING"): Order {
  return {
    id: "o1",
    orderNumber: "ELR-20260930-0001",
    userId: "u1",
    customerSnapshot: { fullName: "Sara", email: "s@example.com", phone: "0599000000" },
    deliverySnapshot: {
      regionId: "west-bank",
      regionName: { en: "West Bank", ar: "الضفة الغربية" },
      locationId: "ramallah",
      locationName: { en: "Ramallah", ar: "رام الله" },
      fullAddress: "Old street 1",
    },
    items: [
      {
        productId: "watch",
        productName: { en: "Luna Mesh Watch", ar: "ساعة لونا" },
        selectedOption: null,
        unitPrice: 12000,
        originalPrice: 24000,
        wasOnSale: true,
        quantity: 2,
      },
    ],
    notes: null,
    paymentMethod: "CASH_ON_DELIVERY",
    status,
    subtotal: 24000,
    total: 24000,
  } as unknown as Order;
}

async function showView(status: OrderStatus, locale = "en") {
  const ui = await OrderEditView({
    order: makeOrder(status),
    locale,
    thumbnails: {},
    stockByProduct: { watch: 2 },
    regions: REGIONS,
    locationsByRegion: LOCATIONS,
  });
  const messages = locale === "en" ? en : ar;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("OrderEditView", () => {
  it("shows the form for a PENDING order", async () => {
    await showView("PENDING");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Edit Order");
    expect(screen.getByTestId("order-number-pill").textContent).toContain("#ELR-20260930-0001");
    expect(screen.getByTestId("order-edit-form")).toBeTruthy();
    // The limit is what is in the order now plus what is in stock.
    expect(screen.getByTestId("edit-line").textContent).toContain("Luna Mesh Watch");
  });

  it.each(["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"] as const)(
    "shows no form for a %s order — only the explanation",
    async (status) => {
      await showView(status);
      expect(screen.queryByTestId("order-edit-form")).toBeNull();
      expect(screen.getByTestId("not-editable").textContent).toContain(
        en.OrderEdit.errors.notEditable,
      );
    },
  );

  it("uses the Arabic title and message", async () => {
    await showView("SHIPPED", "ar");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("تعديل الطلب");
    expect(screen.getByTestId("not-editable").textContent).toContain(
      "لم يعد من الممكن تعديل هذا الطلب لأن حالته قد تغيرت.",
    );
  });
});

describe("Edit Order button on the confirmation page", () => {
  async function confirmation(editable: boolean, justUpdated = false, locale = "en") {
    const ui = await OrderConfirmationView({
      order: makeOrder("PENDING"),
      locale,
      thumbnails: {},
      editable,
      justUpdated,
    });
    return render(ui);
  }

  it("shows EDIT ORDER beside Continue Shopping when editable", async () => {
    await confirmation(true);
    const edit = screen.getByTestId("edit-order-link");
    expect(edit.textContent).toBe(en.OrderConfirmation.editOrder);
    expect(edit.getAttribute("href")).toBe("/en/account/orders/ELR-20260930-0001/edit");
    expect(screen.getByRole("link", { name: /continue shopping/i })).toBeTruthy();
  });

  it("hides it when not editable, and labels it in Arabic", async () => {
    await confirmation(false);
    expect(screen.queryByTestId("edit-order-link")).toBeNull();
    cleanup();
    await confirmation(true, false, "ar");
    expect(screen.getByTestId("edit-order-link").textContent).toBe("تعديل الطلب");
  });

  it("shows the updated notice only right after a save", async () => {
    await confirmation(true, true);
    expect(screen.getByTestId("order-updated-notice").textContent).toBe(
      en.OrderConfirmation.orderUpdated,
    );
    cleanup();
    await confirmation(true, false);
    expect(screen.queryByTestId("order-updated-notice")).toBeNull();
  });
});

describe("page wiring", () => {
  it("offers Edit Order only to the signed-in owner of a still-editable order", () => {
    const src = readFileSync(
      resolve(
        __dirname,
        "../../src/app/[locale]/(storefront)/order-confirmation/[orderNumber]/page.tsx",
      ),
      "utf8",
    );
    expect(src).toMatch(/editable=\{isOwner && isOrderEditable\(order\.status\)\}/);
  });

  it("offers Edit Order on Account > Order Details only while the order is PENDING", () => {
    const src = readFileSync(
      resolve(
        __dirname,
        "../../src/app/[locale]/(storefront)/account/orders/[orderNumber]/page.tsx",
      ),
      "utf8",
    );
    expect(src).toMatch(/isOrderEditable\(order\.status\)/);
    expect(src).toContain("/edit`");
  });

  it("makes PENDING the only editable status", async () => {
    const { isOrderEditable, CUSTOMER_EDITABLE_STATUSES } =
      await import("@/lib/domain/orders/order-edit-rules");
    expect(CUSTOMER_EDITABLE_STATUSES).toEqual(["PENDING"]);
    for (const status of ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"] as const) {
      expect(isOrderEditable(status)).toBe(false);
    }
    expect(isOrderEditable("PENDING")).toBe(true);
  });

  it("scopes the edit page to the session uid (another customer gets a 404)", () => {
    const src = readFileSync(
      resolve(
        __dirname,
        "../../src/app/[locale]/(storefront)/account/orders/[orderNumber]/edit/page.tsx",
      ),
      "utf8",
    );
    expect(src).toMatch(/getOrderForCustomer\(orderNumber, claims\.uid\)/);
    expect(src).toMatch(/notFound\(\)/);
  });
});
