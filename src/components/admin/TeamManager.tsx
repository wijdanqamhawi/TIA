"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, Crown, Mail, Search, ShieldCheck, UserMinus, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FormError } from "@/components/ui/FormError";
import { AdminRowMenu, type RowMenuItem } from "@/components/admin/AdminRowMenu";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { DRAWER_FIELD as FIELD } from "@/components/admin/AdminDrawer";
import {
  changeAdminRoleAction,
  grantAdminAction,
  lookupTeamAccountAction,
  removeAdminAction,
} from "@/actions/admin/team.actions";
import { isStaffRole, type StaffRole, type UserRole } from "@/lib/auth/roles";
import type { ActionResult } from "@/lib/validation/common";

export type TeamRow = {
  uid: string;
  name: string;
  email: string;
  role: StaffRole;
  disabled: boolean;
  emailVerified: boolean;
  /** Pre-formatted on the server in the admin language. */
  lastSignIn: string | null;
};

type FoundAccount = { uid: string; name: string; email: string; role: UserRole; disabled: boolean };

type Pending =
  | { kind: "GRANT"; email: string }
  | { kind: "PROMOTE" | "DEMOTE" | "REVOKE"; row: TeamRow };

const KNOWN_ERRORS = new Set([
  "FORBIDDEN",
  "SELF_CHANGE",
  "NO_CHANGE",
  "ACCOUNT_DISABLED",
  "LAST_OWNER",
  "NOT_FOUND",
  "BUSY",
  "CONFIRMATION_MISMATCH",
  "VALIDATION_ERROR",
]);

const CARD =
  "rounded-[10px] border border-brand-gold/[0.16] bg-white shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)]";
const ICON_TILE = "grid shrink-0 place-items-center rounded-xl bg-brand-gold/[0.12] text-brand-gold";
const NAVY_BUTTON =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand-burgundy px-5 text-[12px] font-semibold uppercase tracking-[0.1em] text-text-on-dark transition-colors hover:bg-brand-burgundy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 rtl:text-[13.5px] rtl:normal-case rtl:tracking-normal";

/** Emails are always Latin, so they keep LTR order inside Arabic text. */
function Email({ value }: { value: string }) {
  return (
    <bdi dir="ltr" className="break-all">
      {value}
    </bdi>
  );
}

function Avatar({ name, email }: { name: string; email: string }) {
  const initial = Array.from((name.trim() || email.trim()))[0]?.toUpperCase() ?? "?";
  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-gold/[0.18] font-display text-[17px] text-[#7f642c]"
    >
      {initial}
    </span>
  );
}

const PILL =
  "inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[11.5px] font-medium uppercase tracking-[0.08em] rtl:text-[12.5px] rtl:normal-case rtl:tracking-normal";

/**
 * What a permitted role badge offers: the single role change that is valid for
 * this member, opened from the badge itself.
 */
type RoleChange = { triggerLabel: string; menuLabel: string; itemLabel: string; onSelect: () => void };

/**
 * The role badge. Looks the same whether or not it is interactive; when the
 * viewer may change this member's role (`change` given) the badge itself is the
 * trigger of a one-item menu — "Change to Owner" / "Change to Admin" — with a
 * pointer cursor and a focus ring added, and nothing else visually different.
 */
function RoleBadge({ role, label, change }: { role: StaffRole; label: string; change?: RoleChange }) {
  const content =
    role === "OWNER" ? (
      <>
        <Crown aria-hidden="true" className="size-3.5 stroke-[1.8] text-brand-gold" />
        {label}
      </>
    ) : (
      <>
        <ShieldCheck aria-hidden="true" className="size-3.5 stroke-[1.8] text-text-secondary" />
        {label}
      </>
    );
  const tone =
    role === "OWNER"
      ? "bg-brand-burgundy text-text-on-dark"
      : "border border-brand-burgundy/[0.1] bg-[#f2f3f5] text-brand-burgundy";

  if (!change) return <span className={cn(PILL, tone)}>{content}</span>;
  return (
    <AdminRowMenu
      label={change.triggerLabel}
      menuLabel={change.menuLabel}
      align="start"
      triggerClassName={cn(
        PILL,
        tone,
        "cursor-pointer outline-none ring-offset-1 transition-shadow hover:ring-1 hover:ring-brand-gold/60 focus-visible:ring-2 focus-visible:ring-brand-gold",
      )}
      items={[
        {
          key: "change-role",
          label: change.itemLabel,
          icon: role === "OWNER" ? ShieldCheck : Crown,
          onSelect: change.onSelect,
        },
      ]}
    >
      {content}
    </AdminRowMenu>
  );
}

