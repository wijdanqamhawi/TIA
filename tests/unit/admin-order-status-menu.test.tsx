import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { ORDER_STATUSES, type OrderStatus } from "@/types/order";
import {
  getAllowedNextStatuses,
  isValidOrderStatusTransition,
} from "@/lib/domain/orders/order-status-transitions";
import {
  applyOrderStatusToCounts,
  type OrderSummaryCounts,
} from "@/lib/domain/admin/order-filters";

/**
 * The inline status change in Admin > Orders: each row's status badge is a
 * button that opens a menu of the statuses the EXISTING order workflow allows
 * next, and saves through the existing protected action (stubbed here — nothing
 * touches Firebase). Final statuses ask for confirmation; everything updates
 * optimistically and rolls back on failure.
 */

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock, push: vi.fn() }) }));
const updateMock = vi.fn();
vi.mock("@/actions/admin/order.actions", () => ({
  updateOrderStatusAction: (input: unknown) => updateMock(input),
}));

const { AdminOrdersList } = await import("@/components/admin/AdminOrdersList");
type Props = Parameters<typeof AdminOrdersList>[0];

const ROW = (n: number, status: OrderStatus): Props["orders"][number] => ({
  id: `o${n}`,
  orderNumber: `ELR-20260930-000${n}`,
  customerName: `Customer ${n}`,
  customerEmail: `c${n}@example.com`,
  isGuest: false,
  createdAt: Date.UTC(2026, 8, 30, 10, n),
  total: 10000 * n,
  status,
});

// One order per status: o1 Pending … o6 Cancelled.
const ORDERS = ORDER_STATUSES.map((status, index) => ROW(index + 1, status));
const COUNTS: OrderSummaryCounts = { total: 6, pending: 1, inProgress: 3, delivered: 1 };

function renderList(props: Partial<Props> = {}, locale: "en" | "ar" = "en") {
  const messages = locale === "en" ? en : ar;
  const tree = (p: Partial<Props>) => (
    <NextIntlClientProvider locale={locale} messages={{ AdminOrders: messages.AdminOrders }}>
      <AdminOrdersList
        counts={COUNTS}
        orders={ORDERS}
        fetchedCount={ORDERS.length}
        totalCount={ORDERS.length}
        query=""
        status={null}
        {...p}
      />
    </NextIntlClientProvider>
  );
  const view = render(tree(props));
  return { ...view, update: (p: Partial<Props>) => view.rerender(tree({ ...props, ...p })) };
}

/** A row's status control in the desktop table (the card list repeats each order below `xl`). */
const tableRow = (n: number) =>
  screen
    .getAllByTestId("admin-row")
    .find((row) => row.tagName === "TR" && row.textContent?.includes(`ELR-20260930-000${n}`))!;
const pill = (n: number) => within(tableRow(n)).getByTestId("order-status-toggle");
const rowStatus = (n: number) =>
  tableRow(n).querySelector("[data-status]")!.getAttribute("data-status");
const menu = () => screen.getByRole("menu");
const choice = (label: string) => within(menu()).getByRole("menuitem", { name: label });
const confirmDialog = () => screen.getByRole("alertdialog");

/** The figure on a summary card, found by its label. */
function cardValue(label: string): string | undefined {
  for (const p of Array.from(document.querySelectorAll("p"))) {
    const value = p.nextElementSibling;
    if (p.textContent === label && value?.getAttribute("dir") === "ltr")
      return value.textContent ?? undefined;
  }
  return undefined;
}
const cards = () => [
  cardValue("Total Orders"),
  cardValue("Pending"),
  cardValue("In Progress"),
  cardValue("Delivered"),
];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
});
beforeEach(() => {
  refreshMock.mockReset();
  updateMock.mockReset().mockResolvedValue({ ok: true, data: null });
});
afterEach(cleanup);

