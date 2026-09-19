/**
 * Removes admin access from a TIA account (one per run).
 *
 *   npm run revoke-admin -- someone@gmail.com
 *
 * Removes the `role` custom claim (a missing role reads as CUSTOMER), sets
 * `users/{uid}.role` back to CUSTOMER, and revokes the user's sessions so
 * the change takes effect immediately rather than when their 14-day session
 * cookie expires. The account itself — and its password — are untouched.
 *
 * Works for ADMIN and OWNER alike. Refuses to remove the LAST OWNER (nobody
 * could manage the team any more) or the last staff member of any role,
 * unless `--allow-last` is given — a recovery-only escape hatch.
 */
import { FieldValue } from "firebase-admin/firestore";
import { isAdminClaims, parseEmailArgs, withoutAdminRole } from "./admin/core";
import { isOwnerRole } from "../src/lib/auth/roles";
import {
  CliError,
  confirmChange,
  connectToTiaProject,
  findUserByEmail,
  listAdminUsers,
  runCli,
} from "./admin/runtime";

runCli(async () => {
  const parsed = parseEmailArgs(process.argv.slice(2), ["--yes", "--allow-last"]);
  if ("error" in parsed) {
    throw new CliError(`${parsed.error}\nUsage: npm run revoke-admin -- <email> [--yes] [--allow-last]`);
  }
  const { email, flags } = parsed;

  const { auth, usersCollection } = await connectToTiaProject();

  const user = await findUserByEmail(auth, email);
  if (!user) {
    throw new CliError(`No TIA account exists for ${email}. Nothing was changed.`);
  }

  const userRef = usersCollection().doc(user.uid);
  const profile = await userRef.get();

  if (!isAdminClaims(user.customClaims)) {
    // Not an admin already; just make sure the display mirror agrees.
    if (profile.exists && profile.data()?.role === "ADMIN") {
      await userRef.update({ role: "CUSTOMER", updatedAt: FieldValue.serverTimestamp() });
      console.log(`${email} was not an admin; corrected a stale users/${user.uid}.role mirror to CUSTOMER.`);
    } else {
      console.log(`${email} (${user.uid}) is not an admin. Nothing was changed.`);
    }
    return 0;
  }

  const admins = await listAdminUsers(auth);
  const ownerCount = admins.filter((admin) => isOwnerRole(admin.customClaims?.role)).length;
  const isLastOwner = isOwnerRole(user.customClaims?.role) && ownerCount <= 1;
  if ((isLastOwner || admins.length <= 1) && !flags.has("--allow-last")) {
    throw new CliError(
      `${email} is the ${isLastOwner ? "last owner" : "only admin"}. Removing them would leave nobody able to ` +
        `${isLastOwner ? "manage the admin team" : "use /admin"}.\n` +
        "Make someone else an owner first, or re-run with --allow-last if that is really intended.",
    );
  }

  if (!(await confirmChange(`Remove ADMIN from ${email}`, email, flags.has("--yes")))) {
    console.log("Not confirmed. Nothing was changed.");
    return 1;
  }

  await auth.setCustomUserClaims(user.uid, withoutAdminRole(user.customClaims));
  // Revoke straight after the claim, before anything that could fail.
  await auth.revokeRefreshTokens(user.uid);
  if (profile.exists) {
    await userRef.update({ role: "CUSTOMER", updatedAt: FieldValue.serverTimestamp() });
  }

  console.log(`Removed ${String(user.customClaims?.role)} access from ${email} (${user.uid}).`);
  console.log("  - custom claim role removed (reads as CUSTOMER)");
  console.log(
    profile.exists ? `  - users/${user.uid}.role set to CUSTOMER` : `  - no users/${user.uid} document to update`,
  );
  console.log("  - existing sessions revoked: /admin access ends on their next request");
  return 0;
});
