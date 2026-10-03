import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

/**
 * Admin Team redesign. The management rules are unchanged and enforced
 * server-side; these tests pin what the UI offers and that the existing action
 * flows (lookup → grant, promote, demote, remove-with-typed-email) still go
 * through the same actions with the same payloads. Role changes are made from
 * the role badge (when permitted); the three-dot menu keeps only "Remove
 * access". Every server action is mocked — no Firebase account, claim or
 * Firestore role is ever read or written.
 */

const lookupMock = vi.fn();
const grantMock = vi.fn();
const changeRoleMock = vi.fn();
const removeMock = vi.fn();
vi.mock("@/actions/admin/team.actions", () => ({
  lookupTeamAccountAction: (input: unknown) => lookupMock(input),
  grantAdminAction: (input: unknown) => grantMock(input),
  changeAdminRoleAction: (input: unknown) => changeRoleMock(input),
  removeAdminAction: (input: unknown) => removeMock(input),
}));
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const { TeamManager } = await import("@/components/admin/TeamManager");
type Props = Parameters<typeof TeamManager>[0];
type Row = Props["rows"][number];

const OWNER_ME: Row = {
  uid: "me",
  name: "Bilal Owner",
  email: "bilal@example.com",
  role: "OWNER",
  disabled: false,
  emailVerified: false,
  lastSignIn: "30 Sept 2026, 18:15",
};
const OTHER_OWNER: Row = { ...OWNER_ME, uid: "o2", name: "Sara Owner", email: "sara@example.com", emailVerified: true, lastSignIn: null };
const ADMIN_ONE: Row = {
  uid: "a1",
  name: "Adam Admin",
  email: "adam@example.com",
  role: "ADMIN",
  disabled: false,
  emailVerified: true,
  lastSignIn: "1 Oct 2026, 09:00",
};
const ADMIN_DISABLED: Row = { ...ADMIN_ONE, uid: "a2", name: "Dina Disabled", email: "dina@example.com", disabled: true };

const BASE: Props = {
  rows: [OWNER_ME, OTHER_OWNER, ADMIN_ONE, ADMIN_DISABLED],
  viewerUid: "me",
  canManage: true,
  ownerCount: 2,
};

function renderTeam(props: Partial<Props> = {}, locale: "en" | "ar" = "en") {
  const messages = locale === "ar" ? ar : en;
  return render(
    <div dir={locale === "ar" ? "rtl" : "ltr"}>
      <NextIntlClientProvider locale={locale} messages={{ AdminTeam: messages.AdminTeam }}>
        <TeamManager {...BASE} {...props} />
      </NextIntlClientProvider>
    </div>,
  );
}

/** Opens a member's three-dot menu (the table and the phone card both render in jsdom, so take the first). */
function openMenu(name: string) {
  fireEvent.click(screen.getAllByRole("button", { name: `Actions for ${name}` })[0]!);
  return screen.getByRole("menu");
}

/** A member's clickable role badge, or null when it is only a plain badge (the viewer may not change that role). */
function roleBadge(name: string) {
  return screen.queryAllByRole("button", { name: new RegExp(`^Change role for ${name} `) })[0] ?? null;
}

/** Opens a member's role badge menu — the one-item "Change to …" popup. */
function openRoleMenu(name: string) {
  fireEvent.click(roleBadge(name)!);
  return screen.getByRole("menu");
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
});

beforeEach(() => {
  lookupMock.mockReset();
  grantMock.mockReset().mockResolvedValue({ ok: true, data: { email: "new@example.com" } });
  changeRoleMock.mockReset().mockResolvedValue({ ok: true, data: { email: "adam@example.com" } });
  removeMock.mockReset().mockResolvedValue({ ok: true, data: { email: "adam@example.com" } });
  refreshMock.mockReset();
});

afterEach(cleanup);

