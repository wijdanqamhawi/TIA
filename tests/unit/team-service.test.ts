import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `changeTeamRole` against in-memory fakes of Firebase Auth and Firestore:
 * fresh-claim evaluation, last-owner protection counted from real claims,
 * unrelated-claim preservation, mirror sync, session revocation, the audit
 * entry, the lock (BUSY + release), and no writes at all on refusal.
 */

type FakeUser = {
  uid: string;
  email: string;
  displayName?: string;
  disabled: boolean;
  emailVerified: boolean;
  customClaims?: Record<string, unknown>;
  metadata: { creationTime?: string; lastSignInTime?: string };
};

const authUsers = new Map<string, FakeUser>();
const userDocs = new Map<string, Record<string, unknown>>();
const systemDocs = new Map<string, Record<string, unknown>>();
const auditEntries: Record<string, unknown>[] = [];
const failMirrorFor = new Set<string>();
const setClaimsMock = vi.fn();
const revokeMock = vi.fn();

function notFound() {
  return Object.assign(new Error("not found"), { code: "auth/user-not-found" });
}

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({
    getUser: async (uid: string) => {
      const user = authUsers.get(uid);
      if (!user) throw notFound();
      return structuredClone(user);
    },
    getUsers: async (ids: { uid: string }[]) => ({
      users: ids.map(({ uid }) => authUsers.get(uid)).filter(Boolean).map((u) => structuredClone(u)),
    }),
    getUserByEmail: async (email: string) => {
      const user = [...authUsers.values()].find((u) => u.email === email);
      if (!user) throw notFound();
      return structuredClone(user);
    },
    setCustomUserClaims: async (uid: string, claims: Record<string, unknown> | null) => {
      setClaimsMock(uid, claims);
      authUsers.get(uid)!.customClaims = claims ?? undefined;
    },
    revokeRefreshTokens: async (uid: string) => revokeMock(uid),
  }),
}));

function docRef(store: Map<string, Record<string, unknown>>, id: string) {
  return {
    id,
    get: async () => ({ exists: store.has(id), data: () => store.get(id), get: (f: string) => store.get(id)?.[f] }),
    // A real typed-converter merge-set writes `undefined`s, so the service
    // must use update() for partial writes; the fake rejects merge-sets.
    set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      if (opts?.merge) throw new Error("merge-set through the typed converter is not allowed");
      store.set(id, { ...data });
    },
    update: async (data: Record<string, unknown>) => {
      if (failMirrorFor.has(id)) throw new Error("simulated Firestore failure");
      if (!store.has(id)) throw new Error("update on a missing document");
      store.set(id, { ...store.get(id), ...data });
    },
  };
}

vi.mock("@/lib/firebase/firestore", () => ({
  usersCollection: () => ({
    doc: (id: string) => docRef(userDocs, id),
    where: (_field: string, _op: string, roles: string[]) => ({
      get: async () => ({
        docs: [...userDocs.entries()]
          .filter(([, d]) => roles.includes(d.role as string))
          .map(([id, d]) => ({ id, data: () => d })),
      }),
    }),
  }),
  getAdminFirestore: () => ({
    collection: (name: string) =>
      name === "adminAuditLog"
        ? { add: async (entry: Record<string, unknown>) => auditEntries.push(entry) }
        : { doc: (id: string) => ({ id, store: systemDocs }) },
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: async (ref: { id: string }) => {
          const data = systemDocs.get(ref.id);
          return { exists: Boolean(data), get: (f: string) => data?.[f] };
        },
        set: (ref: { id: string }, data: Record<string, unknown>) => systemDocs.set(ref.id, data),
        delete: (ref: { id: string }) => systemDocs.delete(ref.id),
      }),
  }),
}));

const { changeTeamRole, listTeam } = await import("@/lib/domain/admin/team.service");
const { Timestamp } = await import("firebase-admin/firestore");

