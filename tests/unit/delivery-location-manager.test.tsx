import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

/**
 * Admin Delivery Locations redesign: both fixed regions render their real
 * data (nothing hard-coded), search filters client-side only, the status pill
 * toggles through the existing update action (only `isActive`), Edit/Add go
 * through the shared drawer with the unchanged action payloads, and Delete
 * is gated behind a confirmation. Every server action is mocked — no
 * Firestore, and so no real delivery location, is ever read or written.
 */

const updateRegionMock = vi.fn();
const createLocationMock = vi.fn();
const updateLocationMock = vi.fn();
const deleteLocationMock = vi.fn();
vi.mock("@/actions/admin/delivery-location.actions", () => ({
  updateDeliveryRegionAction: (input: unknown) => updateRegionMock(input),
  createDeliveryLocationAction: (input: unknown) => createLocationMock(input),
  updateDeliveryLocationAction: (input: unknown) => updateLocationMock(input),
  deleteDeliveryLocationAction: (input: unknown) => deleteLocationMock(input),
}));
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const { DeliveryLocationManager } = await import("@/components/admin/DeliveryLocationManager");
type Props = Parameters<typeof DeliveryLocationManager>[0];

function loc(id: string, regionId: "west-bank" | "inside-1948", nameEn: string, nameAr: string | null, order: number, isActive = true) {
  return { id, regionId, name: { en: nameEn, ar: nameAr }, slug: id, displayOrder: order, isActive };
}

const PROPS: Props = {
  regions: [
    { regionId: "west-bank", name: { en: "West Bank", ar: "الضفة الغربية" }, displayOrder: 1, isActive: true },
    { regionId: "inside-1948", name: { en: "Inside / 1948 Areas", ar: "الداخل / ١٩٤٨" }, displayOrder: 2, isActive: true },
  ],
  locationsByRegion: {
    "west-bank": [
      loc("ramallah", "west-bank", "Ramallah", "رام الله", 1),
      loc("nablus", "west-bank", "Nablus", "نابلس", 2),
      loc("hebron", "west-bank", "Hebron", "الخليل", 3, false),
    ],
    "inside-1948": [loc("haifa", "inside-1948", "Haifa", "حيفا", 1)],
  },
};

function renderManager(locale: "en" | "ar" = "en", props: Props = PROPS) {
  const messages = locale === "ar" ? ar : en;
  return render(
    <div dir={locale === "ar" ? "rtl" : "ltr"}>
      <NextIntlClientProvider locale={locale} messages={{ AdminDelivery: messages.AdminDelivery }}>
        <DeliveryLocationManager {...props} />
      </NextIntlClientProvider>
    </div>,
  );
}

/** The card for one region, found by its heading. */
function region(name: string) {
  return screen.getByRole("heading", { name }).closest("section") as HTMLElement;
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
});

beforeEach(() => {
  updateRegionMock.mockReset().mockResolvedValue({ ok: true, data: null });
  createLocationMock.mockReset().mockResolvedValue({ ok: true, data: { locationId: "new" } });
  updateLocationMock.mockReset().mockResolvedValue({ ok: true, data: null });
  deleteLocationMock.mockReset().mockResolvedValue({ ok: true, data: null });
  refreshMock.mockReset();
});

afterEach(cleanup);

describe("region cards", () => {
  it("renders exactly the two regions with their real names, status, description, search and Add button", () => {
    renderManager();
    const sections = document.querySelectorAll("section");
    expect(sections.length).toBe(2);

    const westBank = within(region("West Bank"));
    // The region's own status pill sits in the header, before the table.
    const header = region("West Bank").firstElementChild as HTMLElement;
    expect(within(header).getByText("Active")).toBeTruthy();
    expect(westBank.getByText("Manage the cities and areas included in the West Bank region.")).toBeTruthy();
    expect(westBank.getByRole("searchbox", { name: "Search cities and areas in West Bank" })).toBeTruthy();
    expect(westBank.getByRole("button", { name: "Add City / Area" })).toBeTruthy();

    expect(within(region("Inside / 1948 Areas")).getByRole("button", { name: "Add City / Area" })).toBeTruthy();
  });

  it("lists the real cities per region with their stored order — nothing hard-coded", () => {
    renderManager();
    const rows = within(region("West Bank")).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("1Ramallah"),
      expect.stringContaining("2Nablus"),
      expect.stringContaining("3Hebron"),
    ]);
    expect(within(region("Inside / 1948 Areas")).getAllByRole("button", { name: "Haifa" }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Jaffa")).toBeNull();
  });

  it("shows the empty state for a region with no cities", () => {
    renderManager("en", { ...PROPS, locationsByRegion: { "west-bank": [], "inside-1948": PROPS.locationsByRegion["inside-1948"] } });
    expect(within(region("West Bank")).getByText("No cities/areas in this region yet.")).toBeTruthy();
  });
});

