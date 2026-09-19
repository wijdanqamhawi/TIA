/**
 * Pure helpers shared by the admin-management CLIs (grant-admin,
 * revoke-admin, list-admins). No Firebase imports here, so every rule the
 * scripts enforce is unit-testable without touching a real project.
 *
 * Authorization itself is unchanged: staff are Firebase Auth users whose
 * custom claims carry `role: "ADMIN"` or `role: "OWNER"` (read by
 * `verifySessionCookie`), with `users/{uid}.role` kept as a display mirror.
 * After handoff the owner manages the team from /admin/team; these scripts
 * are for bootstrapping the first OWNER and for recovery.
 */

import { isStaffRole, type StaffRole } from "../../src/lib/auth/roles";

/** The only Firebase project these scripts may ever touch. */
export const TARGET_PROJECT_ID = "tia-jewllery";

const EMULATOR_ENV_VARS = [
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST",
] as const;

export type CustomClaims = Record<string, unknown>;

/**
 * Checks, before any Firebase call, that the environment points at the real
 * TIA project and nothing else. Returns every problem found (empty = safe),
 * so the caller can print them all rather than just the first.
 */
export function checkTargetEnvironment(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];

  for (const name of EMULATOR_ENV_VARS) {
    if (env[name]) problems.push(`${name} is set — refusing to run against the emulator.`);
  }

  if (env.FIREBASE_PROJECT_ID !== TARGET_PROJECT_ID) {
    problems.push(`FIREBASE_PROJECT_ID must be exactly "${TARGET_PROJECT_ID}".`);
  }
  if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== TARGET_PROJECT_ID) {
    problems.push(`NEXT_PUBLIC_FIREBASE_PROJECT_ID must be exactly "${TARGET_PROJECT_ID}".`);
  }
  // The service-account key itself must belong to the project, not just the
  // project-id variable next to it.
  if (!env.FIREBASE_CLIENT_EMAIL?.endsWith(`@${TARGET_PROJECT_ID}.iam.gserviceaccount.com`)) {
    problems.push(`FIREBASE_CLIENT_EMAIL is not a service account of "${TARGET_PROJECT_ID}".`);
  }
  if (!env.FIREBASE_PRIVATE_KEY) {
    problems.push("FIREBASE_PRIVATE_KEY is missing.");
  }

  return problems;
}

/**
 * Parses the single `<email>` argument, optional boolean flags, and an
 * optional `--role admin|owner`. Rejects anything that looks like a password
 * or a second positional value, so a password can never be passed to these
 * scripts by mistake.
 */
export function parseEmailArgs(
  argv: string[],
  allowedFlags: readonly string[] = [],
  options: { allowRole?: boolean } = {},
): { email: string; flags: Set<string>; role: StaffRole } | { error: string } {
  const flags = new Set<string>();
  const positional: string[] = [];
  let role: StaffRole = "ADMIN";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (options.allowRole && (arg === "--role" || arg.startsWith("--role="))) {
      const value = (arg === "--role" ? argv[++i] : arg.slice("--role=".length))?.toUpperCase();
      if (!isStaffRole(value)) return { error: "--role must be admin or owner." };
      role = value;
    } else if (arg.startsWith("--")) {
      if (!allowedFlags.includes(arg)) return { error: `Unknown option ${arg}.` };
      flags.add(arg);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length === 0) return { error: "Missing <email> argument." };
  if (positional.length > 1) {
    return { error: "Expected exactly one argument: the user's email. Passwords are never accepted." };
  }

  const email = normalizeEmail(positional[0]);
  if (!isPlausibleEmail(email)) return { error: "That does not look like an email address." };

  return { email, flags, role };
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** True for any staff role (ADMIN or OWNER). */
export function isAdminClaims(claims: CustomClaims | undefined | null): boolean {
  return isStaffRole(claims?.role);
}

/** Sets a staff role while keeping any other custom claims intact. */
export function withAdminRole(claims: CustomClaims | undefined | null, role: StaffRole = "ADMIN"): CustomClaims {
  return { ...(claims ?? {}), role };
}

/**
 * Removes the role claim while keeping any other custom claims intact. A
 * missing role is read as CUSTOMER by `verifySessionCookie`. Returns `null`
 * when nothing is left, which clears the claims entirely.
 */
export function withoutAdminRole(claims: CustomClaims | undefined | null): CustomClaims | null {
  const next = { ...(claims ?? {}) };
  delete next.role;
  return Object.keys(next).length ? next : null;
}

/** "someone@gmail.com" -> "so•••@gmail.com", for output that may be shared. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  return `${local.slice(0, 2)}•••@${domain}`;
}
