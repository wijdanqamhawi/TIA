import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getAdminFirestore, usersCollection } from "@/lib/firebase/firestore";
import { isOwnerRole, isStaffRole, STAFF_ROLES, toUserRole, type StaffRole, type UserRole } from "@/lib/auth/roles";
import { claimsWithRole, decideTeamChange, type TeamChangeKind, type TeamDenialCode } from "./team.policy";

/**
 * Server-side admin-team operations. Authorization is decided by the
 * caller (`requireOwner()` in the Server Actions) and re-checked here by
 * `decideTeamChange` against the target's FRESH custom claims and a fresh
 * owner count, inside a lock so two owners can't race past the last-owner
 * rule. Never creates accounts and never reads or sets passwords.
 */

/** Non-sensitive, serializable view of one staff account. */
export type TeamMember = {
  uid: string;
  name: string;
  email: string;
  role: StaffRole;
  disabled: boolean;
  emailVerified: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
};

export type TeamAccount = {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  disabled: boolean;
};

export type TeamErrorCode = TeamDenialCode | "NOT_FOUND" | "BUSY" | "CONFIRMATION_MISMATCH";

export type TeamChangeResult =
  | { ok: true; kind: TeamChangeKind; fromRole: UserRole; toRole: UserRole; email: string }
  | { ok: false; code: TeamErrorCode };

const LOCK_TTL_MS = 30_000;
const GET_USERS_BATCH = 100;

function displayName(user: UserRecord, mirrorName?: string): string {
  return user.displayName || mirrorName || user.email?.split("@")[0] || user.uid;
}

function toTeamAccount(user: UserRecord): TeamAccount {
  return {
    uid: user.uid,
    name: displayName(user),
    email: user.email ?? "",
    role: toUserRole(user.customClaims?.role),
    disabled: user.disabled,
  };
}

/**
 * Current staff accounts. The Firestore role mirror finds the candidates
 * cheaply; each candidate's real custom claim decides whether it is listed
 * and with which role. A stale mirror can therefore only ever UNDER-count
 * owners, which makes the last-owner rule stricter, never looser.
 */
export async function listTeam(includeUids: string[] = []): Promise<TeamMember[]> {
  const candidates = await usersCollection().where("role", "in", [...STAFF_ROLES]).get();
  const mirrorNames = new Map(candidates.docs.map((doc) => [doc.id, doc.data().name]));
  const uids = [...new Set([...candidates.docs.map((doc) => doc.id), ...includeUids])];

  const auth = getAdminAuth();
  const users: UserRecord[] = [];
  for (let i = 0; i < uids.length; i += GET_USERS_BATCH) {
    const batch = uids.slice(i, i + GET_USERS_BATCH).map((uid) => ({ uid }));
    users.push(...(await auth.getUsers(batch)).users);
  }

  return users
    .filter((user) => isStaffRole(user.customClaims?.role))
    .map((user) => ({
      uid: user.uid,
      name: displayName(user, mirrorNames.get(user.uid)),
      email: user.email ?? "",
      role: user.customClaims!.role as StaffRole,
      disabled: user.disabled,
      emailVerified: user.emailVerified,
      createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime).toISOString() : null,
      lastSignInAt: user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toISOString() : null,
    }))
    .sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === "OWNER" ? -1 : 1));
}

/** Looks up an existing account by email; `null` when none exists. Never creates one. */
export async function findAccountByEmail(email: string): Promise<TeamAccount | null> {
  try {
    return toTeamAccount(await getAdminAuth().getUserByEmail(email));
  } catch (err) {
    if ((err as { code?: string }).code === "auth/user-not-found") return null;
    throw err;
  }
}

async function getUserOrNull(uid: string): Promise<UserRecord | null> {
  try {
    return await getAdminAuth().getUser(uid);
  } catch (err) {
    if ((err as { code?: string }).code === "auth/user-not-found") return null;
    throw err;
  }
}

class TeamBusyError extends Error {}