describe("layout", () => {
  it("shows the Add an admin card and the Team Members card with the real member count", () => {
    renderTeam();
    expect(screen.getByRole("heading", { name: "Add an admin" })).toBeTruthy();
    expect(screen.getByLabelText("Their account email")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Find account" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Team Members" })).toBeTruthy();
    expect(screen.getByText("4 members")).toBeTruthy();
  });

  it("uses the singular for a single member", () => {
    renderTeam({ rows: [OWNER_ME], ownerCount: 1 });
    expect(screen.getByText("1 member")).toBeTruthy();
  });

  it("lists every real member with name, email, role, status and last sign-in — nothing invented", () => {
    renderTeam();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Member", "Role", "Status", "Last sign-in", "Actions",
    ]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);

    const me = within(rows[0]!);
    expect(me.getByText("Bilal Owner")).toBeTruthy();
    expect(me.getByText("bilal@example.com")).toBeTruthy();
    expect(me.getByText("You")).toBeTruthy();
    expect(me.getByText("Owner")).toBeTruthy();
    expect(me.getByText("Active")).toBeTruthy();
    expect(me.getByText("Email not verified")).toBeTruthy();
    expect(me.getByText("30 Sept 2026, 18:15")).toBeTruthy();
    expect(me.getByText("B")).toBeTruthy(); // initial avatar

    // A member who has never signed in shows "Never" — not a made-up date.
    expect(within(rows[1]!).getByText("Never")).toBeTruthy();
    expect(within(rows[1]!).getByText("Email verified")).toBeTruthy();
    // Only the signed-in member gets the "You" pill.
    expect(within(table).getAllByText("You")).toHaveLength(1);
    // A disabled account reads Disabled.
    expect(within(rows[3]!).getByText("Disabled")).toBeTruthy();
  });

  it("filters members client-side by name or email", () => {
    renderTeam();
    const box = screen.getByRole("searchbox", { name: "Search team members" });
    fireEvent.change(box, { target: { value: "adam@" } });
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText("Adam Admin")).toBeTruthy();

    fireEvent.change(box, { target: { value: "zzz" } });
    expect(screen.getByText("No team members match your search.")).toBeTruthy();
    // The count pill stays the real total, and no action ran.
    expect(screen.getByText("4 members")).toBeTruthy();
    expect(changeRoleMock).not.toHaveBeenCalled();
  });
});

describe("who is offered which action", () => {
  it("offers nothing on the viewer's own row — no menu, and the role badge is not clickable (no self-role changes)", () => {
    renderTeam();
    expect(screen.queryByRole("button", { name: "Actions for Bilal Owner" })).toBeNull();
    expect(roleBadge("Bilal Owner")).toBeNull();
    // It is still shown, just as a plain badge.
    expect(within(within(screen.getByRole("table")).getAllByRole("row")[1]!).getByText("Owner")).toBeTruthy();
  });

  it("an admin's role badge is clickable and offers only 'Change to Owner'", () => {
    renderTeam();
    const menu = openRoleMenu("Adam Admin");
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Change to Owner"]);
  });

  it("another owner's role badge is clickable and offers only 'Change to Admin'", () => {
    renderTeam();
    const menu = openRoleMenu("Sara Owner");
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Change to Admin"]);
  });

  it("the three-dot menu no longer duplicates the role change — it keeps only 'Remove access'", () => {
    renderTeam();
    for (const name of ["Adam Admin", "Sara Owner"]) {
      const menu = openMenu(name);
      expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Remove access"]);
      fireEvent.keyDown(menu, { key: "Escape" });
    }
  });

  it("a disabled account follows the same rules as before (still listed, same actions)", () => {
    renderTeam();
    expect(within(openRoleMenu("Dina Disabled")).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Change to Owner"]);
  });

  it("the only owner gets neither a clickable badge nor any action — just 'Last owner'", () => {
    renderTeam({ rows: [OWNER_ME, { ...OTHER_OWNER }], ownerCount: 1 });
    expect(screen.getAllByText("Last owner").length).toBeGreaterThan(0);
    expect(roleBadge("Sara Owner")).toBeNull();
    expect(screen.queryByRole("button", { name: "Actions for Sara Owner" })).toBeNull();
  });

  it("a read-only admin sees no Add card, no Actions column, no menus and no clickable role badges — only the notice", () => {
    renderTeam({ canManage: false, viewerUid: "a1" });
    expect(screen.queryByRole("heading", { name: "Add an admin" })).toBeNull();
    expect(screen.queryByLabelText("Their account email")).toBeNull();
    expect(screen.getByRole("note").textContent).toBe(en.AdminTeam.readOnly);
    expect(within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Member", "Role", "Status", "Last sign-in",
    ]);
    expect(screen.queryAllByRole("button", { name: /^Actions for / })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /^Change role for / })).toHaveLength(0);
    // The list itself is still visible to them, with plain role badges.
    expect(screen.getAllByText("Adam Admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Owner").length).toBeGreaterThan(0);
  });

  it("never offers to create a user or set a password", () => {
    renderTeam();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /create (account|user)/i })).toBeNull();
  });
});