describe("the status badge", () => {
  it("is a button for every order that can still change, and a plain badge for final statuses", () => {
    renderList();
    for (const n of [1, 2, 3, 4]) {
      const button = pill(n);
      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("aria-haspopup")).toBe("menu");
      expect(button.getAttribute("aria-expanded")).toBe("false");
    }
    for (const n of [5, 6]) {
      expect(within(tableRow(n)).queryByTestId("order-status-toggle")).toBeNull();
      expect(tableRow(n).querySelector("[data-status]")!.tagName).toBe("SPAN");
    }
  });

  it("names the current status and the action for screen readers", () => {
    renderList();
    expect(pill(2).getAttribute("aria-label")).toBe("Confirmed — Change order status");
    expect(pill(2).textContent).toContain("Confirmed");
  });
});

describe("the menu offers only what the existing workflow allows", () => {
  const LABEL: Record<OrderStatus, string> = {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    PREPARING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };
  // The existing rules, written out: Pending → Confirmed | Cancelled; Confirmed → Processing | Cancelled;
  // Processing → Shipped | Cancelled; Shipped → Delivered; Delivered and Cancelled are final.
  const EXPECTED: Record<string, string[]> = {
    PENDING: ["Confirmed", "Cancelled"],
    CONFIRMED: ["Processing", "Cancelled"],
    PREPARING: ["Shipped", "Cancelled"],
    SHIPPED: ["Delivered"],
  };

  it.each(Object.entries(EXPECTED))(
    "from %s: exactly %j (and nothing else)",
    (status, expected) => {
      renderList();
      const n = ORDER_STATUSES.indexOf(status as OrderStatus) + 1;
      fireEvent.click(pill(n));
      const options = within(menu())
        .getAllByRole("menuitem")
        .filter((item) => item.getAttribute("aria-disabled") !== "true")
        .map((item) => item.textContent);
      expect(options).toEqual(expected);
      // …and it is the same set the state machine itself reports.
      expect(options).toEqual(getAllowedNextStatuses(status as OrderStatus).map((s) => LABEL[s]));
    },
  );

  it("never offers a transition the workflow forbids (no skipping, no going back, no leaving a final status)", () => {
    renderList();
    for (const from of ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED"] as OrderStatus[]) {
      const n = ORDER_STATUSES.indexOf(from) + 1;
      fireEvent.click(pill(n));
      const offered = within(menu())
        .getAllByRole("menuitem")
        .filter((item) => item.getAttribute("aria-disabled") !== "true")
        .map((item) => item.getAttribute("data-status-option"));
      for (const to of ORDER_STATUSES) {
        expect(offered.includes(to), `${from} → ${to}`).toBe(
          isValidOrderStatusTransition(from, to),
        );
      }
      fireEvent.click(pill(n)); // close
    }
  });

  it("shows the current status first, marked and not selectable", () => {
    renderList();
    fireEvent.click(pill(2));
    const [current] = within(menu()).getAllByRole("menuitem");
    expect(current!.textContent).toBe("Confirmed");
    expect(current!.getAttribute("aria-current")).toBe("true");
    expect(current!.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(current!);
    expect(updateMock).not.toHaveBeenCalled();
    expect(rowStatus(2)).toBe("CONFIRMED");
  });
});

describe("where the menu opens", () => {
  it("lines up with the start edge of the badge in the table, and the end edge in the card list (so it never runs off-screen)", () => {
    renderList();
    fireEvent.click(pill(1));
    expect(menu().className).toContain("start-0");
    expect(menu().className).not.toContain("end-0");
    fireEvent.pointerDown(document.body);

    const card = screen.getAllByTestId("admin-row").find((row) => row.tagName === "LI")!;
    fireEvent.click(within(card).getByTestId("order-status-toggle"));
    expect(menu().className).toContain("end-0");
    expect(menu().className).not.toContain("start-0");
  });
});

describe("a valid, non-final change", () => {
  it("saves through the existing action, updates the badge at once, refreshes, and moves the cards", async () => {
    renderList();
    expect(cards()).toEqual(["6", "1", "3", "1"]);
    fireEvent.click(pill(1)); // Pending
    await act(async () => {
      fireEvent.click(choice("Confirmed"));
    });

    expect(screen.queryByRole("alertdialog")).toBeNull(); // not a final status: no confirmation
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({ orderId: "o1", status: "CONFIRMED" });
    expect(rowStatus(1)).toBe("CONFIRMED");
    expect(pill(1).textContent).toContain("Confirmed");
    // Pending 1 → 0, In Progress 3 → 4; the total is unchanged. No full page reload — just a refresh.
    expect(cards()).toEqual(["6", "0", "4", "1"]);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("moves an order between In Progress stages without changing the card figures", async () => {
    renderList();
    fireEvent.click(pill(3)); // Processing → Shipped
    await act(async () => {
      fireEvent.click(choice("Shipped"));
    });
    expect(updateMock).toHaveBeenCalledWith({ orderId: "o3", status: "SHIPPED" });
    expect(cards()).toEqual(["6", "1", "3", "1"]);
  });

  it("closes the menu once a status is chosen", async () => {
    renderList();
    fireEvent.click(pill(1));
    await act(async () => {
      fireEvent.click(choice("Confirmed"));
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("final statuses ask first", () => {
  it("Delivered: a confirmation appears, and nothing is saved until it is accepted", async () => {
    renderList();
    fireEvent.click(pill(4)); // Shipped
    fireEvent.click(choice("Delivered"));

    const dialog = confirmDialog();
    expect(within(dialog).getByRole("heading", { name: "Mark as delivered?" })).toBeTruthy();
    expect(
      within(dialog).getByText("The order will be marked Delivered. This can't be undone."),
    ).toBeTruthy();
    expect(updateMock).not.toHaveBeenCalled();
    expect(rowStatus(4)).toBe("SHIPPED");

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Mark Delivered" }));
    });
    expect(updateMock).toHaveBeenCalledWith({ orderId: "o4", status: "DELIVERED" });
    expect(rowStatus(4)).toBe("DELIVERED");
    // The badge is now final, so it stops being a button; In Progress 3 → 2, Delivered 1 → 2.
    expect(within(tableRow(4)).queryByTestId("order-status-toggle")).toBeNull();
    expect(cards()).toEqual(["6", "1", "2", "2"]);
  });

  it("Cancelled: the confirmation says stock is returned, and uses the destructive style", async () => {
    renderList();
    fireEvent.click(pill(1));
    fireEvent.click(choice("Cancelled"));
    const dialog = confirmDialog();
    expect(within(dialog).getByRole("heading", { name: "Cancel this order?" })).toBeTruthy();
    expect(within(dialog).getByText(/returned to stock/)).toBeTruthy();
    const action = within(dialog).getByRole("button", { name: "Cancel Order" });
    expect(action.className).toContain("#963a33");
    await act(async () => {
      fireEvent.click(action);
    });
    expect(updateMock).toHaveBeenCalledWith({ orderId: "o1", status: "CANCELLED" });
    expect(cards()).toEqual(["6", "0", "3", "1"]);
  });

  it("Go back changes nothing: no save, no refresh, the badge and cards stay as they were", () => {
    renderList();
    fireEvent.click(pill(1));
    fireEvent.click(choice("Cancelled"));
    fireEvent.click(within(confirmDialog()).getByRole("button", { name: "Go back" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(rowStatus(1)).toBe("PENDING");
    expect(cards()).toEqual(["6", "1", "3", "1"]);
  });

  it("the final-status rule comes from the workflow, not a hard-coded list", () => {
    const terminal = ORDER_STATUSES.filter((status) => getAllowedNextStatuses(status).length === 0);
    expect(terminal.sort()).toEqual(["CANCELLED", "DELIVERED"]);
    for (const status of terminal) {
      expect(en.AdminOrders.statusMenu.confirm).toHaveProperty(status);
      expect(ar.AdminOrders.statusMenu.confirm).toHaveProperty(status);
    }
  });
});

describe("saving state, double clicks and failure", () => {
  it("shows a spinner and ignores further clicks while saving — one request only", async () => {
    let finish!: (value: unknown) => void;
    updateMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderList();
    fireEvent.click(pill(1));
    await act(async () => {
      fireEvent.click(choice("Confirmed"));
    });

    expect(pill(1).getAttribute("aria-busy")).toBe("true");
    expect(pill(1).getAttribute("aria-disabled")).toBe("true");
    expect(pill(1).querySelector("svg.animate-spin")).toBeTruthy();
    fireEvent.click(pill(1));
    fireEvent.click(pill(1));
    expect(screen.queryByRole("menu")).toBeNull(); // the menu cannot be reopened mid-save
    expect(updateMock).toHaveBeenCalledTimes(1);

    await act(async () => finish({ ok: true, data: null }));
    expect(pill(1).getAttribute("aria-busy")).toBeNull();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("restores the previous status, the cards and shows the existing error when the server refuses", async () => {
    updateMock.mockResolvedValue({
      ok: false,
      error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." },
    });
    renderList();
    fireEvent.click(pill(1));
    await act(async () => {
      fireEvent.click(choice("Confirmed"));
    });
    expect(rowStatus(1)).toBe("PENDING");
    expect(cards()).toEqual(["6", "1", "3", "1"]);
    expect(screen.getByRole("alert").textContent).toBe(
      "You do not have permission to perform this action.",
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("an invalid transition rejected by the server (the order moved meanwhile) is rolled back and the list refreshed", async () => {
    updateMock.mockResolvedValue({
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message: "Cannot change status from CONFIRMED to CONFIRMED.",
      },
    });
    renderList();
    fireEvent.click(pill(1));
    await act(async () => {
      fireEvent.click(choice("Confirmed"));
    });
    expect(rowStatus(1)).toBe("PENDING");
    expect(screen.getByRole("alert").textContent).toContain("Cannot change status");
    expect(refreshMock).toHaveBeenCalledTimes(1); // resync with the order's real status
  });

  it("restores everything and shows a clear message if the request itself fails", async () => {
    updateMock.mockRejectedValue(new Error("network"));
    renderList();
    fireEvent.click(pill(2));
    await act(async () => {
      fireEvent.click(choice("Processing"));
    });
    expect(rowStatus(2)).toBe("CONFIRMED");
    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn't update the order status. Please try again.",
    );
  });

  it("takes the server's fresh data as the truth once the refresh arrives", async () => {
    const view = renderList();
    fireEvent.click(pill(1));
    await act(async () => {
      fireEvent.click(choice("Confirmed"));
    });
    // What the page hands back after router.refresh(): that order Confirmed, and the real aggregate counts.
    view.update({
      orders: ORDERS.map((o) => (o.id === "o1" ? { ...o, status: "CONFIRMED" as const } : o)),
      counts: { total: 6, pending: 0, inProgress: 4, delivered: 1 },
    });
    expect(rowStatus(1)).toBe("CONFIRMED");
    expect(cards()).toEqual(["6", "0", "4", "1"]);
  });
});

describe("keyboard and pointer", () => {
  it("ArrowDown opens the menu and focuses the first option; Escape closes it and returns focus to the badge", () => {
    renderList();
    const trigger = pill(1);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(menu()).toBeTruthy();
    const first = within(menu()).getByRole("menuitem", { name: "Confirmed" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(menu(), { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      within(menu()).getByRole("menuitem", { name: "Cancelled" }),
    );
    fireEvent.keyDown(menu(), { key: "ArrowDown" }); // wraps
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(menu(), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on a click outside and toggles with the badge", () => {
    renderList();
    fireEvent.click(pill(1));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(pill(1));
    fireEvent.click(pill(1));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("the top status filter is untouched and independent", () => {
  it("still offers All statuses plus the six real statuses, with the current filter selected", () => {
    renderList({ status: "PENDING", query: "sara" });
    const select = screen.getByRole("combobox", { name: "Status" }) as HTMLSelectElement;
    expect(select.name).toBe("status");
    expect(select.value).toBe("PENDING");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["", ...ORDER_STATUSES]);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("sara");
    expect(document.querySelector("form[role=search]")!.getAttribute("method")).toBe("get");
  });

  it("changing a row's status does not touch the filter form or its values", async () => {
    renderList({ status: "PENDING", query: "sara" });
    fireEvent.click(pill(1));
    await act(async () => {
      fireEvent.click(choice("Confirmed"));
    });
    expect((screen.getByRole("combobox", { name: "Status" }) as HTMLSelectElement).value).toBe(
      "PENDING",
    );
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("sara");
  });

  it("the filter's own status control is not the row menu: the two are separate controls", () => {
    renderList();
    expect(screen.getByRole("combobox", { name: "Status" }).tagName).toBe("SELECT");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Arabic", () => {
  it("labels the badge, menu, options and confirmation in Arabic with no raw keys", async () => {
    const { container } = renderList({}, "ar");
    expect(pill(1).getAttribute("aria-label")).toBe("قيد الانتظار — تغيير حالة الطلب");
    fireEvent.click(pill(1));
    expect(screen.getByRole("menu", { name: "تغيير الحالة" })).toBeTruthy();
    const items = within(menu())
      .getAllByRole("menuitem")
      .map((i) => i.textContent);
    expect(items).toEqual(["قيد الانتظار", "مؤكَّد", "ملغى"]);

    fireEvent.click(choice("ملغى"));
    const dialog = confirmDialog();
    expect(within(dialog).getByRole("heading", { name: "إلغاء هذا الطلب؟" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "رجوع" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "إلغاء الطلب" })).toBeTruthy();
    expect(container.textContent).not.toMatch(/AdminOrders|statusMenu\./);
    expect(dialog.textContent).not.toMatch(/AdminOrders|statusMenu\./);
  });

  it("has English and Arabic text for every status-menu key", () => {
    const keys = (o: Record<string, unknown>, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" && v !== null
          ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`],
      );
    expect(keys(ar.AdminOrders.statusMenu).sort()).toEqual(keys(en.AdminOrders.statusMenu).sort());
  });
});

describe("applyOrderStatusToCounts", () => {
  const base: OrderSummaryCounts = { total: 10, pending: 4, inProgress: 3, delivered: 2 };

  it("moves exactly the buckets an order leaves and enters; the total never moves", () => {
    expect(applyOrderStatusToCounts(base, "PENDING", "CONFIRMED")).toEqual({
      total: 10,
      pending: 3,
      inProgress: 4,
      delivered: 2,
    });
    expect(applyOrderStatusToCounts(base, "CONFIRMED", "PREPARING")).toEqual(base);
    expect(applyOrderStatusToCounts(base, "SHIPPED", "DELIVERED")).toEqual({
      total: 10,
      pending: 4,
      inProgress: 2,
      delivered: 3,
    });
    expect(applyOrderStatusToCounts(base, "PENDING", "CANCELLED")).toEqual({
      total: 10,
      pending: 3,
      inProgress: 3,
      delivered: 2,
    });
    expect(applyOrderStatusToCounts(base, "PREPARING", "CANCELLED")).toEqual({
      total: 10,
      pending: 4,
      inProgress: 2,
      delivered: 2,
    });
    expect(applyOrderStatusToCounts(base, "PENDING", "PENDING")).toBe(base);
  });

  it("every valid transition keeps the total and never drives a figure negative from a consistent start", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of getAllowedNextStatuses(from)) {
        const start: OrderSummaryCounts = {
          total: 9,
          pending: from === "PENDING" ? 1 : 0,
          inProgress: ["CONFIRMED", "PREPARING", "SHIPPED"].includes(from) ? 1 : 0,
          delivered: 0,
        };
        const next = applyOrderStatusToCounts(start, from, to);
        expect(next.total).toBe(9);
        expect(
          Math.min(next.pending, next.inProgress, next.delivered),
          `${from}→${to}`,
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
