import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

/**
 * The restyled Checkout form: every existing behaviour (prefill, required
 * phone, region → city, validation, Cash on Delivery, submit payload, error
 * states) plus the new compact markup. The server actions are mocked — no
 * order is ever created and nothing touches Firebase.
 */

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock, refresh: refreshMock }) }));

const submitMock = vi.fn();
const locationsMock = vi.fn();
vi.mock("@/actions/checkout.actions", () => ({
  submitCheckoutAction: (input: unknown) => submitMock(input),
  getDeliveryLocationsForRegionAction: (regionId: string) => locationsMock(regionId),
}));
// The change-location dialog has its own tests; here it is an open/closed marker.
vi.mock("@/components/storefront/LocationSelectorDialog", () => ({
  LocationSelectorDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="location-dialog" /> : null,
}));

const { CheckoutForm } = await import("@/components/storefront/CheckoutForm");

const REGIONS = [
  { id: "west-bank" as const, name: { en: "West Bank", ar: "الضفة الغربية" } },
  { id: "inside-1948" as const, name: { en: "Inside / 1948 Areas", ar: "الداخل / مناطق 48" } },
];
const WEST_BANK_LOCATIONS = [
  { id: "ramallah", name: { en: "Ramallah", ar: "رام الله" }, slug: "ramallah" },
  { id: "nablus", name: { en: "Nablus", ar: "نابلس" }, slug: "nablus" },
];

function renderForm(
  props: Partial<Parameters<typeof CheckoutForm>[0]> = {},
  locale: "en" | "ar" = "en",
) {
  const messages = locale === "en" ? en : ar;
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={
        { Checkout: messages.Checkout, LocationSelector: messages.LocationSelector } as never
      }
    >
      <CheckoutForm
        locale={locale}
        regions={REGIONS}
        prefill={{ fullName: "", email: "", phone: "" }}
        prefillLocation={null}
        locationsByRegionForDialog={{}}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const submit = () => fireEvent.submit(document.querySelector("form")!);

beforeEach(() => {
  pushMock.mockReset();
  refreshMock.mockReset();
  submitMock
    .mockReset()
    .mockResolvedValue({ ok: true, data: { orderNumber: "ELR-20260930-0001" } });
  locationsMock.mockReset().mockResolvedValue(WEST_BANK_LOCATIONS);
});
afterEach(cleanup);

/** Fills every required field with valid values (region → city included). */
async function fillValid(overrides: { phone?: string } = {}) {
  fireEvent.change(field(/^Full Name/), { target: { value: "Sara Ahmed" } });
  fireEvent.change(field(/^Mobile Phone Number/), {
    target: { value: overrides.phone ?? "+970 59 123 4567" },
  });
  fireEvent.change(field(/^Email/), { target: { value: "sara@example.com" } });
  fireEvent.change(field(/^Region/), { target: { value: "west-bank" } });
  await waitFor(() => expect(screen.getAllByRole("option", { name: "Ramallah" })).toHaveLength(1));
  fireEvent.change(field(/^City \/ Area/), { target: { value: "ramallah" } });
  fireEvent.change(field(/^Full Address/), { target: { value: "1 Main Street" } });
}

describe("CheckoutForm — structure and compact styling", () => {
  it("has the four sections: Contact, Delivery, Payment, then Place Order", () => {
    renderForm();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Contact Information", "Delivery Information", "Payment Method"]);
    expect(
      screen.getByText("We'll use this information to contact you about your order."),
    ).toBeTruthy();
    expect(screen.getByText("Please provide your delivery address.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Place Order" })).toBeTruthy();
  });

  it("is one compact card: 46px controls, 14.5px text, short textareas, a 50px button", () => {
    renderForm();
    const form = document.querySelector("form")!;
    expect(form.className).toMatch(/rounded-2xl/);
    for (const control of [...form.querySelectorAll("input:not([type=radio]), select")]) {
      expect(control.className, control.getAttribute("type") ?? control.tagName).toContain(
        "h-[46px]",
      );
      expect(control.className).toContain("text-[0.90625rem]");
    }
    const areas = [...form.querySelectorAll("textarea")] as HTMLTextAreaElement[];
    expect(areas).toHaveLength(2);
    for (const area of areas) expect(area.rows).toBe(2);
    expect(areas[0]!.className).toContain("min-h-[4.25rem]"); // 68px — the old one was 96px
    expect(areas[1]!.className).toContain("min-h-[3.75rem]");
    expect(screen.getByRole("button", { name: "Place Order" }).className).toContain("h-[50px]");
  });

  it("pairs Phone | Email and Region | City on desktop (two columns), one column on phones", () => {
    renderForm();
    const grids = [...document.querySelectorAll("form .grid")];
    const pairs = grids.filter((g) => /sm:grid-cols-2/.test(g.className));
    expect(pairs).toHaveLength(2);
    // The label's own caption — not its control's text (a <select> carries its option names).
    const labelsOf = (g: Element) =>
      [...g.querySelectorAll("label")].map((l) =>
        l
          .querySelector(":scope > span")
          ?.textContent?.replace(/\s*\*$/, "")
          .trim(),
      );
    expect(labelsOf(pairs[0]!)).toEqual(["Mobile Phone Number", "Email"]);
    expect(labelsOf(pairs[1]!)).toEqual(["Region", "City / Area"]);
    for (const g of pairs) expect(g.className).toMatch(/grid-cols-1/);
  });

  it("uses only logical (RTL-mirroring) direction classes", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/storefront/CheckoutForm.tsx"),
      "utf8",
    );
    const classes = [
      ...source.matchAll(/(?:className=|"|`)([^"`]*\b(?:flex|grid|absolute|px|ps|pe)-[^"`]*)["`]/g),
    ]
      .map((m) => m[1])
      .join(" ");
    expect(classes).not.toMatch(/(?<![\w-])(?:ml|mr|pl|pr|left|right|text-left|text-right)-/);
  });
});