function StatusPill({ disabled, label }: { disabled: boolean; label: string }) {
  return (
    <span className={cn(PILL, disabled ? "bg-[#f6ecea] text-[#8f4a43]" : "bg-[#e6f0e9] text-[#2f6844]")}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", disabled ? "bg-[#8f4a43]" : "bg-[#2f6844]")} />
      {label}
    </span>
  );
}

export function TeamManager({
  rows,
  viewerUid,
  canManage,
  ownerCount,
}: {
  rows: TeamRow[];
  viewerUid: string;
  canManage: boolean;
  ownerCount: number;
}) {
  const t = useTranslations("AdminTeam");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [found, setFound] = useState<FoundAccount | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [pending, setPending] = useState<Pending | null>(null);
  const [typedEmail, setTypedEmail] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  function errorText(code: string) {
    return t(`errors.${KNOWN_ERRORS.has(code) ? code : "UNKNOWN"}`);
  }

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    setFound(null);
    setNotice(null);
    startTransition(async () => {
      const result = await lookupTeamAccountAction({ email });
      if (!result.ok) {
        setLookupError(errorText(result.error.code));
        return;
      }
      setFound(result.data);
    });
  }

  function openDialog(next: Pending) {
    setPending(next);
    setTypedEmail("");
    setDialogError(null);
    setNotice(null);
  }

  function closeDialog() {
    if (isPending) return;
    setPending(null);
  }

  function handleConfirm() {
    if (!pending) return;
    setDialogError(null);
    startTransition(async () => {
      let result: ActionResult<{ email: string }>;
      if (pending.kind === "GRANT") result = await grantAdminAction({ email: pending.email });
      else if (pending.kind === "REVOKE") result = await removeAdminAction({ uid: pending.row.uid, confirmEmail: typedEmail });
      else {
        result = await changeAdminRoleAction({
          uid: pending.row.uid,
          role: pending.kind === "PROMOTE" ? "OWNER" : "ADMIN",
        });
      }

      if (!result.ok) {
        setDialogError(errorText(result.error.code));
        return;
      }
      setNotice(t(`success.${pending.kind}`, { email: result.data.email }));
      setPending(null);
      if (pending.kind === "GRANT") {
        setFound(null);
        setEmail("");
      }
      router.refresh();
    });
  }

  const targetEmail = pending ? (pending.kind === "GRANT" ? pending.email : pending.row.email) : "";
  const dialogCopy = pending
    ? {
        GRANT: { title: t("confirm.grantTitle"), body: t("confirm.grantBody", { email: targetEmail }), cta: t("confirm.grantConfirm") },
        PROMOTE: { title: t("confirm.promoteTitle"), body: t("confirm.promoteBody", { email: targetEmail }), cta: t("confirm.promoteConfirm") },
        DEMOTE: { title: t("confirm.demoteTitle"), body: t("confirm.demoteBody", { email: targetEmail }), cta: t("confirm.demoteConfirm") },
        REVOKE: { title: t("confirm.removeTitle"), body: t("confirm.removeBody", { email: targetEmail }), cta: t("confirm.removeConfirm") },
      }[pending.kind]
    : null;
  const needsTypedEmail = pending?.kind === "REVOKE";
  const typedMatches = typedEmail.trim().toLowerCase() === targetEmail.toLowerCase();

  /**
   * Whether this owner may act on a member at all — exactly the existing rules:
   * never for a read-only viewer, never on the viewer's own row (no self-role
   * changes), and never on the only owner (last-owner protection). The server
   * re-authorizes every change regardless of what the UI offers.
   */
  const isLastOwner = (row: TeamRow) => row.role === "OWNER" && ownerCount <= 1;
  const canActOn = (row: TeamRow) => canManage && row.uid !== viewerUid && !isLastOwner(row);

  /** The role change this viewer may make on a member (opened from the role badge), if any. */
  function roleChange(row: TeamRow): RoleChange | undefined {
    if (!canActOn(row)) return undefined;
    const promote = row.role === "ADMIN";
    return {
      triggerLabel: t("members.roleChangeLabel", { name: row.name, role: t(`roles.${row.role}`) }),
      menuLabel: t("members.roleMenuTitle"),
      itemLabel: t(promote ? "actions.promote" : "actions.demote"),
      onSelect: () => openDialog({ kind: promote ? "PROMOTE" : "DEMOTE", row }),
    };
  }

  /**
   * What a member's actions cell holds: nothing for a read-only viewer or the
   * viewer's own row; a "Last owner" note for the only owner; otherwise the
   * three-dot menu with the remaining action (role changes live on the badge).
   */
  function rowActions(row: TeamRow) {
    if (!canManage || row.uid === viewerUid) return null;
    if (isLastOwner(row)) {
      return <span className="text-[12.5px] text-text-secondary">{t("lastOwnerHint")}</span>;
    }
    const items: RowMenuItem[] = [
      { key: "remove", label: t("actions.remove"), icon: UserMinus, tone: "danger", onSelect: () => openDialog({ kind: "REVOKE", row }) },
    ];
    return <AdminRowMenu label={t("members.menuLabel", { name: row.name })} menuLabel={t("members.menuTitle")} items={items} />;
  }

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? rows.filter((row) => row.name.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle))
    : rows;

  const memberCell = (row: TeamRow) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={row.name} email={row.email} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] font-medium text-brand-burgundy">
          <span className="truncate">{row.name}</span>
          {row.uid === viewerUid ? (
            <span className="rounded-full bg-[#f2f3f5] px-2 py-0.5 text-[11.5px] font-normal text-text-secondary">{t("you")}</span>
          ) : null}
        </p>
        <p className="text-[13px] text-text-secondary">
          <Email value={row.email} />
        </p>
      </div>
    </div>
  );

  const statusCell = (row: TeamRow) => (
    <div className="flex flex-col items-start gap-1">
      <StatusPill disabled={row.disabled} label={row.disabled ? t("status.disabled") : t("status.active")} />
      <span className="text-[12.5px] text-text-secondary">
        {row.emailVerified ? t("status.verified") : t("status.unverified")}
      </span>
    </div>
  );

  const lastSignInCell = (row: TeamRow) => (
    <span className="inline-flex items-center gap-2 text-[13.5px] text-brand-burgundy">
      <CalendarDays aria-hidden="true" className="size-4 shrink-0 stroke-[1.6] text-text-secondary" />
      {row.lastSignIn ? <bdi>{row.lastSignIn}</bdi> : t("never")}
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      {notice ? (
        <p role="status" className="rounded-lg bg-[#e6f0e9] px-4 py-3 text-[13.5px] text-[#2f6844]">
          {notice}
        </p>
      ) : null}

      {canManage ? (
        <section className={cn(CARD, "p-4 sm:p-5")} aria-labelledby="team-add-title">
          <div className="flex items-start gap-3.5">
            <span aria-hidden="true" className={cn(ICON_TILE, "size-12")}>
              <UserPlus className="size-[22px] stroke-[1.6]" />
            </span>
            <div className="min-w-0">
              <h2 id="team-add-title" className="font-display text-[22px] leading-tight text-brand-burgundy">
                {t("add.title")}
              </h2>
              <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-text-secondary">{t("add.help")}</p>
            </div>
          </div>
          <form onSubmit={handleLookup} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[13.5px] font-medium text-brand-burgundy">{t("add.emailLabel")}</span>
              <span className="relative block">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 stroke-[1.7] text-text-secondary"
                />
                <input
                  type="email"
                  dir="ltr"
                  required
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("add.emailPlaceholder")}
                  className={cn(FIELD, "ps-10 text-start")}
                />
              </span>
            </label>
            <button type="submit" disabled={isPending || !email.trim()} className={NAVY_BUTTON}>
              <Search aria-hidden="true" className="size-4 stroke-[2]" />
              {isPending && !pending ? t("add.finding") : t("add.find")}
            </button>
          </form>
          {lookupError ? (
            <div className="mt-3">
              <FormError message={lookupError} />
            </div>
          ) : null}
          {found ? (
            <div className="mt-4 flex flex-col gap-3 rounded-lg bg-[#f2f3f5] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3 text-[13.5px]">
                <Avatar name={found.name} email={found.email} />
                <div className="min-w-0">
                  <p className="font-medium text-brand-burgundy">{t("add.found")}</p>
                  <p className="text-text-secondary">
                    {found.name} · <Email value={found.email} />
                  </p>
                  {isStaffRole(found.role) ? (
                    <p className="mt-1 text-text-secondary">{t("add.alreadyStaff", { role: t(`roles.${found.role}`) })}</p>
                  ) : found.disabled ? (
                    <p className="mt-1 text-text-secondary">{t("add.disabled")}</p>
                  ) : null}
                </div>
              </div>
              {!isStaffRole(found.role) && !found.disabled ? (
                <button type="button" onClick={() => openDialog({ kind: "GRANT", email: found.email })} className={NAVY_BUTTON}>
                  {t("add.grant")}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : (
        <p role="note" className="rounded-lg bg-[#f2f3f5] px-4 py-3 text-[13.5px] text-text-secondary">
          {t("readOnly")}
        </p>
      )}

      <section className={CARD} aria-labelledby="team-members-title">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <span aria-hidden="true" className={cn(ICON_TILE, "size-11")}>
              <Users className="size-5 stroke-[1.6]" />
            </span>
            <h2 id="team-members-title" className="font-display text-[20px] leading-tight text-brand-burgundy">
              {t("members.title")}
            </h2>
            <span className="inline-flex h-[26px] items-center rounded-full bg-[#f2f3f5] px-3 text-[12.5px] lining-nums text-text-secondary">
              {t("members.count", { count: rows.length })}
            </span>
          </div>
          <label className="relative block w-full sm:w-[260px]">
            <span className="sr-only">{t("members.searchLabel")}</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 stroke-[1.7] text-text-secondary"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("members.searchPlaceholder")}
              className={cn(FIELD, "ps-10")}
            />
          </label>
        </div>

        {visible.length === 0 ? (
          <p className="border-t border-brand-burgundy/[0.06] px-6 py-9 text-center text-[14px] text-text-secondary">
            {rows.length === 0 ? t("empty") : t("members.noMatch")}
          </p>
        ) : (
          <>
            {/* Desktop table (md+) */}
            <div className="hidden px-4 pb-4 sm:px-5 md:block">
              <table className="w-full border-collapse text-start">
                <thead>
                  <tr className="h-[42px] bg-[#f2f3f5] text-[13px] text-brand-burgundy">
                    {(["member", "role", "status", "lastSignIn"] as const).map((key) => (
                      <th
                        key={key}
                        scope="col"
                        className="whitespace-nowrap px-4 text-start font-medium first:rounded-s-lg first:ps-5 last:rounded-e-lg"
                      >
                        {t(`columns.${key}`)}
                      </th>
                    ))}
                    {canManage ? (
                      <th scope="col" className="whitespace-nowrap px-4 pe-5 text-end font-medium last:rounded-e-lg">
                        {t("columns.actions")}
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.uid} className="border-b border-brand-burgundy/[0.06] last:border-b-0">
                      <td className="px-4 py-3 ps-5">{memberCell(row)}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={row.role} label={t(`roles.${row.role}`)} change={roleChange(row)} />
                      </td>
                      <td className="px-4 py-3">{statusCell(row)}</td>
                      <td className="px-4 py-3">{lastSignInCell(row)}</td>
                      {canManage ? <td className="px-4 py-3 pe-5 text-end">{rowActions(row)}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card list (below md) */}
            <ul className="flex flex-col gap-2.5 px-4 pb-4 md:hidden">
              {visible.map((row) => (
                <li
                  key={row.uid}
                  data-testid="admin-row"
                  className="flex flex-col gap-3 rounded-lg border border-brand-burgundy/[0.08] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    {memberCell(row)}
                    <div className="shrink-0">{canManage ? rowActions(row) : null}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <RoleBadge role={row.role} label={t(`roles.${row.role}`)} change={roleChange(row)} />
                    {statusCell(row)}
                  </div>
                  {lastSignInCell(row)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {pending && dialogCopy ? (
        <ConfirmDialog
          titleId="team-confirm-title"
          title={dialogCopy.title}
          description={dialogCopy.body}
          cancelLabel={t("confirm.cancel")}
          confirmLabel={isPending ? t("confirm.working") : dialogCopy.cta}
          tone={pending.kind === "REVOKE" ? "danger" : "default"}
          pending={isPending}
          confirmDisabled={needsTypedEmail && !typedMatches}
          error={dialogError}
          onCancel={closeDialog}
          onConfirm={handleConfirm}
        >
          {needsTypedEmail ? (
            <label className="mt-2 flex flex-col gap-1.5">
              <span className="text-[13.5px] font-medium text-brand-burgundy">{t("confirm.removeTypeLabel")}</span>
              <input
                type="email"
                dir="ltr"
                autoComplete="off"
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                placeholder={targetEmail}
                className={cn(FIELD, "text-start")}
              />
            </label>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