describe("role badge", () => {
  it("is announced as a button that opens a menu, naming the member and their current role", () => {
    renderTeam();
    const badge = roleBadge("Adam Admin")!;
    expect(badge.getAttribute("aria-label")).toBe("Change role for Adam Admin — currently Admin");
    expect(badge.getAttribute("aria-haspopup")).toBe("menu");
    expect(badge.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(badge);
    expect(badge.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps the badge's own look: same label and icon, with only a pointer cursor and focus ring added", () => {
    renderTeam();
    const badge = roleBadge("Adam Admin")!;
    expect(badge.textContent).toBe("Admin");
    expect(badge.querySelector("svg")).toBeTruthy();
    expect(badge.className).toContain("cursor-pointer");
    // A non-interactive badge (own row) carries the same label and icon but no pointer cursor.
    const plain = within(within(screen.getByRole("table")).getAllByRole("row")[1]!).getByText("Owner");
    expect(plain.className).not.toContain("cursor-pointer");
    expect(plain.querySelector("svg")).toBeTruthy();
  });

  it("opens from the keyboard (ArrowDown), lands on the item, and Escape returns focus to the badge", () => {
    renderTeam();
    const badge = roleBadge("Adam Admin")!;
    badge.focus();
    fireEvent.keyDown(badge, { key: "ArrowDown" });
    const menu = screen.getByRole("menu");
    expect(document.activeElement).toBe(within(menu).getByRole("menuitem", { name: "Change to Owner" }));
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(badge);
  });

  it("choosing the item opens the confirmation only — nothing changes until it is confirmed", () => {
    renderTeam();
    fireEvent.click(within(openRoleMenu("Adam Admin")).getByRole("menuitem", { name: "Change to Owner" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(changeRoleMock).not.toHaveBeenCalled();
  });
});

describe("existing action flows (unchanged)", () => {
  it("promote (from the role badge): confirm dialog → changeAdminRoleAction({ uid, role: 'OWNER' })", async () => {
    renderTeam();
    fireEvent.click(within(openRoleMenu("Adam Admin")).getByRole("menuitem", { name: "Change to Owner" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("heading", { name: "Make this person an owner?" })).toBeTruthy();
    expect(changeRoleMock).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Make owner" }));
    });
    expect(changeRoleMock).toHaveBeenCalledWith({ uid: "a1", role: "OWNER" });
    expect(refreshMock).toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("adam@example.com is now an owner.");
  });

  it("demote (from the role badge): changeAdminRoleAction({ uid, role: 'ADMIN' })", async () => {
    renderTeam();
    fireEvent.click(within(openRoleMenu("Sara Owner")).getByRole("menuitem", { name: "Change to Admin" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Make admin" }));
    });
    expect(changeRoleMock).toHaveBeenCalledWith({ uid: "o2", role: "ADMIN" });
  });

  it("remove: the confirm button stays disabled until the member's email is typed exactly, then calls removeAdminAction", async () => {
    renderTeam();
    fireEvent.click(within(openMenu("Adam Admin")).getByRole("menuitem", { name: "Remove access" }));
    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Remove access" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    const input = within(dialog).getByLabelText("Type their email to confirm");
    fireEvent.change(input, { target: { value: "someone-else@example.com" } });
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(removeMock).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "ADAM@example.com" } }); // case-insensitive, as before
    expect(confirm.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(removeMock).toHaveBeenCalledWith({ uid: "a1", confirmEmail: "ADAM@example.com" });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("cancel closes the confirmation without calling anything", () => {
    renderTeam();
    fireEvent.click(within(openRoleMenu("Adam Admin")).getByRole("menuitem", { name: "Change to Owner" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(changeRoleMock).not.toHaveBeenCalled();
  });

  it("shows the server's rejection (e.g. last owner) in the dialog and does not refresh", async () => {
    changeRoleMock.mockResolvedValue({ ok: false, error: { code: "LAST_OWNER", message: "x" } });
    renderTeam();
    fireEvent.click(within(openRoleMenu("Sara Owner")).getByRole("menuitem", { name: "Change to Admin" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Make admin" }));
    });
    expect(within(screen.getByRole("alertdialog")).getByText(en.AdminTeam.errors.LAST_OWNER)).toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("lookup → found → Make admin → grantAdminAction({ email })", async () => {
    lookupMock.mockResolvedValue({ ok: true, data: { uid: "n1", name: "New Person", email: "new@example.com", role: "CUSTOMER", disabled: false } });
    renderTeam();
    fireEvent.change(screen.getByLabelText("Their account email"), { target: { value: "new@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Find account" }));
    });
    expect(lookupMock).toHaveBeenCalledWith({ email: "new@example.com" });
    expect(screen.getByText("Account found")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Make admin" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Give admin access" }));
    });
    expect(grantMock).toHaveBeenCalledWith({ email: "new@example.com" });
  });

  it("an account that is already staff or disabled is shown with the reason and no grant button", async () => {
    lookupMock.mockResolvedValueOnce({ ok: true, data: { uid: "a1", name: "Adam Admin", email: "adam@example.com", role: "ADMIN", disabled: false } });
    renderTeam();
    fireEvent.change(screen.getByLabelText("Their account email"), { target: { value: "adam@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Find account" }));
    });
    expect(screen.getByText("This account is already on the team as Admin.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Make admin" })).toBeNull();

    lookupMock.mockResolvedValueOnce({ ok: true, data: { uid: "d1", name: "Dis Abled", email: "dis@example.com", role: "CUSTOMER", disabled: true } });
    fireEvent.change(screen.getByLabelText("Their account email"), { target: { value: "dis@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Find account" }));
    });
    expect(screen.getByText("This account is disabled and can't be given admin access.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Make admin" })).toBeNull();
  });

  it("shows the lookup error for an unknown email", async () => {
    lookupMock.mockResolvedValue({ ok: false, error: { code: "NOT_FOUND", message: "x" } });
    renderTeam();
    fireEvent.change(screen.getByLabelText("Their account email"), { target: { value: "nobody@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Find account" }));
    });
    expect(screen.getByText(en.AdminTeam.errors.NOT_FOUND)).toBeTruthy();
    expect(grantMock).not.toHaveBeenCalled();
  });
});

