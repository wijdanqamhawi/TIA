import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { createSessionInputSchema, registerSchema } from "@/lib/validation/auth.schema";
import { buildCheckoutPrefill } from "@/lib/domain/account/user-phone";

/**
 * Customer phone collection on the existing `users/{uid}.phone` field:
 * required at Register and stored by `createSessionAction`, editable in
 * Profile, prefilled at checkout, and backfilled at checkout only while the
 * profile phone is empty. Firestore, Auth and every collaborator are faked —
 * nothing is read from or written to any real project.
 */

const VALID = { name: "Layla Hasan", email: "layla@example.com", password: "supersecret1" };

describe("registerSchema — phone", () => {
  it("requires a phone number", () => {
    const missing = registerSchema.safeParse(VALID);
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.issues[0]?.path[0]).toBe("phone");
    expect(registerSchema.safeParse({ ...VALID, phone: "" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...VALID, phone: "   " }).success).toBe(false);
  });

  it("accepts a valid phone, trimmed", () => {
    const result = registerSchema.safeParse({ ...VALID, phone: "  +970 59 123 4567 " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe("+970 59 123 4567");
  });

  it("rejects an invalid phone", () => {
    for (const phone of ["12345", "abcdefgh", "+970 59 123 4567 ext 9", "1".repeat(21)]) {
      expect(registerSchema.safeParse({ ...VALID, phone }).success, phone).toBe(false);
    }
  });
});

describe("createSessionInputSchema — phone", () => {
  it("keeps phone optional (the same action signs existing customers in) but validates it when present", () => {
    expect(createSessionInputSchema.safeParse({ idToken: "t" }).success).toBe(true);
    expect(createSessionInputSchema.safeParse({ idToken: "t", phone: "0599123456" }).success).toBe(
      true,
    );
    expect(createSessionInputSchema.safeParse({ idToken: "t", phone: "nope" }).success).toBe(false);
  });
});

describe("Auth translations for the register phone field", () => {
  it("exist in English and Arabic", () => {
    for (const messages of [en, ar]) {
      expect(messages.Auth.phoneLabel).toBeTruthy();
      expect(messages.Auth.errors.invalidPhone).toBeTruthy();
      expect(messages.Auth.errors.phoneRequired).toBeTruthy();
    }
    expect(ar.Auth.phoneLabel).not.toBe(en.Auth.phoneLabel);
  });
});

describe("buildCheckoutPrefill", () => {
  it("prefills the phone from users.phone", () => {
    expect(
      buildCheckoutPrefill({ name: "Sara", email: "s@example.com", phone: "+970 59 123 4567" }),
    ).toEqual({
      fullName: "Sara",
      email: "s@example.com",
      phone: "+970 59 123 4567",
    });
  });

  it("leaves the phone empty for a customer without one, and everything empty for a guest", () => {
    expect(buildCheckoutPrefill({ name: "Sara", email: "s@example.com", phone: null }).phone).toBe(
      "",
    );
    expect(buildCheckoutPrefill(null)).toEqual({ fullName: "", email: "", phone: "" });
  });
});

// ── backfillUserPhone ─────────────────────────────────────────────────────────

describe("backfillUserPhone", () => {
  type Doc = { exists: boolean; phone: string | null } | null;
  let doc: Doc;
  const updates: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    vi.resetModules();
    updates.length = 0;
    doc = { exists: true, phone: null };
    vi.doMock("@/lib/firebase/firestore", () => ({
      usersCollection: () => ({ doc: (uid: string) => ({ uid }) }),
      getAdminFirestore: () => ({
        runTransaction: async (fn: (tx: unknown) => Promise<boolean>) =>
          fn({
            get: async () => ({
              exists: doc?.exists ?? false,
              data: () => (doc ? { phone: doc.phone } : undefined),
            }),
            update: (_ref: unknown, patch: Record<string, unknown>) => updates.push(patch),
          }),
      }),
    }));
  });

  async function backfill(phone: string) {
    const { backfillUserPhone } = await import("@/lib/domain/account/user-phone");
    return backfillUserPhone("user-1", phone);
  }

  it("writes the checkout phone when users.phone is empty", async () => {
    await expect(backfill("+970 59 123 4567")).resolves.toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ phone: "+970 59 123 4567" });
    expect(Object.keys(updates[0]!).sort()).toEqual(["phone", "updatedAt"]);
  });

  it("treats a blank stored phone as empty", async () => {
    doc = { exists: true, phone: "   " };
    await expect(backfill("0599123456")).resolves.toBe(true);
  });

  it("does NOT overwrite an existing users.phone", async () => {
    doc = { exists: true, phone: "+970 56 000 0000" };
    await expect(backfill("+970 59 123 4567")).resolves.toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("does nothing when there is no user document or the phone is blank", async () => {
    doc = { exists: false, phone: null };
    await expect(backfill("0599123456")).resolves.toBe(false);
    doc = { exists: true, phone: null };
    await expect(backfill("   ")).resolves.toBe(false);
    expect(updates).toHaveLength(0);
  });
});

