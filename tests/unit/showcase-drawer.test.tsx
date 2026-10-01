import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

/**
 * Admin Homepage Showcases: one showcase per category in the UI (New
 * Showcase disabled once every active category has one; the picker only
 * offers free categories), and the Edit drawer exposing every existing field
 * and saving through the existing actions (mocked — nothing is written).
 */

const createMock = vi.fn();
const updateMock = vi.fn();
const attachMock = vi.fn();
vi.mock("@/actions/admin/category-showcase.actions", () => ({
  createCategoryShowcaseAction: (input: unknown) => createMock(input),
  updateCategoryShowcaseAction: (input: unknown) => updateMock(input),
  attachShowcaseImageAction: (input: unknown) => attachMock(input),
}));
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}));
vi.mock("@/components/admin/ImageUploader", () => ({
  ImageUploader: ({ label }: { label?: string }) => (
    <>
      <input type="file" aria-label="upload" />
      <button type="button">{label}</button>
    </>
  ),
}));

const { ShowcaseManager } = await import("@/components/admin/ShowcaseManager");
type Props = Parameters<typeof ShowcaseManager>[0];

const CATEGORIES: Props["categories"] = [
  { id: "bracelets", nameEn: "Bracelets", isActive: true },
  { id: "rings", nameEn: "Rings", isActive: true },
  { id: "necklaces", nameEn: "Necklaces", isActive: true },
  { id: "hidden", nameEn: "Hidden", isActive: false },
];

function showcase(
  id: string,
  categoryId: string,
  categoryName: string,
  displayOrder: number,
): Props["showcases"][number] {
  return {
    id,
    categoryId,
    categoryName,
    title: { en: `${categoryName} title`, ar: `${categoryName} ع` },
    subtitle: { en: `${categoryName} subtitle`, ar: null },
    cta: { en: `Shop ${categoryName}`, ar: "تسوّقي" },
    desktopImage: { url: `https://example.com/${id}-d.jpg`, storagePath: `showcases/${id}/d.jpg` },
    mobileImage: { url: `https://example.com/${id}-m.jpg`, storagePath: `showcases/${id}/m.jpg` },
    displayOrder,
    isActive: true,
  };
}

function renderManager(props: Props) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ AdminShowcases: en.AdminShowcases }}>
      <ShowcaseManager {...props} />
    </NextIntlClientProvider>,
  );
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
});

beforeEach(() => {
  createMock.mockReset().mockResolvedValue({ ok: true, data: { showcaseId: "new" } });
  updateMock.mockReset().mockResolvedValue({ ok: true, data: null });
  refreshMock.mockReset();
});

afterEach(cleanup);

