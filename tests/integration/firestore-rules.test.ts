import { afterAll, beforeAll, describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";

/**
 * T233 (research.md §22): proves the least-privilege Firestore Security
 * Rules table in `firestore.rules` (T227) actually denies/allows exactly
 * what it claims, using the Emulator Suite's rules-testing library — a
 * *client SDK* simulation. The Firebase Admin SDK used by every real
 * Server Action bypasses these rules entirely (that's the point: rules
 * are a defense-in-depth backstop against direct client access, never the
 * primary authorization mechanism), so this suite is independent of, and
 * never asserts anything about, the app's own Admin-SDK read/write paths.
 *
 * Requires the Firebase Local Emulator Suite (Firestore) running, with
 * `FIRESTORE_EMULATOR_HOST` set in the environment — same convention as
 * every other `tests/integration/*.test.ts` file. Skipped automatically
 * otherwise.
 */
const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!hasEmulator)("Firestore Security Rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-elora",
      firestore: { rules: readFileSync("firestore.rules", "utf8") },
    });

    // Seed fixture documents with rules disabled — this is setup, not the
    // thing under test. Every ID below is a `rules-test-*`/`alice`/`o1`-
    // style synthetic ID, deliberately never a real seeded ID (e.g.
    // `bracelets`, `west-bank`) — this suite shares one long-lived
    // emulator with `scripts/seed.ts` and every other integration/e2e
    // spec, and a collision would silently overwrite (not merge) that
    // shared fixture's real fields, corrupting every other suite that
    // reads it. `afterAll` below deletes every fixture doc this suite
    // creates, regardless of ID, as a second layer of the same guarantee.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection("products").doc("rules-test-product").set({ id: "rules-test-product", name: { en: "Test Product" } });
      await db.collection("categories").doc("rules-test-category").set({ id: "rules-test-category", name: { en: "Test Category" } });
      await db
        .collection("categoryShowcases")
        .doc("rules-test-showcase")
        .set({ id: "rules-test-showcase", categoryId: "rules-test-category" });
      await db.collection("deliveryRegions").doc("rules-test-region").set({ regionId: "rules-test-region" });
      await db.collection("deliveryLocations").doc("rules-test-location").set({ regionId: "rules-test-region" });
      await db.collection("users").doc("alice").set({ uid: "alice", email: "alice@example.com" });
      await db.collection("wishlists").doc("alice").set({ items: [] });
      await db.collection("carts").doc("alice").set({ items: [] });
      await db.collection("orders").doc("o1").set({ id: "o1", userId: "alice", total: 1000 });
      await db.collection("guestCarts").doc("g1").set({ items: [] });
      await db.collection("counters").doc("rules-test-counter").set({ seq: 1 });
      await db.collection("stats").doc("rules-test-stats").set({ totalSales: 0, totalOrders: 0 });
    });
  });

  afterAll(async () => {
    // Clean up every fixture doc regardless of pass/fail, so this suite
    // never leaves state behind for `scripts/seed.ts`-backed suites that
    // run afterward in the same shared emulator.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        db.collection("products").doc("rules-test-product").delete(),
        db.collection("categories").doc("rules-test-category").delete(),
        db.collection("categoryShowcases").doc("rules-test-showcase").delete(),
        db.collection("deliveryRegions").doc("rules-test-region").delete(),
        db.collection("deliveryLocations").doc("rules-test-location").delete(),
        db.collection("users").doc("alice").delete(),
        db.collection("wishlists").doc("alice").delete(),
        db.collection("carts").doc("alice").delete(),
        db.collection("orders").doc("o1").delete(),
        db.collection("guestCarts").doc("g1").delete(),
        db.collection("counters").doc("rules-test-counter").delete(),
        db.collection("stats").doc("rules-test-stats").delete(),
      ]);
    });
    await testEnv.cleanup();
  });

  describe("public catalog collections", () => {
    for (const [collection, docId] of [
      ["products", "rules-test-product"],
      ["categories", "rules-test-category"],
      ["categoryShowcases", "rules-test-showcase"],
      ["deliveryRegions", "rules-test-region"],
      ["deliveryLocations", "rules-test-location"],
    ] as const) {
      it(`allows an unauthenticated client to read ${collection}`, async () => {
        const unauthed = testEnv.unauthenticatedContext();
        await assertSucceeds(unauthed.firestore().collection(collection).doc(docId).get());
      });

      it(`denies an unauthenticated client from writing ${collection}`, async () => {
        const unauthed = testEnv.unauthenticatedContext();
        await assertFails(unauthed.firestore().collection(collection).doc(docId).set({ hacked: true }));
      });

      it(`denies even an ADMIN-claim client from writing ${collection} directly (Admin SDK only)`, async () => {
        const admin = testEnv.authenticatedContext("admin-uid", { role: "ADMIN" });
        await assertFails(admin.firestore().collection(collection).doc(docId).set({ hacked: true }));
      });
    }
  });

  describe("owner-only personal data", () => {
    it("lets a signed-in user read her own users/{uid} document", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertSucceeds(alice.firestore().collection("users").doc("alice").get());
    });

    it("denies a signed-in user from reading another user's users/{uid} document", async () => {
      const mallory = testEnv.authenticatedContext("mallory");
      await assertFails(mallory.firestore().collection("users").doc("alice").get());
    });

    it("denies an unauthenticated client from reading any users/{uid} document", async () => {
      const unauthed = testEnv.unauthenticatedContext();
      await assertFails(unauthed.firestore().collection("users").doc("alice").get());
    });

    it("denies writing users/{uid} even as its owner (profile edits are server-only)", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(alice.firestore().collection("users").doc("alice").set({ name: "Hacked" }));
    });

    it("lets a signed-in user read her own wishlists/{uid} document, denies another's", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const mallory = testEnv.authenticatedContext("mallory");
      await assertSucceeds(alice.firestore().collection("wishlists").doc("alice").get());
      await assertFails(mallory.firestore().collection("wishlists").doc("alice").get());
    });

    it("lets a signed-in user read her own carts/{uid} document, denies another's", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const mallory = testEnv.authenticatedContext("mallory");
      await assertSucceeds(alice.firestore().collection("carts").doc("alice").get());
      await assertFails(mallory.firestore().collection("carts").doc("alice").get());
    });
  });

  describe("orders — owner-scoped by resource.data.userId", () => {
    it("lets the owning customer read her own order", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertSucceeds(alice.firestore().collection("orders").doc("o1").get());
    });

    it("denies a different signed-in customer from reading someone else's order", async () => {
      const mallory = testEnv.authenticatedContext("mallory");
      await assertFails(mallory.firestore().collection("orders").doc("o1").get());
    });

    it("denies an unauthenticated client from reading any order", async () => {
      const unauthed = testEnv.unauthenticatedContext();
      await assertFails(unauthed.firestore().collection("orders").doc("o1").get());
    });

    it("denies writing an order even as its owner (orders are server-only)", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(alice.firestore().collection("orders").doc("o1").update({ status: "CONFIRMED" }));
    });
  });

  describe("fully denied internal collections", () => {
    for (const [collection, docId] of [
      ["guestCarts", "g1"],
      ["counters", "rules-test-counter"],
      ["stats", "rules-test-stats"],
    ] as const) {
      it(`denies reading ${collection} to anyone, including an authenticated admin`, async () => {
        const admin = testEnv.authenticatedContext("admin-uid", { role: "ADMIN" });
        const unauthed = testEnv.unauthenticatedContext();
        await assertFails(admin.firestore().collection(collection).doc(docId).get());
        await assertFails(unauthed.firestore().collection(collection).doc(docId).get());
      });
    }
  });
});
