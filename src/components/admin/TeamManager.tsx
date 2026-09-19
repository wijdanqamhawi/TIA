"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/admin/DataTable";
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

/** Emails are always Latin, so they keep LTR order inside Arabic text. */
function Email({ value }: { value: string }) {
  return (
    <bdi dir="ltr" className="break-all">
      {value}
    </bdi>
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

  function rowActions(row: TeamRow) {
    if (!canManage || row.uid === viewerUid) return null;
    const isLastOwner = row.role === "OWNER" && ownerCount <= 1;
    if (isLastOwner) {
      return <span className="text-xs text-text-primary/60">{t("lastOwnerHint")}</span>;
    }
    return (
      <div className="flex flex-wrap justify-end gap-2 md:justify-start">
        {row.role === "ADMIN" ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => openDialog({ kind: "PROMOTE", row })}>
            {t("actions.promote")}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={() => openDialog({ kind: "DEMOTE", row })}>
            {t("actions.demote")}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => openDialog({ kind: "REVOKE", row })}>
          {t("actions.remove")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <p role="status" className="rounded-lg border border-border-luxury bg-brand-cream p-4 text-sm">
          {notice}
        </p>
      ) : null}

      {canManage ? (
        <section className="rounded-lg border border-border-luxury bg-brand-ivory p-4 md:p-6" aria-labelledby="team-add-title">
          <h2 id="team-add-title" className="font-display text-xl">
            {t("add.title")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-text-primary/70">{t("add.help")}</p>
          <form onSubmit={handleLookup} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
              {t("add.emailLabel")}
              <Input
                type="email"
                dir="ltr"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("add.emailPlaceholder")}
                className="text-start"
              />
            </label>
            <Button type="submit" variant="secondary" disabled={isPending || !email.trim()}>
              {isPending && !pending ? t("add.finding") : t("add.find")}
            </Button>
          </form>
          {lookupError ? (
            <div className="mt-3">
              <FormError message={lookupError} />
            </div>
          ) : null}
          {found ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-border-luxury pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">{t("add.found")}</p>
                <p>
                  {found.name} · <Email value={found.email} />
                </p>
                {isStaffRole(found.role) ? (
                  <p className="mt-1 text-text-primary/70">{t("add.alreadyStaff", { role: t(`roles.${found.role}`) })}</p>
                ) : found.disabled ? (
                  <p className="mt-1 text-text-primary/70">{t("add.disabled")}</p>
                ) : null}
              </div>
              {!isStaffRole(found.role) && !found.disabled ? (
                <Button type="button" onClick={() => openDialog({ kind: "GRANT", email: found.email })}>
                  {t("add.grant")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : (
        <p role="note" className="rounded-lg border border-border-luxury bg-brand-cream p-4 text-sm">
          {t("readOnly")}
        </p>
      )}

      <DataTable
        rows={rows}
        rowKey={(row) => row.uid}
        emptyMessage={t("empty")}
        columns={[
          {
            header: t("columns.member"),
            render: (row) => (
              <div className="flex flex-col items-end gap-0.5 md:items-start">
                <span className="font-medium">
                  {row.name}
                  {row.uid === viewerUid ? (
                    <span className="ms-2 text-xs font-normal text-text-primary/60">({t("you")})</span>
                  ) : null}
                </span>
                <span className="text-xs text-text-primary/70">
                  <Email value={row.email} />
                </span>
              </div>
            ),
          },
          {
            header: t("columns.role"),
            render: (row) => <Badge variant={row.role === "OWNER" ? "burgundy" : "gold"}>{t(`roles.${row.role}`)}</Badge>,
          },
          {
            header: t("columns.status"),
            render: (row) => (
              <div className="flex flex-col items-end gap-0.5 md:items-start">
                <span>{row.disabled ? t("status.disabled") : t("status.active")}</span>
                <span className="text-xs text-text-primary/60">
                  {row.emailVerified ? t("status.verified") : t("status.unverified")}
                </span>
              </div>
            ),
          },
          { header: t("columns.lastSignIn"), render: (row) => row.lastSignIn ?? t("never") },
          ...(canManage ? [{ header: t("columns.actions"), render: (row: TeamRow) => rowActions(row) }] : []),
        ]}
      />

      {pending && dialogCopy ? (
        <Dialog open onClose={closeDialog} title={dialogCopy.title}>
          <div className="flex flex-col gap-4">
            <p className="text-sm">{dialogCopy.body}</p>
            {needsTypedEmail ? (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {t("confirm.removeTypeLabel")}
                <Input
                  type="email"
                  dir="ltr"
                  autoComplete="off"
                  value={typedEmail}
                  onChange={(e) => setTypedEmail(e.target.value)}
                  placeholder={targetEmail}
                  className="text-start"
                />
              </label>
            ) : null}
            {dialogError ? <FormError message={dialogError} /> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={isPending}>
                {t("confirm.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={isPending || (needsTypedEmail && !typedMatches)}
              >
                {isPending ? t("confirm.working") : dialogCopy.cta}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
