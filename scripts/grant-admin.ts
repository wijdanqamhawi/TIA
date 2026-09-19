/**
 * Grants staff access to an EXISTING TIA account (one per run).
 *
 *   npm run grant-admin -- someone@gmail.com               role ADMIN
 *   npm run grant-admin -- someone@gmail.com --role owner  role OWNER
 *
 * Mainly for handoff: creating the client's first OWNER, who then manages
 * the rest of the team from /admin/team. Never lowers a role — demotions go
 * through the dashboard (or revoke-admin), where the last-owner rule applies.
 *
 * The person registers on the storefront first with their own email and
 * password; this script never creates accounts and never sees a password.
 * It sets the `role` custom claim (the real authorization check), keeps any
 * other claims, mirrors `users/{uid}.role`, and revokes the user's existing
 * sessions so their next sign-in carries the new role immediately.
 */
import { FieldValue } from "firebase-admin/firestore";
import { parseEmailArgs, withAdminRole } from "./admin/core";
import { CliError, confirmChange, connectToTiaProject, findUserByEmail, runCli } from "./admin/runtime";
import { isOwnerRole, toUserRole } from "../src/lib/auth/roles";

runCli(async () => {
  const parsed = parseEmailArgs(process.argv.slice(2), ["--yes"], { allowRole: true });
  if ("error" in parsed) {
    throw new CliError(`${parsed.error}\nUsage: npm run grant-admin -- <email> [--role admin|owner] [--yes]`);
  }
  const { email, flags, role } = parsed;

  const { auth, usersCollection } = await connectToTiaProject();

  const user = await findUserByEmail(auth, email);
  if (!user) {
    throw new CliError(
      `No TIA account exists for ${email}. Nothing was changed and no account was created.\n` +
        "Ask them to register on the storefront (/register) with their own password, then re-run.",
    );
  }
  if (user.disabled) {
    throw new CliError(`The account for ${email} is disabled. Re-enable it in the Firebase console first.`);
  }

  const currentRole = toUserRole(user.customClaims?.role);
  if (isOwnerRole(currentRole) && role === "ADMIN") {
    throw new CliError(`${email} is an OWNER. This script never lowers a role — use /admin/team or revoke-admin.`);
  }
  const alreadyHasRole = currentRole === role;

  if (!alreadyHasRole) {
    if (!(await confirmChange(`Grant ${role} to ${email}`, email, flags.has("--yes")))) {
      console.log("Not confirmed. Nothing was changed.");
      return 1;
    }
    await auth.setCustomUserClaims(user.uid, withAdminRole(user.customClaims, role));
    // Revoke straight after the claim: session cookies keep the claims they
    // were minted with, so this makes the new role apply on the next sign-in.
    await auth.revokeRefreshTokens(user.uid);
  }

  // Keep the Firestore mirror in step either way (it is display-only; the
  // claim above is what `requireAdmin()` / `requireOwner()` actually check).
  const userRef = usersCollection().doc(user.uid);
  const existing = await userRef.get();
  if (existing.exists) {
    await userRef.update({ role, updatedAt: FieldValue.serverTimestamp() });
  } else {
    await userRef.set({
      id: user.uid,
      uid: user.uid,
      name: user.displayName ?? "Admin",
      email,
      phone: null,
      role,
      profile: { address: null },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  if (alreadyHasRole) {
    console.log(`${email} (${user.uid}) is already ${role}. users/${user.uid}.role confirmed as ${role}.`);
    return 0;
  }

  console.log(`Granted ${role} to ${email} (${user.uid}).`);
  console.log(`  - custom claim role: ${role} set (other claims kept)`);
  console.log(`  - users/${user.uid}.role synced to ${role}`);
  console.log("  - existing sessions revoked: they must sign in again to use /admin");
  return 0;
});
