import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";

/**
 * The admin Categories Add/Edit drawer (`CategoryDrawer`): opens as a modal
 * dialog with focus on the first field, returns focus to its opener, closes
 * via X / Cancel / Escape / backdrop, and submits through the existing
 * server actions (mocked here — nothing is written anywhere).
 */

const createCategoryActionMock = vi.fn();
const updateCategoryActionMock = vi.fn();
vi.mock("@/actions/admin/category.actions", () => ({
  createCategoryAction: (input: unknown) => createCategoryActionMock(input),
  updateCategoryAction: (input: unknown) => updateCategoryActionMock(input),
}));
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const { CategoryDrawer } = await import("@/components/admin/CategoryManager");
type DrawerProps = Parameters<typeof CategoryDrawer>[0];

const BRACELETS = {
  id: "bracelets",
  name: { en: "Bracelets", ar: "أساور" },
  description: null,
  displayOrder: 1,
  isActive: true,
  productCount: 7,
};

function renderDrawer(state: DrawerProps["state"], onClose = vi.fn()) {
  const view = render(
    <NextIntlClientProvider locale="en" messages={{ AdminCategories: en.AdminCategories }}>
      <CategoryDrawer state={state} defaultOrder={5} onClose={onClose} />
    </NextIntlClientProvider>,
  );
  return { ...view, onClose, dialog: view.container.ownerDocument.querySelector("dialog")! };
}

beforeAll(() => {
  // jsdom has <dialog> but not the modal API; mirror what the browser does.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  createCategoryActionMock
    .mockReset()
    .mockResolvedValue({ ok: true, data: { categoryId: "necklaces" } });
  updateCategoryActionMock.mockReset().mockResolvedValue({ ok: true, data: null });
  refreshMock.mockReset();
});

afterEach(cleanup);

describe("CategoryDrawer — Add", () => {
  it("opens as a modal, titled, with focus on the first field and the next display order", () => {
    const { dialog } = renderDrawer({ mode: "create" });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(screen.getByRole("heading", { name: "Add New Category" })).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("Enter category name in English..."),
    );
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("5");
    expect((screen.getByRole("checkbox", { name: "Active" }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("toggles Active and submits through createCategoryAction", async () => {
    const { onClose } = renderDrawer({ mode: "create" });
    fireEvent.change(screen.getByPlaceholderText("Enter category name in English..."), {
      target: { value: "Necklaces" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter category name in Arabic..."), {
      target: { value: "قلائد" },
    });
    const active = screen.getByRole("checkbox", { name: "Active" }) as HTMLInputElement;
    fireEvent.click(active);
    expect(active.checked).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create Category" }));
    });

    expect(createCategoryActionMock).toHaveBeenCalledWith({
      name: { en: "Necklaces", ar: "قلائد" },
      description: null,
      displayOrder: 5,
      isActive: false,
    });
    expect(updateCategoryActionMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the drawer open and shows the server's error when creation fails", async () => {
    createCategoryActionMock.mockResolvedValue({
      ok: false,
      error: { code: "CONFLICT", message: "A category with this name already exists." },
    });
    const { onClose } = renderDrawer({ mode: "create" });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Create Category" }).closest("form")!);
    });
    expect(screen.getByRole("alert").textContent).toBe("A category with this name already exists.");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CategoryDrawer — Edit", () => {
  it("opens pre-filled with the category's existing values", () => {
    renderDrawer({ mode: "edit", category: BRACELETS });
    expect(screen.getByRole("heading", { name: "Edit Category" })).toBeTruthy();
    expect(
      (screen.getByPlaceholderText("Enter category name in English...") as HTMLInputElement).value,
    ).toBe("Bracelets");
    expect(
      (screen.getByPlaceholderText("Enter category name in Arabic...") as HTMLInputElement).value,
    ).toBe("أساور");
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("1");
    expect((screen.getByRole("checkbox", { name: "Active" }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("saves through the existing updateCategoryAction", async () => {
    const { onClose } = renderDrawer({ mode: "edit", category: BRACELETS });
    fireEvent.click(screen.getByRole("checkbox", { name: "Active" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    });
    expect(updateCategoryActionMock).toHaveBeenCalledWith({
      categoryId: "bracelets",
      name: { en: "Bracelets", ar: "أساور" },
      description: null,
      displayOrder: 1,
      isActive: false,
    });
    expect(createCategoryActionMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("CategoryDrawer — closing", () => {
  it("closes from the X, Cancel, Escape and a backdrop click — but not a click inside", () => {
    const { onClose, dialog } = renderDrawer({ mode: "create" });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent(dialog, new Event("cancel", { cancelable: true })); // what Escape dispatches
    expect(onClose).toHaveBeenCalledTimes(3);

    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 1000, y: 72, width: 400, height: 500 }),
    );
    fireEvent.click(dialog, { clientX: 200, clientY: 300 }); // on the backdrop
    expect(onClose).toHaveBeenCalledTimes(4);
    fireEvent.click(dialog, { clientX: 1100, clientY: 300 }); // inside the panel's box
    fireEvent.click(screen.getByRole("spinbutton")); // on a field
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it("returns focus to the control that opened it when it unmounts", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = renderDrawer({ mode: "create" });
    expect(document.activeElement).not.toBe(opener);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
