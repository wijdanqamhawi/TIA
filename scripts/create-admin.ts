/**
 * Idempotent first-administrator bootstrap (research.md §21). Reads
 * ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD from the environment,
 * creates (or reuses) the corresponding Firebase Authentication user, sets
 * the `role: "ADMIN"` custom claim, and mirrors it onto `users/{uid}`.
 *
 * There is no public "register as admin" route — this script is the only
 * way an ADMIN account is ever created (Constitution Principle 6).
 *
 * Usage: npm run create-admin
 */
import "dotenv/config";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth } from "../src/lib/firebase/admin";
import { usersCollection } from "../src/lib/firebase/firestore";

async function main() {
  const adminAuth = getAdminAuth();
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email || !password) {
    console.error("Missing ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD in the environment.");
    process.exitCode = 1;
    return;
  }

  let userRecord;
  try {
    userRecord = await adminAuth.getUserByEmail(email);
    console.log(`Found existing Firebase Auth user for ${email} (${userRecord.uid}).`);
  } catch {
    userRecord = await adminAuth.createUser({
      email,
      password,
      emailVerified: true,
    });
    console.log(`Created Firebase Auth user for ${email} (${userRecord.uid}).`);
  }

  await adminAuth.setCustomUserClaims(userRecord.uid, { role: "ADMIN" });
  console.log(`Set role: "ADMIN" custom claim on ${userRecord.uid}.`);

  const userRef = usersCollection().doc(userRecord.uid);
  const existing = await userRef.get();

  if (existing.exists) {
    await userRef.set({ role: "ADMIN", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    await userRef.set({
      id: userRecord.uid,
      uid: userRecord.uid,
      name: userRecord.displayName ?? "Admin",
      email,
      phone: null,
      role: "ADMIN",
      profile: { address: null },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  console.log(`Mirrored role: "ADMIN" onto users/${userRecord.uid}. Done.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("create-admin failed:", err);
    process.exit(1);
  });