describe("New Showcase — one showcase per category", () => {
  it("is disabled, with the reason, when every active category already has a showcase", () => {
    renderManager({
      showcases: [
        showcase("s1", "bracelets", "Bracelets", 1),
        showcase("s2", "rings", "Rings", 2),
        showcase("s3", "necklaces", "Necklaces", 3),
      ],
      categories: CATEGORIES,
    });
    const button = screen.getByRole("button", { name: "New Showcase" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Every active category already has a homepage showcase.")).toBeTruthy();
  });

  it("offers only active categories without a showcase", () => {
    renderManager({
      showcases: [showcase("s1", "bracelets", "Bracelets", 1)],
      categories: CATEGORIES,
    });
    fireEvent.click(screen.getByRole("button", { name: "New Showcase" }));

    const dialog = screen.getByRole("dialog");
    const options = within(dialog)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["Select category", "Rings", "Necklaces"]);
    expect(within(dialog).getByRole("heading", { name: "Add New Showcase" })).toBeTruthy();
    expect((within(dialog).getByRole("spinbutton") as HTMLInputElement).value).toBe("2");
  });
});

describe("Edit Showcase", () => {
  it("opens with every existing field, and its own category still selectable", () => {
    renderManager({
      showcases: [showcase("s1", "bracelets", "Bracelets", 1), showcase("s2", "rings", "Rings", 2)],
      categories: CATEGORIES,
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Bracelets" })[0]);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Edit Showcase" })).toBeTruthy();
    expect((within(dialog).getByRole("combobox") as HTMLSelectElement).value).toBe("bracelets");
    expect(
      within(dialog)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Select category", "Bracelets", "Necklaces"]);
    expect((within(dialog).getByLabelText(/^Title — English/) as HTMLInputElement).value).toBe(
      "Bracelets title",
    );
    expect((within(dialog).getByLabelText("Title — Arabic") as HTMLInputElement).value).toBe(
      "Bracelets ع",
    );
    expect(
      (within(dialog).getByLabelText("Subtitle — English (optional)") as HTMLInputElement).value,
    ).toBe("Bracelets subtitle");
    expect(
      (within(dialog).getByLabelText(/^Call to action — English/) as HTMLInputElement).value,
    ).toBe("Shop Bracelets");
    expect(
      (within(dialog).getByLabelText("Call to action — Arabic") as HTMLInputElement).value,
    ).toBe("تسوّقي");
    expect((within(dialog).getByRole("spinbutton") as HTMLInputElement).value).toBe("1");
    expect(
      (within(dialog).getByRole("checkbox", { name: "Active" }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(within(dialog).getAllByLabelText("upload")).toHaveLength(2); // desktop + mobile uploaders
  });

  it("saves through updateCategoryShowcaseAction, keeping the real image storage paths", async () => {
    renderManager({
      showcases: [showcase("s1", "bracelets", "Bracelets", 1)],
      categories: CATEGORIES,
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Bracelets" })[0]);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Title — English/), {
      target: { value: "New title" },
    });

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));
    });

    expect(updateMock).toHaveBeenCalledWith({
      showcaseId: "s1",
      categoryId: "bracelets",
      title: { en: "New title", ar: "Bracelets ع" },
      subtitle: { en: "Bracelets subtitle", ar: null },
      cta: { en: "Shop Bracelets", ar: "تسوّقي" },
      desktopImage: { url: "https://example.com/s1-d.jpg", storagePath: "showcases/s1/d.jpg" },
      mobileImage: { url: "https://example.com/s1-m.jpg", storagePath: "showcases/s1/m.jpg" },
      displayOrder: 1,
      isActive: true,
    });
    expect(createMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes from Cancel and returns focus to the control that opened it", () => {
    renderManager({
      showcases: [showcase("s1", "bracelets", "Bracelets", 1)],
      categories: CATEGORIES,
    });
    const opener = screen.getAllByRole("button", { name: "Edit" })[0];
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe("Status pill — ACTIVE ⇄ INACTIVE toggle", () => {
  // The table and the card list both render (CSS hides one), so take the table's pill.
  const pill = () => screen.getAllByTestId("showcase-status-toggle")[0] as HTMLButtonElement;

  it("is a button that sets an ACTIVE showcase INACTIVE through updateCategoryShowcaseAction", async () => {
    renderManager({
      showcases: [showcase("s1", "bracelets", "Bracelets", 1)],
      categories: CATEGORIES,
    });
    expect(pill().tagName).toBe("BUTTON");
    expect(pill().getAttribute("aria-label")).toBe("Active — Click to set Inactive");

    await act(async () => {
      fireEvent.click(pill());
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({ showcaseId: "s1", isActive: false });
    expect(pill().textContent).toBe("Inactive");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("sets an INACTIVE showcase back to ACTIVE", async () => {
    renderManager({
      showcases: [{ ...showcase("s1", "bracelets", "Bracelets", 1), isActive: false }],
      categories: CATEGORIES,
    });
    expect(pill().textContent).toBe("Inactive");

    await act(async () => {
      fireEvent.click(pill());
    });

    expect(updateMock).toHaveBeenCalledWith({ showcaseId: "s1", isActive: true });
    expect(pill().textContent).toBe("Active");
  });

  it("shows a busy state and ignores repeat clicks while saving", async () => {
    let resolve!: (value: unknown) => void;
    updateMock.mockReturnValue(new Promise((r) => (resolve = r)));
    renderManager({
      showcases: [showcase("s1", "bracelets", "Bracelets", 1)],
      categories: CATEGORIES,
    });

    await act(async () => {
      fireEvent.click(pill());
      fireEvent.click(pill());
    });
    expect(pill().getAttribute("aria-busy")).toBe("true");
    expect(pill().getAttribute("aria-disabled")).toBe("true");
    await act(async () => {
      fireEvent.click(pill());
    });
    expect(updateMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ ok: true, data: null });
    });
    expect(pill().getAttribute("aria-busy")).toBeNull();
    expect(pill().textContent).toBe("Inactive");
  });

  it("restores the previous status and shows an error when saving fails", async () => {
    updateMock.mockResolvedValue({ ok: false, error: { code: "FORBIDDEN", message: "No." } });
    renderManager({
      showcases: [showcase("s1", "bracelets", "Bracelets", 1)],
      categories: CATEGORIES,
    });

    await act(async () => {
      fireEvent.click(pill());
    });

    expect(pill().textContent).toBe("Active");
    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn't update the showcase status. Please try again.",
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("restores the previous status when the action throws", async () => {
    updateMock.mockRejectedValue(new Error("network"));
    renderManager({
      showcases: [{ ...showcase("s1", "bracelets", "Bracelets", 1), isActive: false }],
      categories: CATEGORIES,
    });

    await act(async () => {
      fireEvent.click(pill());
    });

    expect(pill().textContent).toBe("Inactive");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("keeps the Edit drawer's Active checkbox in sync with the table status", async () => {
    renderManager({
      showcases: [showcase("s1", "bracelets", "Bracelets", 1)],
      categories: CATEGORIES,
    });
    await act(async () => {
      fireEvent.click(pill());
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    const dialog = screen.getByRole("dialog");
    expect(
      (within(dialog).getByRole("checkbox", { name: "Active" }) as HTMLInputElement).checked,
    ).toBe(false);

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));
    });
    expect(updateMock).toHaveBeenLastCalledWith(expect.objectContaining({ isActive: false }));
  });

  it("toggles only the clicked showcase", async () => {
    renderManager({
      showcases: [showcase("s1", "bracelets", "Bracelets", 1), showcase("s2", "rings", "Rings", 2)],
      categories: CATEGORIES,
    });
    const pills = () => screen.getAllByTestId("showcase-status-toggle");

    await act(async () => {
      fireEvent.click(pills()[1]); // table row for s2
    });

    expect(updateMock).toHaveBeenCalledWith({ showcaseId: "s2", isActive: false });
    expect(pills()[0].textContent).toBe("Active");
    expect(pills()[1].textContent).toBe("Inactive");
  });

  it("renders Arabic labels in the Arabic admin", () => {
    render(
      <NextIntlClientProvider locale="ar" messages={{ AdminShowcases: ar.AdminShowcases }}>
        <ShowcaseManager
          showcases={[showcase("s1", "bracelets", "Bracelets", 1)]}
          categories={CATEGORIES}
        />
      </NextIntlClientProvider>,
    );
    expect(pill().textContent).toBe("نشطة");
    expect(pill().getAttribute("aria-label")).toBe("نشطة — انقر لإلغاء التفعيل");
  });
});

describe("Showcase thumbnails", () => {
  const thumbSrcs = () =>
    screen.getAllByTestId("showcase-thumbnail").map((t) => ({
      src: t.querySelector("img")?.getAttribute("src"),
      placeholder: t.hasAttribute("data-placeholder"),
    }));

  it("shows each row's own Desktop Image in the table and the cards", () => {
    renderManager({
      showcases: [showcase("s1", "bracelets", "Bracelets", 1), showcase("s2", "rings", "Rings", 2)],
      categories: CATEGORIES,
    });
    // Table rows first, then the mobile cards.
    expect(thumbSrcs()).toEqual([
      { src: "https://example.com/s1-d.jpg", placeholder: false },
      { src: "https://example.com/s2-d.jpg", placeholder: false },
      { src: "https://example.com/s1-d.jpg", placeholder: false },
      { src: "https://example.com/s2-d.jpg", placeholder: false },
    ]);
  });

  it("falls back to the TIA placeholder only for a missing or seeded-logo image", () => {
    renderManager({
      showcases: [
        { ...showcase("s1", "bracelets", "Bracelets", 1), desktopImage: null },
        {
          ...showcase("s2", "rings", "Rings", 2),
          desktopImage: { url: "/brand/logo.svg", storagePath: "seed/showcases/rings.svg" },
        },
        showcase("s3", "necklaces", "Necklaces", 3),
      ],
      categories: CATEGORIES,
    });
    expect(thumbSrcs().slice(0, 3)).toEqual([
      { src: "/brand/logo.svg", placeholder: true },
      { src: "/brand/logo.svg", placeholder: true },
      { src: "https://example.com/s3-d.jpg", placeholder: false },
    ]);
  });

  it("updates when refreshed rows carry a new Desktop Image", () => {
    const initial = [showcase("s1", "bracelets", "Bracelets", 1)];
    const { rerender } = renderManager({ showcases: initial, categories: CATEGORIES });
    const updated = [
      {
        ...initial[0],
        desktopImage: { url: "https://example.com/new-d.jpg", storagePath: "showcases/s1/new.jpg" },
      },
    ];
    rerender(
      <NextIntlClientProvider locale="en" messages={{ AdminShowcases: en.AdminShowcases }}>
        <ShowcaseManager showcases={updated} categories={CATEGORIES} />
      </NextIntlClientProvider>,
    );
    expect(thumbSrcs().map((t) => t.src)).toEqual([
      "https://example.com/new-d.jpg",
      "https://example.com/new-d.jpg",
    ]);
  });
});

describe("Edit Showcase — redesigned image area", () => {
  const open = (row: Props["showcases"][number], locale: "en" | "ar" = "en") => {
    render(
      <NextIntlClientProvider
        locale={locale}
        messages={{ AdminShowcases: (locale === "en" ? en : ar).AdminShowcases }}
      >
        <ShowcaseManager showcases={[row]} categories={CATEGORIES} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: locale === "en" ? "Edit" : ar.AdminShowcases.edit })[0],
    );
    return screen.getByRole("dialog");
  };

  it("previews the real desktop and mobile images and shows the recommended sizes", () => {
    const dialog = open(showcase("s1", "bracelets", "Bracelets", 1));
    const previews = within(dialog).getAllByTestId("showcase-image-preview");
    expect(previews).toHaveLength(2);
    expect(previews.every((p) => !p.hasAttribute("data-placeholder"))).toBe(true);
    expect(within(previews[0]).getByRole("presentation").getAttribute("src")).toBe(
      "https://example.com/s1-d.jpg",
    );
    expect(within(previews[1]).getByRole("presentation").getAttribute("src")).toBe(
      "https://example.com/s1-m.jpg",
    );
    expect(within(dialog).getByText("1920 × 800 px (16:9)")).toBeTruthy();
    expect(within(dialog).getByText("1080 × 1350 px (4:5)")).toBeTruthy();
  });

  it("shows the TIA placeholder for a missing desktop image and an empty frame for a missing mobile image", () => {
    const row = {
      ...showcase("s1", "bracelets", "Bracelets", 1),
      desktopImage: null,
      mobileImage: null,
    };
    const dialog = open(row);
    const [desktop, mobile] = within(dialog).getAllByTestId("showcase-image-preview");
    expect(desktop.hasAttribute("data-placeholder")).toBe(true);
    expect(desktop.querySelector('img[src="/brand/logo.svg"]')).toBeTruthy();
    expect(mobile.hasAttribute("data-placeholder")).toBe(true);
    expect(mobile.querySelector("img")).toBeNull();
    expect(within(mobile).getByText("No image yet")).toBeTruthy();
  });

  it("renders the Arabic drawer without raw translation keys", () => {
    const dialog = open(showcase("s1", "bracelets", "Bracelets", 1), "ar");
    expect(dialog.textContent).not.toMatch(/AdminShowcases|drawer\./);
    expect(within(dialog).getAllByRole("button", { name: "رفع صورة" })).toHaveLength(2);
    expect(within(dialog).getByRole("button", { name: "حفظ التغييرات" })).toBeTruthy();
    expect(within(dialog).getAllByText(/المقاس المقترح:/)).toHaveLength(2);
  });
});