// ── createSessionAction: the register phone lands in users/{uid}.phone ────────

describe("createSessionAction", () => {
  let existing: { exists: boolean; data: () => Record<string, unknown> | undefined };
  const setMock = vi.fn();
  const updateMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    setMock.mockReset();
    updateMock.mockReset();
    existing = { exists: false, data: () => undefined };

    vi.doMock("next/headers", () => ({ cookies: async () => ({ set: vi.fn() }) }));
    vi.doMock("@/lib/firebase/auth", () => ({
      createSessionCookie: async () => ({
        uid: "user-1",
        email: "layla@example.com",
        name: "Layla Hasan",
        sessionCookie: "cookie",
      }),
      revokeAllSessions: vi.fn(),
      SESSION_COOKIE_MAX_AGE_MS: 1000,
      SESSION_COOKIE_NAME: "session",
    }));
    vi.doMock("@/lib/firebase/guards", () => ({ getSessionClaims: vi.fn() }));
    vi.doMock("@/lib/firebase/firestore", () => ({
      usersCollection: () => ({
        doc: () => ({ get: async () => existing, set: setMock, update: updateMock }),
      }),
    }));
    vi.doMock("@/lib/utils/rate-limit", () => ({ rateLimit: () => ({ allowed: true }) }));
    vi.doMock("@/lib/utils/request-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
    vi.doMock("@/lib/domain/cart/guest-cart", () => ({
      readGuestCartId: async () => null,
      clearGuestCartCookie: vi.fn(),
    }));
    vi.doMock("@/lib/domain/cart/cart-merge.service", () => ({
      mergeGuestCartIntoUserCart: vi.fn(),
    }));
    vi.doMock("@/lib/domain/wishlist/wishlist.service", () => ({ addItemToWishlist: vi.fn() }));
    vi.doMock("@/lib/domain/catalog/product.service", () => ({
      getProductById: vi.fn(),
      isSelectedOptionValid: vi.fn(),
    }));
    vi.doMock("@/lib/config/cookies", () => ({ cookieSecure: () => false }));
  });

  async function createSession(input: unknown) {
    const { createSessionAction } = await import("@/actions/auth.actions");
    return createSessionAction(input);
  }

  it("stores the submitted phone in users/{uid}.phone when the account is created", async () => {
    const result = await createSession({ idToken: "token", phone: "+970 59 123 4567" });
    expect(result.ok).toBe(true);
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(setMock.mock.calls[0]![0]).toMatchObject({
      uid: "user-1",
      role: "CUSTOMER",
      phone: "+970 59 123 4567",
    });
  });

  it("rejects an invalid phone without creating anything", async () => {
    const result = await createSession({ idToken: "token", phone: "not a phone" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(setMock).not.toHaveBeenCalled();
  });

  it("still creates the document (phone null) when none is sent, so other sign-in paths keep working", async () => {
    const result = await createSession({ idToken: "token" });
    expect(result.ok).toBe(true);
    expect(setMock.mock.calls[0]![0]).toMatchObject({ phone: null });
  });

  it("never overwrites an existing customer's phone on sign-in", async () => {
    existing = {
      exists: true,
      data: () => ({ role: "CUSTOMER", email: "layla@example.com", phone: "+970 56 000 0000" }),
    };
    const result = await createSession({ idToken: "token", phone: "+970 59 123 4567" });
    expect(result.ok).toBe(true);
    expect(setMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});

// ── submitCheckoutAction: the backfill hook ───────────────────────────────────

describe("submitCheckoutAction — phone backfill", () => {
  const backfillMock = vi.fn();
  const claimsMock = vi.fn();
  const createOrderMock = vi.fn();
  const errorLog = vi.fn();

  const checkout = {
    fullName: "Sara Ahmed",
    phone: "+970 59 123 4567",
    email: "sara@example.com",
    regionId: "west-bank",
    locationId: "loc-1",
    fullAddress: "1 Main St",
    paymentMethod: "CASH_ON_DELIVERY",
  };

  beforeEach(() => {
    vi.resetModules();
    backfillMock.mockReset().mockResolvedValue(true);
    claimsMock.mockReset();
    createOrderMock.mockReset().mockResolvedValue({ ok: true, orderNumber: "ELR-20260930-0001" });
    errorLog.mockReset();

    vi.doMock("@/lib/firebase/firestore", () => ({ getAdminFirestore: () => ({}) }));
    vi.doMock("@/lib/firebase/guards", () => ({ getSessionClaims: () => claimsMock() }));
    vi.doMock("@/lib/domain/cart/cart.service", () => ({
      resolveCartRefForMutation: async () => ({ ref: {} }),
    }));
    vi.doMock("@/lib/domain/orders/order.service", () => ({
      createOrder: (...a: unknown[]) => createOrderMock(...a),
    }));
    vi.doMock("@/lib/domain/orders/guest-order-access", () => ({ grantGuestOrderAccess: vi.fn() }));
    vi.doMock("@/lib/domain/delivery/deliveryLocation.service", () => ({
      getActiveDeliveryLocationsByRegion: vi.fn(),
    }));
    vi.doMock("@/lib/domain/checkout/payment", () => ({
      resolvePaymentMethod: () => ({ type: "CASH_ON_DELIVERY" }),
    }));
    vi.doMock("@/lib/utils/rate-limit", () => ({ rateLimit: () => ({ allowed: true }) }));
    vi.doMock("@/lib/utils/request-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
    vi.doMock("@/lib/utils/logger", () => ({
      logger: { error: (...a: unknown[]) => errorLog(...a), warn: vi.fn() },
    }));
    vi.doMock("@/lib/domain/account/user-phone", () => ({
      backfillUserPhone: (...a: unknown[]) => backfillMock(...a),
    }));
  });

  async function submit() {
    const { submitCheckoutAction } = await import("@/actions/checkout.actions");
    return submitCheckoutAction(checkout);
  }

  it("offers a signed-in customer's checkout phone to the backfill, keyed by their own uid", async () => {
    claimsMock.mockResolvedValue({ uid: "user-1", role: "CUSTOMER" });
    const result = await submit();
    expect(result.ok).toBe(true);
    expect(backfillMock).toHaveBeenCalledWith("user-1", "+970 59 123 4567");
  });

  it("leaves the order's own phone snapshot untouched (it is passed to createOrder as typed)", async () => {
    claimsMock.mockResolvedValue({ uid: "user-1", role: "CUSTOMER" });
    await submit();
    expect(createOrderMock.mock.calls[0]![1].checkout.phone).toBe("+970 59 123 4567");
  });

  it("does not backfill for a guest", async () => {
    claimsMock.mockResolvedValue(null);
    const result = await submit();
    expect(result.ok).toBe(true);
    expect(backfillMock).not.toHaveBeenCalled();
  });

  it("does not backfill when the order fails", async () => {
    claimsMock.mockResolvedValue({ uid: "user-1", role: "CUSTOMER" });
    createOrderMock.mockResolvedValue({
      ok: false,
      error: { code: "OUT_OF_STOCK", message: "Sold out." },
    });
    const result = await submit();
    expect(result.ok).toBe(false);
    expect(backfillMock).not.toHaveBeenCalled();
  });

  it("never fails a placed order because the backfill failed", async () => {
    claimsMock.mockResolvedValue({ uid: "user-1", role: "CUSTOMER" });
    backfillMock.mockRejectedValue(new Error("firestore down"));
    const result = await submit();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.orderNumber).toBe("ELR-20260930-0001");
    expect(errorLog).toHaveBeenCalled();
  });
});
