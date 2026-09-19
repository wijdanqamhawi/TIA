/**
 * Shared bootstrap for the admin-management CLIs. Loads `.env.local`
 * explicitly (never `.env`, never `dotenv/config`), refuses to continue
 * unless it points at the real TIA project, and only then imports the
 * app's own Firebase Admin helpers — so no Firebase client is ever created
 * against the wrong target.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { checkTargetEnvironment, isAdminClaims, TARGET_PROJECT_ID } from "./core";

export class CliError extends Error {}

export async function connectToTiaProject() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    throw new CliError(`.env.local not found at ${envPath}. Run from the project root.`);
  }
  // Existing process env wins over the file, so an emulator variable set in
  // the shell is still seen — and rejected — by the check below.
  process.loadEnvFile(envPath);

  const problems = checkTargetEnvironment(process.env);
  if (problems.length) {
    throw new CliError(`Refusing to run:\n  - ${problems.join("\n  - ")}`);
  }

  const [{ getAdminAuth }, { usersCollection }] = await Promise.all([
    import("../../src/lib/firebase/admin"),
    import("../../src/lib/firebase/firestore"),
  ]);

  console.log(`Target Firebase project: ${TARGET_PROJECT_ID}`);
  return { auth: getAdminAuth(), usersCollection };
}

/** Looks a user up by email; `null` when no such account exists. */
export async function findUserByEmail(auth: Awaited<ReturnType<typeof connectToTiaProject>>["auth"], email: string) {
  try {
    return await auth.getUserByEmail(email);
  } catch (err) {
    if ((err as { code?: string }).code === "auth/user-not-found") return null;
    throw err;
  }
}

/** Every Auth user whose custom claims carry `role: "ADMIN"` (paged). */
export async function listAdminUsers(auth: Awaited<ReturnType<typeof connectToTiaProject>>["auth"]) {
  const admins = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    admins.push(...page.users.filter((u) => isAdminClaims(u.customClaims)));
    pageToken = page.pageToken;
  } while (pageToken);
  return admins;
}

/**
 * Asks the operator to retype the email before a change. `--yes` skips the
 * prompt; without a terminal and without `--yes`, the change is refused.
 */
export async function confirmChange(action: string, email: string, skip: boolean): Promise<boolean> {
  if (skip) return true;
  if (!process.stdin.isTTY) {
    console.error("No interactive terminal: re-run with --yes to confirm.");
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${action} on ${TARGET_PROJECT_ID}. Type the email again to confirm: `);
  rl.close();
  return answer.trim().toLowerCase() === email;
}

/** Runs a CLI body with uniform, credential-free error output. */
export function runCli(main: () => Promise<number | void>) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      if (err instanceof CliError) console.error(err.message);
      else console.error("Failed:", (err as { code?: string }).code ?? (err as Error).message);
      process.exit(1);
    });
}
