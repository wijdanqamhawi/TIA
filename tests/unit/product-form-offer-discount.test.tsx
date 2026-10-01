import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { formatCurrency } from "@/lib/utils/currency";

/**
 * The Special Offer section of the product form (the second place an offer is
 * edited) — same discount % → calculated sale price behaviour as the
 * /admin/offers drawer, via the shared `offer-discount` logic. The actions are
 * mocked: nothing is written anywhere.
 */

const updateMock = vi.fn();
const createMock = vi.fn();
vi.mock("@/actions/admin/product.actions", () => ({
  updateProductAction: (input: unknown) => updateMock(input),
  createProductAction: (input: unknown) => createMock(input),
}));
vi.mock("@/actions/admin/media.actions", () => ({
  attachUploadedImageAction: vi.fn(),
  removeProductImageAction: vi.fn(),
  reorderProductImagesAction: vi.fn(),
}));
vi.mock("@/components/admin/ImageUploader", () => ({ ImageUploader: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));

const { ProductForm } = await import("@/components/admin/ProductForm");
type Initial = Parameters<typeof ProductForm>[0]["initial"];

const INITIAL: Initial = {
  productId: "p1",
  name: { en: "Luna Mesh Watch", ar: null },
  description: { en: "A watch", ar: null },
  material: { en: "Steel", ar: null },
  price: 24000,
  categoryId: "c1",
  options: [],
  stock: 5,
  availability: true,
  isNewArrival: false,
  isBestSeller: false,
  isOnSale: true,
  salePrice: 19200,
  saleStartAt: null,
  saleEndAt: null,
  images: [],
};

function renderForm(overrides: Partial<Initial> = {}, locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? en : ar;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages as never}>
      <ProductForm
        mode="edit"
        initial={{ ...INITIAL, ...overrides }}
        categories={[{ id: "c1", nameEn: "Watches" }]}
      />
    </NextIntlClientProvider>,
  );
}

const salePrice = () => screen.getByTestId("product-sale-price");
const discount = () => screen.getByLabelText("Discount (%)") as HTMLInputElement;
const save = async (container: HTMLElement) => {
  await act(async () => {
    fireEvent.submit(container.querySelector("form")!);
  });
};

beforeEach(() => {
  updateMock.mockReset().mockResolvedValue({ ok: true, data: null });
  createMock.mockReset();
});
afterEach(cleanup);

describe("ProductForm — Special Offer: discount % → calculated sale price", () => {
  it("derives the percentage from the saved sale price when editing (₪240 → ₪192 is 20%)", () => {
    renderForm();
    expect(discount().value).toBe("20");
    expect(salePrice().textContent).toBe(formatCurrency(19200, "en-US"));
  });

  it("recalculates the sale price immediately: 20% → 50%", () => {
    renderForm();
    fireEvent.change(discount(), { target: { value: "50" } });
    expect(salePrice().textContent).toBe(formatCurrency(12000, "en-US"));
  });

  it("follows the regular price field too: ₪185 at 15% → ₪157.25", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Price"), { target: { value: "185" } });
    fireEvent.change(discount(), { target: { value: "15" } });
    expect(salePrice().textContent).toBe(formatCurrency(15725, "en-US"));
  });

  it("shows the sale price as calculated, read-only output — there is nothing to type it into", () => {
    renderForm();
    expect(salePrice().tagName).toBe("OUTPUT");
    expect(screen.queryByRole("spinbutton", { name: /Sale price/ })).toBeNull();
  });

  it("saves the calculated sale price in the existing salePrice field (no percentage is stored)", async () => {
    const { container } = renderForm();
    fireEvent.change(discount(), { target: { value: "50" } });
    await save(container);
    expect(updateMock).toHaveBeenCalledTimes(1);
    const payload = updateMock.mock.calls[0]![0];
    expect(payload).toMatchObject({
      productId: "p1",
      isOnSale: true,
      price: 24000,
      salePrice: 12000,
    });
    expect(payload).not.toHaveProperty("discountPercent");
    expect(payload).not.toHaveProperty("discount");
  });

  it("re-saving an unchanged offer keeps its exact saved price (79.17% shown, ₪50.00 kept)", async () => {
    const { container } = renderForm({ salePrice: 5000 });
    expect(discount().value).toBe("79.17");
    expect(salePrice().textContent).toBe(formatCurrency(5000, "en-US"));
    await save(container);
    expect(updateMock.mock.calls[0]![0]).toMatchObject({ salePrice: 5000 });
  });

  it("rejects 0%, 100%, negative and empty discounts on an enabled offer, without saving", async () => {
    const { container } = renderForm();
    for (const bad of ["0", "100", "-3", "150"]) {
      fireEvent.change(discount(), { target: { value: bad } });
      expect(salePrice().textContent).toBe("—");
      await save(container);
      expect(await screen.findByText(/Enter a discount above 0% and below 100%/)).toBeTruthy();
    }
    fireEvent.change(discount(), { target: { value: "" } });
    await save(container);
    expect(await screen.findByText("Enter a discount percentage.")).toBeTruthy();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("lets a switched-off offer be saved with no discount (its sale price is cleared)", async () => {
    const { container } = renderForm({ isOnSale: false, salePrice: null });
    expect(discount().value).toBe("");
    await save(container);
    expect(updateMock.mock.calls[0]![0]).toMatchObject({ isOnSale: false, salePrice: null });
  });

  it("renders in Arabic with translated label, help and errors (no raw keys)", async () => {
    const { container } = renderForm({}, "ar");
    expect(screen.getByLabelText(ar.AdminProductForm.fields.discountPercent)).toBeTruthy();
    expect(container.textContent).toContain(ar.AdminProductForm.offer.discountHelp);
    expect(container.textContent).toContain(ar.AdminProductForm.offer.salePriceCalculated);
    fireEvent.change(screen.getByLabelText(ar.AdminProductForm.fields.discountPercent), {
      target: { value: "100" },
    });
    await save(container);
    expect(await screen.findByText(ar.AdminProductForm.offer.errors.discountInvalid)).toBeTruthy();
    expect(container.textContent).not.toMatch(
      /AdminProductForm|offer\.errors|fields\.discountPercent/,
    );
  });
});
