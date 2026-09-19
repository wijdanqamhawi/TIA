"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError, requireOwner, UnauthenticatedError } from "@/lib/firebase/guards";
import type { SessionClaims } from "@/lib/firebase/auth";
import { changeTeamRole, findAccountByEmail, type TeamAccount, type TeamChangeResult } from "@/lib/domain/admin/team.service";
import {
  changeAdminRoleSchema,
  grantAdminSchema,
  lookupTeamAccountSchema,
  removeAdminSchema,
} from "@/lib/validation/team.schema";
import { actionError, actionOk, actionValidationError, type ActionResult } from "@/lib/validation/common";
import { logger } from "@/lib/utils/logger";

/**
 * Admin-team Server Actions. Every one is OWNER-only via `requireOwner()`
 * — the session cookie's verified custom claim, never anything the client
 * sends. A regular ADMIN reaching these gets FORBIDDEN. The error `code`s
 * are stable so the Team page can show them in EN or AR.
 */

type OwnerGuard = { claims: SessionClaims } | { error: ActionResult<never> };

async function guardOwner(): Promise<OwnerGuard> {
  try {
    return { claims: await requireOwner() };
  } catch (err) {
    if (err instanceof UnauthenticatedError || err instanceof ForbiddenError) {
      return { error: actionError("FORBIDDEN", "Only an owner can manage the admin team.") };
    }
    throw err;
  }
}

const ERROR_MESSAGES: Record<Exclude<TeamChangeResult, { ok: true }>["code"], string> = {
  FORBIDDEN: "Only an owner can manage the admin team.",
  SELF_CHANGE: "You can't change your own role. Ask another owner.",
  NO_CHANGE: "This account already has that role.",
  ACCOUNT_DISABLED: "This account is disabled.",
  LAST_OWNER: "This is the last owner. Promote another owner first.",
  NOT_FOUND: "No account exists with that email.",
  BUSY: "Another team change is in progress. Try again in a moment.",
  CONFIRMATION_MISMATCH: "The email you typed doesn't match this account.",
};

/**
 * Runs one team change and maps it to an ActionResult. An unexpected
 * failure is logged server-side and returned as a generic UNKNOWN — never
 * a raw Admin SDK error reaching the browser.
 */
async function runChange(
  action: string,
  actorUid: string,
  change: () => Promise<TeamChangeResult>,
): Promise<ActionResult<{ email: string }>> {
  let result: TeamChangeResult;
  try {
    result = await change();
  } catch (err) {
    logger.error(`team: ${action} failed`, { actorUid, error: String(err) });
    revalidatePath("/admin/team");
    return actionError("UNKNOWN", "Something went wrong. Please try again.");
  }
  if (!result.ok) return actionError(result.code, ERROR_MESSAGES[result.code]);
  logger.info(`team: ${action}`, { actorUid, kind: result.kind, fromRole: result.fromRole, toRole: result.toRole });
  revalidatePath("/admin/team");
  return actionOk({ email: result.email });
}

/** Step 1 of "Add admin": confirms an account exists for the email. Never creates one. */
export async function lookupTeamAccountAction(input: unknown): Promise<ActionResult<TeamAccount>> {
  const guard = await guardOwner();
  if ("error" in guard) return guard.error;

  const parsed = lookupTeamAccountSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);

  const account = await findAccountByEmail(parsed.data.email);
  if (!account) return actionError("NOT_FOUND", ERROR_MESSAGES.NOT_FOUND);
  return actionOk(account);
}

/** Gives an existing account the ADMIN role. */
export async function grantAdminAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  const guard = await guardOwner();
  if ("error" in guard) return guard.error;

  const parsed = grantAdminSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);

  const account = await findAccountByEmail(parsed.data.email);
  if (!account) return actionError("NOT_FOUND", ERROR_MESSAGES.NOT_FOUND);

  return runChange("grant", guard.claims.uid, () =>
    changeTeamRole({ actor: guard.claims, targetUid: account.uid, toRole: "ADMIN" }),
  );
}

/** Promotes ADMIN → OWNER or demotes OWNER → ADMIN. */
export async function changeAdminRoleAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  const guard = await guardOwner();
  if ("error" in guard) return guard.error;

  const parsed = changeAdminRoleSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);

  return runChange("change-role", guard.claims.uid, () =>
    changeTeamRole({ actor: guard.claims, targetUid: parsed.data.uid, toRole: parsed.data.role }),
  );
}

/** Removes staff access (back to CUSTOMER). The owner must retype the target's email. */
export async function removeAdminAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  const guard = await guardOwner();
  if ("error" in guard) return guard.error;

  const parsed = removeAdminSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);

  return runChange("remove", guard.claims.uid, () =>
    changeTeamRole({
      actor: guard.claims,
      targetUid: parsed.data.uid,
      toRole: "CUSTOMER",
      confirmEmail: parsed.data.confirmEmail,
    }),
  );
}