describe("CheckoutForm — preserved behaviour", () => {
  it("prefills a signed-in customer's name, email and phone (users.phone)", () => {
    renderForm({
      prefill: { fullName: "Sara Ahmed", email: "sara@example.com", phone: "+970 59 123 4567" },
    });
    expect(field(/^Full Name/).value).toBe("Sara Ahmed");
    expect(field(/^Email/).value).toBe("sara@example.com");
    expect(field(/^Mobile Phone Number/).value).toBe("+970 59 123 4567");
  });

  it("requires a phone number", () => {
    renderForm({ prefill: { fullName: "Sara", email: "sara@example.com", phone: "" } });
    expect(field(/^Mobile Phone Number/).required).toBe(true);
    submit();
    expect(screen.getByText("Mobile phone number is required.")).toBeTruthy();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid phone number", () => {
    renderForm({ prefill: { fullName: "Sara", email: "sara@example.com", phone: "not-a-phone" } });
    submit();
    expect(screen.getByText("Enter a valid mobile phone number.")).toBeTruthy();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("keeps City / Area disabled until a region is chosen, then loads that region's areas", async () => {
    renderForm();
    expect(field(/^City \/ Area/).disabled).toBe(true);
    fireEvent.change(field(/^Region/), { target: { value: "west-bank" } });
    await waitFor(() => expect(screen.getByRole("option", { name: "Nablus" })).toBeTruthy());
    expect(locationsMock).toHaveBeenCalledWith("west-bank");
    await waitFor(() => expect(field(/^City \/ Area/).disabled).toBe(false));
  });

  it("shows each validation error in turn (region, city, address, email)", async () => {
    renderForm({
      prefill: { fullName: "Sara", email: "sara@example.com", phone: "+970 59 123 4567" },
    });
    submit();
    expect(screen.getByText("Select a delivery region.")).toBeTruthy();
    fireEvent.change(field(/^Region/), { target: { value: "west-bank" } });
    await waitFor(() => expect(screen.getByRole("option", { name: "Ramallah" })).toBeTruthy());
    submit();
    expect(screen.getByText("Select a delivery city or area.")).toBeTruthy();
    fireEvent.change(field(/^City \/ Area/), { target: { value: "ramallah" } });
    submit();
    expect(screen.getByText("Full address is required.")).toBeTruthy();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("submits the same payload as before — Cash on Delivery, phone included, notes null when empty", async () => {
    renderForm();
    await fillValid();
    await act(async () => submit());
    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock).toHaveBeenCalledWith({
      fullName: "Sara Ahmed",
      phone: "+970 59 123 4567",
      regionId: "west-bank",
      locationId: "ramallah",
      fullAddress: "1 Main Street",
      email: "sara@example.com",
      notes: null,
      paymentMethod: "CASH_ON_DELIVERY",
    });
    expect(pushMock).toHaveBeenCalledWith("/en/order-confirmation/ELR-20260930-0001");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("includes the optional notes when written", async () => {
    renderForm();
    await fillValid();
    fireEvent.change(screen.getByLabelText(/^Notes/), { target: { value: "Ring the bell twice" } });
    await act(async () => submit());
    expect(submitMock.mock.calls[0]![0]).toMatchObject({ notes: "Ring the bell twice" });
  });

  it("shows the server's error codes the same way as before, and never redirects", async () => {
    renderForm();
    await fillValid();
    submitMock.mockResolvedValue({
      ok: false,
      error: { code: "LOCATION_NOT_SUPPORTED", message: "x" },
    });
    await act(async () => submit());
    expect(
      screen.getByText("This delivery area is not currently supported. Please choose another."),
    ).toBeTruthy();

    submitMock.mockResolvedValue({
      ok: false,
      error: { code: "SOLD_OUT", message: "That piece just sold out." },
    });
    await act(async () => submit());
    expect(screen.getByText("That piece just sold out.")).toBeTruthy();

    submitMock.mockRejectedValue(new Error("offline"));
    await act(async () => submit());
    expect(screen.getByText(/You're offline/)).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("resolves the remembered delivery location into a 'Selected' row with a Change button", async () => {
    renderForm({ prefillLocation: { regionId: "west-bank", locationId: "ramallah" } });
    expect(await screen.findByText("Selected: Ramallah")).toBeTruthy();
    expect(field(/^Region/).value).toBe("west-bank");
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByTestId("location-dialog")).toBeTruthy();
  });

  it("Cash on Delivery is one compact selected card, with its hint", () => {
    renderForm();
    expect(screen.getAllByText("Cash on Delivery")).toHaveLength(1); // the e2e specs rely on a single match
    const radio = screen.getByRole("radio") as HTMLInputElement;
    expect(radio.checked).toBe(true);
    expect(radio.readOnly).toBe(true);
    expect(screen.getByText("Pay with cash when your order arrives.")).toBeTruthy();
  });

  it("shows the lock on Place Order and a neutral protection note that matches the store's existing copy", () => {
    renderForm();
    const button = screen.getByRole("button", { name: "Place Order" });
    expect(button.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("Your information is protected.")).toBeTruthy();
    // The same words as the homepage trust strip's existing "Secure Shopping" line (which has no final period).
    expect(en.Checkout.secureNote.replace(/\.$/, "")).toBe(en.Home.benefitSecureBody);
    expect(ar.Checkout.secureNote.replace(/\.$/, "")).toBe(ar.Home.benefitSecureBody);
    expect(screen.queryByText(/encrypt|SSL|PCI|guarantee/i)).toBeNull();
  });

  it("disables the fields and shows the busy label while the order is being placed", async () => {
    let finish!: (value: unknown) => void;
    submitMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderForm();
    await fillValid();
    await act(async () => submit());
    const button = screen.getByRole("button", { name: "Placing your order…" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(field(/^Full Name/).disabled).toBe(true);
    await act(async () => finish({ ok: true, data: { orderNumber: "ELR-1" } }));
  });
});

describe("CheckoutForm — Arabic", () => {
  it("renders every label, hint and button in Arabic, with no raw keys", async () => {
    const { container } = renderForm({ prefill: { fullName: "", email: "", phone: "" } }, "ar");
    expect(screen.getByLabelText(/^الاسم الكامل/)).toBeTruthy();
    expect(screen.getByLabelText(/^رقم الهاتف المحمول/)).toBeTruthy();
    expect(screen.getByLabelText(/^البريد الإلكتروني/)).toBeTruthy();
    expect(screen.getByLabelText(/^المنطقة/)).toBeTruthy();
    expect(screen.getByLabelText(/^العنوان الكامل/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "إتمام الطلب" })).toBeTruthy();
    expect(screen.getAllByText("الدفع عند الاستلام")).toHaveLength(1); // the AR e2e relies on a single match
    expect(screen.getByText("ادفعي نقدًا عند وصول طلبك.")).toBeTruthy();
    expect(screen.getByText("معلوماتكِ محمية.")).toBeTruthy();
    expect(screen.getByText("رقم الهاتف المحمول", { selector: "label span" })).toBeTruthy();
    expect(container.textContent).not.toMatch(/Checkout\.|contactHint|codHint|secureNote/);
  });

  it("shows Arabic validation errors and Arabic region names", async () => {
    renderForm({}, "ar");
    submit();
    expect(screen.getByText("الاسم الكامل مطلوب.")).toBeTruthy();
    expect(screen.getByRole("option", { name: "الضفة الغربية" })).toBeTruthy();
  });

  it("has English and Arabic text for every new Checkout key", () => {
    for (const messages of [en, ar]) {
      for (const key of [
        "subtitle",
        "contactHint",
        "deliveryHint",
        "paymentHint",
        "codHint",
        "addressPlaceholder",
        "notesPlaceholder",
        "secureNote",
        "whyTitle",
        "itemCount",
      ]) {
        expect((messages.Checkout as unknown as Record<string, string>)[key], key).toBeTruthy();
      }
    }
    // The payment hint must not contain the method's own name, or getByText("Cash on Delivery") would match twice.
    expect(en.Checkout.codHint).not.toMatch(/cash on delivery/i);
    expect(ar.Checkout.codHint).not.toContain(ar.Checkout.cashOnDelivery);
    void within; // (kept for future scoped queries)
  });
});
