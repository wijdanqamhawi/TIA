import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore, usersCollection } from "@/lib/firebase/firestore";

/** What the checkout form shows before the shopper types anything. */
export type CheckoutPrefill = { fullName: string; email: string; phone: string };

/** Checkout prefill from the signed-in customer's `users/{uid}` document (empty for a guest). */
export function buildCheckoutPrefill(
  user: { name: string; email: string; phone: string | null } | null,
): CheckoutPrefill {
  return { fullName: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" };
}

/**
 * Saves the phone a signed-in customer typed at checkout onto
 * `users/{uid}.phone` — but only when that field is still empty. Read and
 * written in one transaction, so a phone the customer already has (or sets in
 * Profile at the same moment) is never overwritten. Returns whether it wrote.
 * `orders/{id}.customerSnapshot.phone` is unrelated and stays the order-time copy.
 */
export async function backfillUserPhone(uid: string, phone: string): Promise<boolean> {
  const value = phone.trim();
  if (!value) return false;
  const ref = usersCollection().doc(uid);
  return getAdminFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data()?.phone?.trim()) return false;
    transaction.update(ref, { phone: value, updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
}
