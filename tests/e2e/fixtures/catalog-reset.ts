import { FieldValue } from "firebase-admin/firestore";

/**
 * Cross-spec stock isolation for the seeded catalog (`scripts/seed.ts`).
 *
 * Several spec files place real orders or otherwise depend on a seeded
 * product's exact stock/availability (`account-orders`, `admin-orders`,
 * `cart`, `checkout`, `checkout-invalid`, `special-offers`, `browse`,
 * `wishlist`). Order-creation genuinely decrements stock (T132) — that's
 * correct production behavior, not a bug — but in one continuous
 * `--workers=1` run every one of these spec files shares the *same*
 * emulator/Firestore data. Without resetting between files, stock
 * consumed by an earlier file's real checkout leaks into a later file
 * and can make a shared product genuinely Sold Out for a test that never
 * intended to exhaust it — a test-isolation gap, not an inventory bug.
 *
 * Each spec file that adds-to-cart/checks out a seeded product calls
 * `resetSeededStock()` in `test.beforeAll` so it always starts from the
 * same known baseline regardless of what any other file already did —
 * deterministic isolation, not a bigger stock number. This never touches
 * `isOnSale`/`salePrice`/`availability` or any other field — only the
 * exact numeric `stock` this suite seeds — and never bypasses the real
 * order-creation transaction's own stock decrement/Sold-Out logic.
 */
const SEEDED_STOCK: Record<string, number> = {
  "golden-bangle-bracelet": 12,
  "pearl-tennis-bracelet": 0,
  "solitaire-ring": 6,
  "pearl-drop-earrings": 20,
  "classic-gold-watch": 8,
};

async function getTestFirestore() {
  const { getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-elora" });
  return getFirestore(app);
}

/**
 * Resets the given seeded products' `stock` back to their `scripts/seed.ts`
 * baseline. Defaults to every known seeded product. Silently does nothing
 * for a slug that hasn't been seeded yet — never throws for that case, so
 * this is safe to call defensively even before the first `npm run seed`.
 */
export async function resetSeededStock(slugs: string[] = Object.keys(SEEDED_STOCK)): Promise<void> {
  const db = await getTestFirestore();
  await Promise.all(
    slugs.map(async (slug) => {
      const stock = SEEDED_STOCK[slug];
      if (stock === undefined) {
        throw new Error(`resetSeededStock: "${slug}" is not a known seeded product slug.`);
      }
      const snapshot = await db.collection("products").where("slug", "==", slug).limit(1).get();
      const doc = snapshot.docs[0];
      if (!doc) return;
      await doc.ref.update({ stock, updatedAt: FieldValue.serverTimestamp() });
    }),
  );
}
