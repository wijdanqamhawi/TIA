/**
 * The role vocabulary shared by the server guards, the Firestore mirror,
 * the admin Team UI and the admin CLIs. Pure (no server-only imports), so
 * it is safe to use anywhere.
 *
 * Authorization always comes from the Firebase Auth custom claim `role`;
 * `users/{uid}.role` only mirrors it for display and querying.
 *
 *   OWNER  — everything an ADMIN can do, plus managing the admin team.
 *   ADMIN  — the full admin dashboard (catalog, orders, customers, …).
 *   CUSTOMER — the default; also what a missing/unknown claim reads as.
 */
export type UserRole = "CUSTOMER" | "ADMIN" | "OWNER";

/** Roles that may enter the admin dashboard. */
export type StaffRole = Extract<UserRole, "ADMIN" | "OWNER">;

export const STAFF_ROLES: readonly StaffRole[] = ["OWNER", "ADMIN"];

/** Any unrecognised or missing value is a CUSTOMER — never an escalation. */
export function toUserRole(value: unknown): UserRole {
  return value === "OWNER" || value === "ADMIN" ? value : "CUSTOMER";
}

export function isStaffRole(role: unknown): role is StaffRole {
  return role === "OWNER" || role === "ADMIN";
}

export function isOwnerRole(role: unknown): role is "OWNER" {
  return role === "OWNER";
}
