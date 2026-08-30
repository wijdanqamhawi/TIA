import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { cartsCollection, guestCartsCollection, getAdminFirestore, productsCollection } from "@/lib/firebase/firestore";
import { sameCartLine } from "./cart.service";
import type { CartItem } from "@/types/cart";

/**
 * Pure merge computation (no I/O — unit-testable in isolation, T107):
 * for each guest line, if the same `productId` + `selectedOption` already
 * exists in `userItems`, quantities are summed; otherwise the line is
 * added — both cases clamped to that product's current `stock` so the
 * result can never exceed available stock (spec: "never allow the merge
 * to create an invalid quantity"). A guest line whose product has no
 * entry in `stockByProductId` (i.e. no longer exists) is dropped rather
 * than carried over as a dangling reference (data-model.md, "Cart/
 * wishlist referential cleanup"). Pre-existing `userItems` lines that
 * aren't touched by any guest line are left exactly as they were.
 */
export function computeMergedCartItems(
  userItems: CartItem[],
  guestItems: CartItem[],
  stockByProductId: Map<string, number>,
): CartItem[] {
  const merged: CartItem[] = [...userItems];

  for (const guestItem of guestItems) {
    const stock = stockByProductId.get(guestItem.productId);
    if (stock === undefined) continue; // product no longer exists — drop the line

    const existingIndex = merged.findIndex((item) => sameCartLine(item, guestItem));
    const combinedQuantity = (existingIndex >= 0 ? merged[existingIndex].quantity : 0) + guestItem.quantity;
    const clampedQuantity = Math.min(combinedQuantity, stock);

    if (clampedQuantity <= 0) {
      if (existingIndex >= 0) merged.splice(existingIndex, 1);
      continue;
    }

    if (existingIndex >= 0) {
      merged[existingIndex] = { ...merged[existingIndex], quantity: clampedQuantity };
    } else {
      merged.push({ ...guestItem, quantity: clampedQuantity });
    }
  }

  return merged;
}

/**
 * Guest → registered cart merge (research.md §6, T103), run inside one
 * Firestore transaction so the stock-clamping read and the merge write
 * are consistent even under concurrent stock changes. The guest cart
 * document is deleted once merged — the caller (`createSessionAction`)
 * is responsible for clearing the cookie.
 */
export async function mergeGuestCartIntoUserCart(uid: string, guestCartId: string): Promise<void> {
  await getAdminFirestore().runTransaction(async (transaction) => {
    const guestRef = guestCartsCollection().doc(guestCartId);
    const userRef = cartsCollection().doc(uid);

    const [guestSnapshot, userSnapshot] = await Promise.all([
      transaction.get(guestRef),
      transaction.get(userRef),
    ]);

    if (!guestSnapshot.exists) {
      return; // no guest cart to merge — nothing to do
    }

    const guestItems = guestSnapshot.data()!.items;
    const userItems = userSnapshot.exists ? userSnapshot.data()!.items : [];

    if (guestItems.length === 0) {
      transaction.delete(guestRef);
      return;
    }

    const productIds = Array.from(new Set(guestItems.map((item) => item.productId)));
    const productRefs = productIds.map((id) => productsCollection().doc(id));
    const productSnapshots = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
    const stockByProductId = new Map(
      productSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.id, snapshot.data()!.stock]),
    );

    const merged = computeMergedCartItems(userItems, guestItems, stockByProductId);

    transaction.set(
      userRef,
      {
        id: uid,
        items: merged,
        expiresAt: null,
        createdAt: userSnapshot.exists ? userSnapshot.data()!.createdAt : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    transaction.delete(guestRef);
  });
}
