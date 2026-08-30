import type { Timestamp } from "firebase-admin/firestore";

export type UserRole = "CUSTOMER" | "ADMIN";

export type UserAddress = {
  regionId: string;
  locationId: string;
  addressLine: string;
  notes: string | null;
};

/**
 * `users/{uid}` (data-model.md). Document ID is the Firebase Auth `uid` —
 * no separate application-generated user id. Guests are never persisted
 * here.
 */
export type User = {
  id: string; // mirrors `uid`
  uid: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  profile: {
    address: UserAddress | null;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
