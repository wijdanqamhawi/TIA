/**
 * Lists the TIA staff accounts — OWNERs and ADMINs (read-only).
 *
 *   npm run list-admins            emails masked (so•••@gmail.com)
 *   npm run list-admins -- --full  full emails, for your own terminal
 *
 * Shows only what identifies an account and its state — never password
 * hashes, tokens, phone numbers or provider data. Also reports any
 * `users/{uid}` document whose role mirror disagrees with the real claim.
 */
import { maskEmail } from "./admin/core";
import { CliError, connectToTiaProject, listAdminUsers, runCli } from "./admin/runtime";
import { STAFF_ROLES } from "../src/lib/auth/roles";

runCli(async () => {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== "--full");
  if (unknown.length) throw new CliError(`Unknown argument(s): ${unknown.join(" ")}\nUsage: npm run list-admins [-- --full]`);
  const showFull = args.includes("--full");
  const show = (email: string | undefined) => (email ? (showFull ? email : maskEmail(email)) : "(no email)");

  const { auth, usersCollection } = await connectToTiaProject();

  const admins = await listAdminUsers(auth);
  const adminUids = new Set(admins.map((a) => a.uid));
  const owners = admins.filter((a) => a.customClaims?.role === "OWNER").length;

  console.log(`\nStaff (${admins.length}: ${owners} owner, ${admins.length - owners} admin):`);
  if (!admins.length) console.log("  none — create the first owner with: npm run grant-admin -- <email> --role owner");

  for (const admin of admins) {
    const role = String(admin.customClaims?.role);
    const mirror = (await usersCollection().doc(admin.uid).get()).data()?.role ?? "missing";
    const flags = [
      admin.disabled ? "DISABLED" : "active",
      admin.emailVerified ? "email verified" : "email not verified",
      mirror === role ? "mirror ok" : `mirror says ${mirror}`,
    ];
    console.log(`  - ${role.padEnd(5)}  ${show(admin.email)}  uid ${admin.uid}`);
    console.log(`      ${flags.join(" | ")}`);
    console.log(
      `      created ${admin.metadata.creationTime}  |  last sign-in ${admin.metadata.lastSignInTime ?? "never"}`,
    );
  }

  // Firestore docs claiming a staff role without the claim: harmless (the
  // claim is what authorizes), but worth fixing with revoke-admin.
  const stale = (await usersCollection().where("role", "in", [...STAFF_ROLES]).get()).docs.filter(
    (doc) => !adminUids.has(doc.id),
  );
  if (stale.length) {
    console.log(`\nStale role mirrors (${stale.length}) — users/{uid}.role says staff but the account has no staff claim:`);
    for (const doc of stale) console.log(`  - ${show(doc.data().email)}  uid ${doc.id}`);
    console.log("  Fix each with: npm run revoke-admin -- <email>");
  }
});
