import "server-only";
import { usersCollection, ordersCollection } from "@/lib/firebase/firestore";
import type { User } from "@/types/user";
import type { Order } from "@/types/order";

const CUSTOMER_LIST_LIMIT = 200;

/** Every registered customer (T166), newest first, for the admin customer list (T167). */
export async function getAllCustomers(limit = CUSTOMER_LIST_LIMIT): Promise<User[]> {
  const snapshot = await usersCollection().where("role", "==", "CUSTOMER").orderBy("createdAt", "desc").limit(limit).get();
  return snapshot.docs.map((doc) => doc.data());
}

/** A single customer by `uid`, or null — for the admin customer detail page (T168). */
export async function getCustomerById(uid: string): Promise<User | null> {
  const snapshot = await usersCollection().doc(uid).get();
  return snapshot.exists ? snapshot.data()! : null;
}

/** Every order placed by a given registered customer, newest first — the admin-side counterpart of `getOrdersForCustomer` (no `uid`-isolation restriction, since this is only ever called after `requireAdmin()`). */
export async function getOrdersForCustomerAdmin(uid: string): Promise<Order[]> {
  const snapshot = await ordersCollection().where("userId", "==", uid).orderBy("createdAt", "desc").get();
  return snapshot.docs.map((doc) => doc.data());
}