describe("menu keyboard behavior", () => {
  it("Escape closes the three-dot menu and returns focus to its trigger", () => {
    renderTeam();
    const trigger = screen.getAllByRole("button", { name: "Actions for Adam Admin" })[0]!;
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("opens onto the first item and arrows move between items", () => {
    renderTeam();
    const trigger = screen.getAllByRole("button", { name: "Actions for Adam Admin" })[0]!;
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const menu = screen.getByRole("menu");
    const [first] = within(menu).getAllByRole("menuitem");
    expect(document.activeElement).toBe(first);
    // A one-item menu wraps to itself.
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(first);
  });
});

describe("Arabic / RTL", () => {
  it("renders localized chrome, the plural count and the real data, with no raw keys", () => {
    renderTeam({}, "ar");
    expect(screen.getByRole("heading", { name: ar.AdminTeam.add.title })).toBeTruthy();
    expect(screen.getByRole("heading", { name: ar.AdminTeam.members.title })).toBeTruthy();
    expect(screen.getByText("4 أعضاء")).toBeTruthy();
    expect(within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      ar.AdminTeam.columns.member, ar.AdminTeam.columns.role, ar.AdminTeam.columns.status, ar.AdminTeam.columns.lastSignIn, ar.AdminTeam.columns.actions,
    ]);
    expect(screen.getAllByText(ar.AdminTeam.roles.OWNER).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/AdminTeam\./);
    // Logical (RTL-safe) spacing only on this page's own markup.
    expect(document.body.innerHTML).not.toMatch(/class="[^"]*\b(?:pl|pr|ml|mr)-\d/);
  });

  it("uses the right Arabic plural forms", () => {
    renderTeam({ rows: [OWNER_ME], ownerCount: 1 }, "ar");
    expect(screen.getByText("عضو واحد")).toBeTruthy();
    cleanup();
    renderTeam({ rows: [OWNER_ME, ADMIN_ONE], ownerCount: 1 }, "ar");
    expect(screen.getByText("عضوان")).toBeTruthy();
  });

  it("the role badge works in Arabic: localized trigger name, one 'change' item, then the confirmation", () => {
    renderTeam({}, "ar");
    const badge = screen.getAllByRole("button", { name: /^تغيير دور Adam Admin/ })[0]!;
    expect(badge.getAttribute("aria-label")).toBe(`تغيير دور Adam Admin — الدور الحالي: ${ar.AdminTeam.roles.ADMIN}`);
    fireEvent.click(badge);
    const items = within(screen.getByRole("menu")).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual([ar.AdminTeam.actions.promote]);
    fireEvent.click(items[0]!);
    expect(within(screen.getByRole("alertdialog")).getByRole("heading", { name: ar.AdminTeam.confirm.promoteTitle })).toBeTruthy();
    expect(changeRoleMock).not.toHaveBeenCalled();
  });

  it("keeps the typed-email safeguard in Arabic", () => {
    renderTeam({}, "ar");
    fireEvent.click(screen.getAllByRole("button", { name: `إجراءات Adam Admin` })[0]!);
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: ar.AdminTeam.actions.remove }));
    const confirm = within(screen.getByRole("alertdialog")).getByRole("button", { name: ar.AdminTeam.confirm.removeConfirm }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });
});

describe("message parity", () => {
  const keys = (value: unknown, prefix = ""): string[] =>
    Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    );
  it("AdminTeam has the same keys in English and Arabic", () => {
    expect(keys(ar.AdminTeam).sort()).toEqual(keys(en.AdminTeam).sort());
  });
});