/**
 * Serializes team changes with a short-lived lock document. Created in a
 * transaction so only one holder wins; an expired lock (a crashed request)
 * is taken over after `LOCK_TTL_MS`.
 */
async function withTeamLock<T>(holderUid: string, fn: () => Promise<T>): Promise<T> {
  const db = getAdminFirestore();
  const ref = db.collection("system").doc("adminTeamLock");
  const token = randomUUID();

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const expiresAt = snapshot.exists ? (snapshot.get("expiresAt") as Timestamp | undefined) : undefined;
    if (expiresAt && expiresAt.toMillis() > Date.now()) throw new TeamBusyError();
    tx.set(ref, { holderUid, token, expiresAt: Timestamp.fromMillis(Date.now() + LOCK_TTL_MS) });
  });

  try {
    return await fn();
  } finally {
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (snapshot.exists && snapshot.get("token") === token) tx.delete(ref);
    });
  }
}

/** Keeps `users/{uid}.role` equal to the claim (display/query mirror only). */
async function syncRoleMirror(user: UserRecord, toRole: UserRole): Promise<void> {
  const ref = usersCollection().doc(user.uid);
  const snapshot = await ref.get();
  if (snapshot.exists) {
    // `update`, not `set(…, { merge })`: a merge-set still runs the typed
    // converter's full-document `toFirestore`, which writes `undefined`s.
    await ref.update({ role: toRole, updatedAt: FieldValue.serverTimestamp() });
  } else if (isStaffRole(toRole)) {
    await ref.set({
      id: user.uid,
      uid: user.uid,
      name: displayName(user),
      email: user.email ?? "",
      phone: null,
      role: toRole,
      profile: { address: null },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Applies one role change: claim (preserving unrelated claims) → session
 * revocation → mirror → audit entry. The claim is the authoritative write,
 * and revocation immediately follows it so it can never be skipped.
 */
export async function changeTeamRole(params: {
  actor: { uid: string; email: string | null; role: UserRole };
  targetUid: string;
  toRole: UserRole;
  /** Remove-access only: the email the owner typed, which must match the target. */
  confirmEmail?: string;
}): Promise<TeamChangeResult> {
  const { actor, targetUid, toRole, confirmEmail } = params;

  try {
    return await withTeamLock(actor.uid, async () => {
      const target = await getUserOrNull(targetUid);
      if (!target) return { ok: false, code: "NOT_FOUND" } as const;

      if (confirmEmail !== undefined && confirmEmail.trim().toLowerCase() !== (target.email ?? "").toLowerCase()) {
        return { ok: false, code: "CONFIRMATION_MISMATCH" } as const;
      }

      const fromRole = toUserRole(target.customClaims?.role);
      const team = await listTeam([actor.uid, targetUid]);
      const ownerCount = team.filter((member) => isOwnerRole(member.role)).length;

      const decision = decideTeamChange({
        actor: { uid: actor.uid, role: actor.role },
        target: { uid: target.uid, role: fromRole, disabled: target.disabled },
        toRole,
        ownerCount,
      });
      if (!decision.allowed) return { ok: false, code: decision.code } as const;

      const auth = getAdminAuth();
      await auth.setCustomUserClaims(target.uid, claimsWithRole(target.customClaims, toRole));
      // Revoke straight after the claim, before anything that could fail:
      // session cookies keep the claims they were minted with, so this is
      // what makes the new role apply on the target's very next request.
      await auth.revokeRefreshTokens(target.uid);
      await syncRoleMirror(target, toRole);

      await getAdminFirestore().collection("adminAuditLog").add({
        kind: decision.kind,
        actorUid: actor.uid,
        actorEmail: actor.email,
        targetUid: target.uid,
        targetEmail: target.email ?? null,
        fromRole,
        toRole,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true, kind: decision.kind, fromRole, toRole, email: target.email ?? "" } as const;
    });
  } catch (err) {
    if (err instanceof TeamBusyError) return { ok: false, code: "BUSY" };
    throw err;
  }
}