function addUser(uid: string, role: string | null, extra: Partial<FakeUser> = {}) {
  authUsers.set(uid, {
    uid,
    email: `${uid}@gmail.com`,
    disabled: false,
    emailVerified: true,
    customClaims: role ? { role } : undefined,
    metadata: { creationTime: "Sat, 19 Sep 2026 08:00:00 GMT" },
    ...extra,
  });
  userDocs.set(uid, { uid, name: uid, email: `${uid}@gmail.com`, role: role ?? "CUSTOMER" });
}

const ownerActor = { uid: "owner-a", email: "owner-a@gmail.com", role: "OWNER" as const };

beforeEach(() => {
  authUsers.clear();
  userDocs.clear();
  systemDocs.clear();
  auditEntries.length = 0;
  failMirrorFor.clear();
  setClaimsMock.mockReset();
  revokeMock.mockReset();
});

describe("changeTeamRole", () => {
  it("grants ADMIN: preserves other claims, syncs the mirror, revokes sessions, audits, releases the lock", async () => {
    addUser("owner-a", "OWNER");
    addUser("cust-1", null, { customClaims: { tier: "gold" } });

    const result = await changeTeamRole({ actor: ownerActor, targetUid: "cust-1", toRole: "ADMIN" });

    expect(result).toEqual({ ok: true, kind: "GRANT", fromRole: "CUSTOMER", toRole: "ADMIN", email: "cust-1@gmail.com" });
    expect(setClaimsMock).toHaveBeenCalledWith("cust-1", { tier: "gold", role: "ADMIN" });
    expect(userDocs.get("cust-1")?.role).toBe("ADMIN");
    expect(revokeMock).toHaveBeenCalledWith("cust-1");
    expect(auditEntries).toEqual([
      expect.objectContaining({ kind: "GRANT", actorUid: "owner-a", targetUid: "cust-1", fromRole: "CUSTOMER", toRole: "ADMIN" }),
    ]);
    expect(systemDocs.has("adminTeamLock")).toBe(false);
  });

  it("removes access: drops only the role claim and sets the mirror to CUSTOMER", async () => {
    addUser("owner-a", "OWNER");
    addUser("admin-1", "ADMIN", { customClaims: { role: "ADMIN", tier: "gold" } });

    const result = await changeTeamRole({
      actor: ownerActor,
      targetUid: "admin-1",
      toRole: "CUSTOMER",
      confirmEmail: " ADMIN-1@gmail.com ",
    });

    expect(result).toMatchObject({ ok: true, kind: "REVOKE" });
    expect(setClaimsMock).toHaveBeenCalledWith("admin-1", { tier: "gold" });
    expect(userDocs.get("admin-1")?.role).toBe("CUSTOMER");
    expect(revokeMock).toHaveBeenCalledWith("admin-1");
  });

  it("refuses a mistyped removal confirmation without writing anything", async () => {
    addUser("owner-a", "OWNER");
    addUser("admin-1", "ADMIN");

    const result = await changeTeamRole({ actor: ownerActor, targetUid: "admin-1", toRole: "CUSTOMER", confirmEmail: "x@y.com" });

    expect(result).toEqual({ ok: false, code: "CONFIRMATION_MISMATCH" });
    expect(setClaimsMock).not.toHaveBeenCalled();
    expect(revokeMock).not.toHaveBeenCalled();
    expect(auditEntries).toHaveLength(0);
  });

  it("protects the last OWNER using real claims, even when the mirror is stale", async () => {
    addUser("owner-a", "OWNER");
    addUser("owner-b", "OWNER");
    // owner-b's Auth claim is really ADMIN; only the stale mirror says OWNER.
    authUsers.get("owner-b")!.customClaims = { role: "ADMIN" };
    addUser("owner-c", "OWNER");
    // owner-a is the actor and a real owner; demoting owner-c would leave
    // exactly one real owner (owner-a) — allowed. Then owner-a is the last.
    expect(await changeTeamRole({ actor: ownerActor, targetUid: "owner-c", toRole: "ADMIN" })).toMatchObject({
      ok: true,
      kind: "DEMOTE",
    });

    // A second owner tries to remove owner-a, who is now the only real OWNER.
    // (A demoted actor couldn't get here in reality — their session is revoked
    // — so this drives the service directly with an owner actor.)
    const otherOwner = { uid: "owner-z", email: "z@gmail.com", role: "OWNER" as const };
    const result = await changeTeamRole({ actor: otherOwner, targetUid: "owner-a", toRole: "CUSTOMER", confirmEmail: "owner-a@gmail.com" });
    expect(result).toEqual({ ok: false, code: "LAST_OWNER" });
    expect(authUsers.get("owner-a")!.customClaims).toEqual({ role: "OWNER" });
  });

  it("refuses self-changes and non-owner actors without writing", async () => {
    addUser("owner-a", "OWNER");
    addUser("owner-b", "OWNER");
    addUser("admin-1", "ADMIN");

    expect(await changeTeamRole({ actor: ownerActor, targetUid: "owner-a", toRole: "ADMIN" })).toEqual({
      ok: false,
      code: "SELF_CHANGE",
    });
    expect(
      await changeTeamRole({ actor: { uid: "admin-1", email: null, role: "ADMIN" }, targetUid: "owner-b", toRole: "ADMIN" }),
    ).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(setClaimsMock).not.toHaveBeenCalled();
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it("still revokes sessions when the mirror write fails after the claim changed", async () => {
    addUser("owner-a", "OWNER");
    addUser("admin-1", "ADMIN");
    failMirrorFor.add("admin-1");

    await expect(
      changeTeamRole({ actor: ownerActor, targetUid: "admin-1", toRole: "CUSTOMER", confirmEmail: "admin-1@gmail.com" }),
    ).rejects.toThrow("simulated Firestore failure");
    expect(setClaimsMock).toHaveBeenCalledWith("admin-1", null);
    expect(revokeMock).toHaveBeenCalledWith("admin-1");
    expect(systemDocs.has("adminTeamLock")).toBe(false);
  });

  it("creates the mirror document when a promoted account has none", async () => {
    addUser("owner-a", "OWNER");
    addUser("cust-1", null);
    userDocs.delete("cust-1");

    expect(await changeTeamRole({ actor: ownerActor, targetUid: "cust-1", toRole: "ADMIN" })).toMatchObject({ ok: true });
    expect(userDocs.get("cust-1")).toMatchObject({ uid: "cust-1", role: "ADMIN", email: "cust-1@gmail.com" });
  });

  it("returns NOT_FOUND for an unknown account", async () => {
    addUser("owner-a", "OWNER");
    expect(await changeTeamRole({ actor: ownerActor, targetUid: "ghost", toRole: "ADMIN" })).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("returns BUSY while another change holds the lock, and takes over an expired lock", async () => {
    addUser("owner-a", "OWNER");
    addUser("cust-1", null);

    systemDocs.set("adminTeamLock", { token: "other", expiresAt: Timestamp.fromMillis(Date.now() + 10_000) });
    expect(await changeTeamRole({ actor: ownerActor, targetUid: "cust-1", toRole: "ADMIN" })).toEqual({
      ok: false,
      code: "BUSY",
    });
    expect(setClaimsMock).not.toHaveBeenCalled();

    systemDocs.set("adminTeamLock", { token: "other", expiresAt: Timestamp.fromMillis(Date.now() - 1) });
    expect(await changeTeamRole({ actor: ownerActor, targetUid: "cust-1", toRole: "ADMIN" })).toMatchObject({ ok: true });
    expect(systemDocs.has("adminTeamLock")).toBe(false);
  });
});

describe("listTeam", () => {
  it("lists only accounts whose real claim is staff, owners first, without sensitive fields", async () => {
    addUser("admin-1", "ADMIN");
    addUser("owner-a", "OWNER");
    addUser("stale-1", "ADMIN");
    authUsers.get("stale-1")!.customClaims = undefined; // mirror says ADMIN, claim says customer

    const team = await listTeam();

    expect(team.map((m) => [m.uid, m.role])).toEqual([
      ["owner-a", "OWNER"],
      ["admin-1", "ADMIN"],
    ]);
    expect(Object.keys(team[0]).sort()).toEqual(
      ["createdAt", "disabled", "email", "emailVerified", "lastSignInAt", "name", "role", "uid"].sort(),
    );
  });
});