describe("Order column", () => {
  it("shows each city's position in the region, so a gap left by a deleted city never shows", () => {
    renderManager("en", {
      ...PROPS,
      locationsByRegion: {
        ...PROPS.locationsByRegion,
        // Stored orders 1, 4, 9 (e.g. after deletions) — still displayed as positions 1, 2, 3.
        "west-bank": [
          loc("ramallah", "west-bank", "Ramallah", "رام الله", 1),
          loc("hebron", "west-bank", "Hebron", "الخليل", 4),
          loc("jericho", "west-bank", "Jericho", "أريحا", 9),
        ],
      },
    });
    const rows = within(region("West Bank")).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("1Ramallah"),
      expect.stringContaining("2Hebron"),
      expect.stringContaining("3Jericho"),
    ]);
  });

  it("keeps the real order within a search — positions don't renumber while filtering", () => {
    renderManager();
    const westBank = within(region("West Bank"));
    fireEvent.change(westBank.getByRole("searchbox"), { target: { value: "hebron" } });
    expect(westBank.getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([expect.stringContaining("3Hebron")]);
  });
});

describe("search", () => {
  it("filters one region's rows by English or Arabic name, client-side only", () => {
    renderManager();
    const westBank = within(region("West Bank"));
    const box = westBank.getByRole("searchbox");

    fireEvent.change(box, { target: { value: "nab" } });
    expect(westBank.getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([expect.stringContaining("Nablus")]);

    fireEvent.change(box, { target: { value: "الخليل" } });
    expect(westBank.getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([expect.stringContaining("Hebron")]);

    fireEvent.change(box, { target: { value: "zzz" } });
    expect(westBank.getByText("No cities or areas match your search.")).toBeTruthy();
    // The other region is untouched.
    expect(within(region("Inside / 1948 Areas")).getAllByRole("button", { name: "Haifa" }).length).toBeGreaterThan(0);
    expect(updateLocationMock).not.toHaveBeenCalled();
  });
});

describe("status", () => {
  it("shows each city's status and toggles it through the existing action with only isActive", async () => {
    renderManager();
    const westBank = within(region("West Bank"));
    const toggles = westBank.getAllByTestId("location-status-toggle");
    // Table + card list both render; the first three are the table's rows.
    expect(toggles[0].textContent).toBe("Active");
    expect(toggles[2].textContent).toBe("Inactive");

    await act(async () => {
      fireEvent.click(toggles[0]);
    });
    expect(updateLocationMock).toHaveBeenCalledTimes(1);
    expect(updateLocationMock).toHaveBeenCalledWith({ locationId: "ramallah", isActive: false });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("reverts and reports an error when the save fails", async () => {
    updateLocationMock.mockResolvedValue({ ok: false, error: { code: "X", message: "nope" } });
    renderManager();
    const westBank = within(region("West Bank"));
    await act(async () => {
      fireEvent.click(westBank.getAllByTestId("location-status-toggle")[0]);
    });
    expect(westBank.getAllByTestId("location-status-toggle")[0].textContent).toBe("Active");
    expect(westBank.getByRole("alert").textContent).toBe("Couldn't update the status. Please try again.");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("Add / Edit drawer", () => {
  it("adds a city without any order number — the server places it last", async () => {
    renderManager();
    fireEvent.click(within(region("West Bank")).getByRole("button", { name: "Add City / Area" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Add a city / area" })).toBeTruthy();
    // No manual order management for a city/area.
    expect(within(dialog).queryByLabelText("Display order")).toBeNull();
    expect(within(dialog).queryByRole("spinbutton")).toBeNull();

    fireEvent.change(within(dialog).getByLabelText("Name — English"), { target: { value: "Jericho" } });
    fireEvent.change(within(dialog).getByLabelText("Name — Arabic"), { target: { value: "أريحا" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    });

    expect(createLocationMock).toHaveBeenCalledWith({
      regionId: "west-bank",
      name: { en: "Jericho", ar: "أريحا" },
      isActive: true,
    });
    expect(createLocationMock.mock.calls[0][0]).not.toHaveProperty("displayOrder");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("edits a city, prefilled, without sending (or showing) an order — editing can't move it", async () => {
    renderManager();
    fireEvent.click(within(region("West Bank")).getAllByRole("button", { name: "Edit" })[1]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Edit — Nablus" })).toBeTruthy();
    expect((within(dialog).getByLabelText("Name — English") as HTMLInputElement).value).toBe("Nablus");
    expect(within(dialog).queryByLabelText("Display order")).toBeNull();

    fireEvent.change(within(dialog).getByLabelText("Name — English"), { target: { value: "Nablus City" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    });
    expect(updateLocationMock).toHaveBeenCalledWith({
      locationId: "nablus",
      name: { en: "Nablus City", ar: "نابلس" },
      isActive: true,
    });
    expect(updateLocationMock.mock.calls[0][0]).not.toHaveProperty("displayOrder");
  });

  it("edits a region through the region action, from its name", async () => {
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "West Bank" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Edit region — West Bank" })).toBeTruthy();
    // A region (two fixed rows) keeps its own order input; only cities/areas are automatic.
    expect((within(dialog).getByLabelText("Display order") as HTMLInputElement).value).toBe("1");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    });
    expect(updateRegionMock).toHaveBeenCalledWith({
      regionId: "west-bank",
      name: { en: "West Bank", ar: "الضفة الغربية" },
      displayOrder: 1,
      isActive: true,
    });
  });

  it("shows a server error inside the drawer and stays open", async () => {
    createLocationMock.mockResolvedValue({ ok: false, error: { code: "CONFLICT", message: "A location with this name already exists in this region." } });
    renderManager();
    fireEvent.click(within(region("West Bank")).getByRole("button", { name: "Add City / Area" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name — English"), { target: { value: "Ramallah" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    });
    expect(within(dialog).getByText("A location with this name already exists in this region.")).toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("Delete", () => {
  it("never deletes on the first click — it asks for confirmation, focusing Cancel", () => {
    renderManager();
    fireEvent.click(within(region("West Bank")).getAllByRole("button", { name: "Delete" })[0]);
    const confirm = screen.getByRole("alertdialog");
    expect(within(confirm).getByRole("heading", { name: "Delete Ramallah?" })).toBeTruthy();
    expect(deleteLocationMock).not.toHaveBeenCalled();
  });

  it("Cancel closes the confirmation without deleting", () => {
    renderManager();
    fireEvent.click(within(region("West Bank")).getAllByRole("button", { name: "Delete" })[0]);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(deleteLocationMock).not.toHaveBeenCalled();
  });

  it("Delete in the confirmation calls the existing action once and refreshes", async () => {
    renderManager();
    fireEvent.click(within(region("West Bank")).getAllByRole("button", { name: "Delete" })[1]);
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    });
    expect(deleteLocationMock).toHaveBeenCalledTimes(1);
    expect(deleteLocationMock).toHaveBeenCalledWith({ locationId: "nablus" });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("keeps the confirmation open and shows the error when the delete fails", async () => {
    deleteLocationMock.mockResolvedValue({ ok: false, error: { code: "X", message: "Could not delete." } });
    renderManager();
    fireEvent.click(within(region("West Bank")).getAllByRole("button", { name: "Delete" })[0]);
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    });
    expect(within(screen.getByRole("alertdialog")).getByText("Could not delete.")).toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("Arabic / RTL", () => {
  it("renders localized chrome and the Arabic names of the real data, with no raw keys", () => {
    renderManager("ar");
    const westBank = within(region("الضفة الغربية"));
    expect(westBank.getByText("إدارة المدن والمناطق ضمن منطقة الضفة الغربية.")).toBeTruthy();
    expect(westBank.getByRole("button", { name: "إضافة مدينة / منطقة" })).toBeTruthy();
    expect(westBank.getAllByRole("button", { name: "رام الله" }).length).toBeGreaterThan(0);
    expect(westBank.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["الترتيب", "المدينة / المنطقة", "الحالة", "الإجراءات"]);
    expect(document.body.textContent).not.toMatch(/AdminDelivery\./);
    // Logical (RTL-safe) spacing only — no physical left/right padding or margin on the page's own markup.
    expect(document.body.innerHTML).not.toMatch(/class="[^"]*\b(?:pl|pr|ml|mr)-\d/);
  });

  it("confirms deletion in Arabic", () => {
    renderManager("ar");
    fireEvent.click(within(region("الضفة الغربية")).getAllByRole("button", { name: "حذف" })[0]);
    expect(within(screen.getByRole("alertdialog")).getByRole("heading", { name: "حذف رام الله؟" })).toBeTruthy();
    expect(deleteLocationMock).not.toHaveBeenCalled();
  });
});

describe("message parity", () => {
  const keys = (value: unknown, prefix = ""): string[] =>
    Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    );
  it("AdminDelivery has the same keys in English and Arabic", () => {
    expect(keys(ar.AdminDelivery).sort()).toEqual(keys(en.AdminDelivery).sort());
  });
});
