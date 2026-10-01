import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { usersCollection, ordersCollection } from "@/lib/firebase/firestore";
import { isStaffRole } from "@/lib/auth/roles";
import {
  STORE_TIME_ZONE,
  computeCustomerStats,
  startOfMonthInZone,
  type CustomerRow,
  type CustomerStats,
} from "./customer-directory";
import type { User } from "@/types/user";
import type { Order } from "@/types/order";

const CUSTOMER_LIST_LIMIT = 200;

/** Every registered customer (T166), newest first, for the admin customer list (T167). */
export async function getAllCustomers(limit = CUSTOMER_LIST_LIMIT): Promise<User[]> {
  const snapshot = await usersCollection()
    .where("role", "==", "CUSTOMER")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

/** A single customer by `uid`, or null — for the admin customer detail page (T168). */
export async function getCustomerById(uid: string): Promise<User | null> {
  const snapshot = await usersCollection().doc(uid).get();
  return snapshot.exists ? snapshot.data()! : null;
}

/** Every order placed by a given registered customer, newest first — the admin-side counterpart of `getOrdersForCustomer` (no `uid`-isolation restriction, since this is only ever called after `requireAdmin()`). */
export async function getOrdersForCustomerAdmin(uid: string): Promise<Order[]> {
  const snapshot = await ordersCollection()
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

const DIRECTORY_LIMIT = 200;
const GET_USERS_BATCH = 100;

export type CustomerDirectory = {
  customers: CustomerRow[];
  stats: CustomerStats;
  /** More CUSTOMER accounts exist than were loaded (`DIRECTORY_LIMIT`). */
  truncated: boolean;
};

/**
 * The staff uids among `uids`, judged by the authoritative Firebase Auth role
 * claim (`users/{uid}.role` is only a mirror of it). Fails closed: if the
 * lookup errors, the list errors rather than risk showing a staff account.
 */
async function staffUidsAmong(uids: string[]): Promise<Set<string>> {
  const auth = getAdminAuth();
  const staff = new Set<string>();
  for (let i = 0; i < uids.length; i += GET_USERS_BATCH) {
    const batch = uids.slice(i, i + GET_USERS_BATCH).map((uid) => ({ uid }));
    for (const record of (await auth.getUsers(batch)).users) {
      if (isStaffRole(record.customClaims?.role)) staff.add(record.uid);
    }
  }
  return staff;
}

/**
 * The admin Customers page's data. CUSTOMER accounts only:
 *  - the query is `users where role == "CUSTOMER"`, so OWNER/ADMIN documents
 *    are never read, and guests have no `users` document at all;
 *  - any account whose real Auth claim is staff is dropped as well, in case
 *    its mirror is stale.
 * Orders per customer come from ONE read of the registered-customer orders
 * (`userId != null`, only that field), not a query per customer. When there
 * are more customers than the list loads, total / new-this-month come from
 * aggregation counts and the order-based figures are `null` (they could not
 * be counted correctly), never guessed.
 */
export async function getCustomerDirectory(now: Date = new Date()): Promise<CustomerDirectory> {
  const monthStartMs = startOfMonthInZone(now, STORE_TIME_ZONE);
  const [usersSnapshot, ordersSnapshot] = await Promise.all([
    usersCollection()
      .where("role", "==", "CUSTOMER")
      .orderBy("createdAt", "desc")
      .limit(DIRECTORY_LIMIT + 1)
      .get(),
    getAdminFirestore().collection("orders").where("userId", "!=", null).select("userId").get(),
  ]);

  const truncated = usersSnapshot.docs.length > DIRECTORY_LIMIT;
  const loaded = usersSnapshot.docs.slice(0, DIRECTORY_LIMIT).map((doc) => doc.data());
  const staff = await staffUidsAmong(loaded.map((user) => user.uid));

  const orderCounts = new Map<string, number>();
  for (const doc of ordersSnapshot.docs) {
    const uid = doc.get("userId") as string | null;
    if (uid) orderCounts.set(uid, (orderCounts.get(uid) ?? 0) + 1);
  }

  const customers: CustomerRow[] = loaded
    .filter((user) => !staff.has(user.uid))
    .map((user) => ({
      uid: user.uid,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      createdAt: user.createdAt.toMillis(),
      orderCount: orderCounts.get(user.uid) ?? 0,
    }));

  if (!truncated)
    return { customers, stats: computeCustomerStats(customers, monthStartMs), truncated };

  const everyCustomer = usersCollection().where("role", "==", "CUSTOMER");
  const [total, newThisMonth] = await Promise.all([
    everyCustomer.count().get(),
    everyCustomer.where("createdAt", ">=", Timestamp.fromMillis(monthStartMs)).count().get(),
  ]);
  return {
    customers,
    stats: {
      total: total.data().count,
      newThisMonth: newThisMonth.data().count,
      withOrders: null,
      noOrders: null,
    },
    truncated,
  };
}
