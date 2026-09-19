import { isOwnerRole, isStaffRole, type UserRole } from "@/lib/auth/roles";

/**
 * The admin-team rules, as one pure function so every server path (and the
 * unit tests) apply exactly the same checks. The UI hides controls using
 * the same rules, but only the server's evaluation — with the target's
 * fresh claims and a fresh owner count — is authoritative.
 */

export type TeamChangeKind = "GRANT" | "PROMOTE" | "DEMOTE" | "REVOKE";

export type TeamDenialCode =
  | "FORBIDDEN" // actor is not an OWNER
  | "SELF_CHANGE" // actor targeting their own account
  | "NO_CHANGE" // target already has the requested role
  | "ACCOUNT_DISABLED" // cannot give staff access to a disabled account
  | "LAST_OWNER"; // would leave the store with no OWNER

export type TeamChangeRequest = {
  actor: { uid: string; role: UserRole };
  target: { uid: string; role: UserRole; disabled: boolean };
  toRole: UserRole;
  /** Current number of OWNER accounts, counted from real custom claims. */
  ownerCount: number;
};

export type TeamChangeDecision = { allowed: true; kind: TeamChangeKind } | { allowed: false; code: TeamDenialCode };

export function classifyChange(fromRole: UserRole, toRole: UserRole): TeamChangeKind | null {
  if (fromRole === toRole) return null;
  if (!isStaffRole(fromRole)) return "GRANT";
  if (!isStaffRole(toRole)) return "REVOKE";
  return isOwnerRole(toRole) ? "PROMOTE" : "DEMOTE";
}

export function decideTeamChange({ actor, target, toRole, ownerCount }: TeamChangeRequest): TeamChangeDecision {
  if (!isOwnerRole(actor.role)) return { allowed: false, code: "FORBIDDEN" };
  if (actor.uid === target.uid) return { allowed: false, code: "SELF_CHANGE" };

  const kind = classifyChange(target.role, toRole);
  if (!kind) return { allowed: false, code: "NO_CHANGE" };

  if (isStaffRole(toRole) && target.disabled) return { allowed: false, code: "ACCOUNT_DISABLED" };

  // Taking OWNER away from the target must leave at least one OWNER behind.
  if (isOwnerRole(target.role) && !isOwnerRole(toRole) && ownerCount <= 1) {
    return { allowed: false, code: "LAST_OWNER" };
  }

  return { allowed: true, kind };
}

/** Sets the role claim while keeping every unrelated custom claim. */
export function claimsWithRole(
  current: Record<string, unknown> | undefined | null,
  toRole: UserRole,
): Record<string, unknown> | null {
  const next: Record<string, unknown> = { ...(current ?? {}) };
  if (isStaffRole(toRole)) next.role = toRole;
  else delete next.role; // a missing role reads as CUSTOMER
  return Object.keys(next).length ? next : null;
}
