import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

/**
 * The Checkout page: its layout (compact header, ~65/35 two columns, one column
 * on small screens) and its data flow (redirects, prefill, the shared summary
 * handed straight through). The form and summary are marker stubs here — they
 * have their own tests — and every data service is mocked.
 */

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({
      locale,
      messages: (locale === "ar" ? ar : en) as never,
      namespace: namespace as never,
    }),
}));

class RedirectSignal extends Error {
  constructor(public target: string) {
    super(`REDIRECT ${target}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new RedirectSignal(target);
  },
}));

const cartMock = vi.fn();
const summaryMock = vi.fn();
vi.mock("@/lib/domain/cart/cart.service", () => ({
  getCartForDisplay: () => cartMock(),
  buildCartSummary: (cart: unknown) => summaryMock(cart),
}));
vi.mock("@/lib/domain/delivery/deliveryLocation.service", () => ({
  getActiveDeliveryRegions: async () => [
    { regionId: "west-bank", name: { en: "West Bank", ar: "الضفة الغربية" } },
  ],
  getActiveDeliveryLocationsByRegion: async () => [
    {
      id: "ramallah",
      name: { en: "Ramallah", ar: "رام الله" },
      slug: "ramallah",
      searchTerms: ["ramallah"],
    },
  ],
}));
vi.mock("@/lib/domain/delivery/location-cookie", () => ({
  readLocationSelection: async () => null,
}));
const claimsMock = vi.fn();
vi.mock("@/lib/firebase/guards", () => ({ getSessionClaims: () => claimsMock() }));
const userDocMock = vi.fn();
vi.mock("@/lib/firebase/firestore", () => ({
  usersCollection: () => ({ doc: () => ({ get: () => userDocMock() }) }),
  getAdminFirestore: () => ({}),
}));

vi.mock("@/components/storefront/CheckoutForm", () => ({
  CheckoutForm: (props: { prefill: unknown; regions: unknown[] }) => (
    <form
      data-testid="form"
      data-prefill={JSON.stringify(props.prefill)}
      data-regions={props.regions.length}
    />
  ),
}));
vi.mock("@/components/storefront/checkout/CheckoutSummary", () => ({
  CheckoutSummary: (props: { summary: { total: number } }) => (
    <aside data-testid="summary" data-total={props.summary.total} />
  ),
}));

const { default: CheckoutPage } = await import("@/app/[locale]/(storefront)/checkout/page");
const { CheckoutView } = await import("@/components/storefront/checkout/CheckoutView");

const SUMMARY = {
  lines: [{ productId: "a" }],
  subtotal: 24000,
  total: 24000,
  hasIssues: false,
  isEmpty: false,
};

async function renderPage(locale: "en" | "ar" = "en") {
  // The page returns an async server component (`CheckoutView`); resolve it as the framework would.
  const element = (await CheckoutPage({ params: Promise.resolve({ locale }) })) as unknown as {
    type: (props: unknown) => Promise<React.ReactElement>;
    props: unknown;
  };
  return render(await element.type(element.props));
}

beforeEach(() => {
  cartMock.mockReset().mockResolvedValue({ id: "cart" });
  summaryMock.mockReset().mockResolvedValue(SUMMARY);
  claimsMock.mockReset().mockResolvedValue(null);
  userDocMock.mockReset();
});
afterEach(cleanup);

describe("Checkout page — layout", () => {
  it("has a compact header: the title, one quiet line and a small rule — in English and Arabic", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Checkout" })).toBeTruthy();
    expect(screen.getByText("Complete your order")).toBeTruthy();
    cleanup();
    await renderPage("ar");
    expect(screen.getByRole("heading", { level: 1, name: "الدفع" })).toBeTruthy();
    expect(screen.getByText("أكملي طلبك")).toBeTruthy();
  });

  it("keeps the title refined: 30px on small screens up to 40px on desktop (target 38–44px)", async () => {
    await renderPage();
    const classes = screen.getByRole("heading", { level: 1 }).className;
    const clamp = classes.match(/text-\[clamp\(([\d.]+)rem,([\d.]+)vw,([\d.]+)rem\)\]/);
    expect(clamp).not.toBeNull();
    const [, min, , max] = clamp!;
    expect(Number(max) * 16).toBeGreaterThanOrEqual(38);
    expect(Number(max) * 16).toBeLessThanOrEqual(44);
    expect(Number(min) * 16).toBeLessThanOrEqual(32);
  });

  it("is a centred container with the form (~65%) beside the summary (~35%), stacked below `lg`", async () => {
    const { container } = await renderPage();
    const grid = screen.getByTestId("form").parentElement!;
    expect(grid.className).toContain("max-w-[1180px]");
    expect(grid.className).toContain("mx-auto");
    expect(grid.className).toContain("grid-cols-1"); // phones and tablets: one column
    const template = grid.className.match(
      /lg:grid-cols-\[minmax\(0,([\d.]+)fr\)_minmax\(0,([\d.]+)fr\)\]/,
    );
    expect(template).not.toBeNull();
    const share = Number(template![1]) / (Number(template![1]) + Number(template![2]));
    expect(share).toBeGreaterThan(0.63);
    expect(share).toBeLessThan(0.67);
    // The form comes first, then the summary — so on phones the summary stacks naturally under the form.
    const children = [...grid.children].map((c) => c.getAttribute("data-testid"));
    expect(children).toEqual(["form", "summary"]);
    expect(container.querySelector("main")!.className).toContain("bg-brand-ivory");
  });

  it("only makes the summary sticky from the desktop breakpoint", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/storefront/checkout/CheckoutSummary.tsx"),
      "utf8",
    );
    expect(source).toContain("lg:sticky");
    expect(source).not.toMatch(/(?<![\w:-])sticky/);
  });

  it("hands the regions, prefill and summary to the form and summary unchanged", async () => {
    render(
      await CheckoutView({
        locale: "en",
        summary: SUMMARY as never,
        regionOptions: [{ id: "west-bank", name: { en: "West Bank", ar: null } }],
        prefill: { fullName: "Sara", email: "s@example.com", phone: "0599" },
        prefillLocation: null,
        locationsByRegionForDialog: {},
      }),
    );
    expect(JSON.parse(screen.getByTestId("form").getAttribute("data-prefill")!)).toEqual({
      fullName: "Sara",
      email: "s@example.com",
      phone: "0599",
    });
    expect(screen.getByTestId("form").getAttribute("data-regions")).toBe("1");
    expect(screen.getByTestId("summary").getAttribute("data-total")).toBe("24000");
  });
});

describe("Checkout page — existing data flow is unchanged", () => {
  it("redirects an empty cart to the shop and a cart with unresolved issues to the cart", async () => {
    summaryMock.mockResolvedValue({ ...SUMMARY, lines: [], subtotal: 0, total: 0, isEmpty: true });
    await expect(renderPage()).rejects.toMatchObject({ target: "/en/shop" });
    summaryMock.mockResolvedValue({ ...SUMMARY, hasIssues: true });
    await expect(renderPage("ar")).rejects.toMatchObject({ target: "/ar/cart" });
    cartMock.mockResolvedValue(null); // no cart at all
    await expect(renderPage()).rejects.toMatchObject({ target: "/en/shop" });
  });

  it("shows the summary `buildCartSummary` computed (the shared effective prices), untouched", async () => {
    await renderPage();
    expect(summaryMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("summary").getAttribute("data-total")).toBe("24000");
  });

  it("prefills a signed-in customer from users/{uid} — name, email and phone", async () => {
    claimsMock.mockResolvedValue({ uid: "u1", role: "CUSTOMER" });
    userDocMock.mockResolvedValue({
      exists: true,
      data: () => ({ name: "Sara Ahmed", email: "sara@example.com", phone: "+970 59 123 4567" }),
    });
    await renderPage();
    expect(JSON.parse(screen.getByTestId("form").getAttribute("data-prefill")!)).toEqual({
      fullName: "Sara Ahmed",
      email: "sara@example.com",
      phone: "+970 59 123 4567",
    });
  });

  it("leaves a guest's form empty, and a signed-in customer without a phone gets an empty phone", async () => {
    await renderPage();
    expect(JSON.parse(screen.getByTestId("form").getAttribute("data-prefill")!)).toEqual({
      fullName: "",
      email: "",
      phone: "",
    });
    cleanup();
    claimsMock.mockResolvedValue({ uid: "u1", role: "CUSTOMER" });
    userDocMock.mockResolvedValue({
      exists: true,
      data: () => ({ name: "Sara", email: "s@example.com", phone: null }),
    });
    await renderPage();
    expect(JSON.parse(screen.getByTestId("form").getAttribute("data-prefill")!).phone).toBe("");
  });

  it("does no pricing itself: no offer or price calculation in the page or the view", () => {
    for (const file of [
      "src/app/[locale]/(storefront)/checkout/page.tsx",
      "src/components/storefront/checkout/CheckoutView.tsx",
    ]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(
        /resolveOfferPricing|getOfferStatus|getEffectivePrice|salePrice|originalPrice|lineTotal\s*[*+]/,
      );
    }
  });
});
