import { sendPasswordResetEmail, type Auth } from "firebase/auth";
import { mapAuthErrorToKey, type AuthErrorKey } from "./auth-error";

export type PasswordResetOutcome = { ok: true } | { ok: false; errorKey: AuthErrorKey };

/**
 * Asks Firebase Authentication to email a password-reset link (Firebase owns
 * the token, the email and the hosted reset page).
 *
 * An unregistered email is reported as success, identical to a registered one,
 * so this can never be used to discover which emails have accounts. Only
 * failures unrelated to the account's existence (malformed address, rate
 * limiting, network) are surfaced.
 *
 * `languageCode` makes Firebase send the email and reset page in that language.
 */
export async function requestPasswordReset(
  auth: Auth,
  email: string,
  languageCode?: string,
  send: typeof sendPasswordResetEmail = sendPasswordResetEmail,
): Promise<PasswordResetOutcome> {
  if (languageCode) {
    auth.languageCode = languageCode;
  }
  try {
    await send(auth, email.trim());
    return { ok: true };
  } catch (err) {
    if ((err as { code?: string })?.code === "auth/user-not-found") {
      return { ok: true };
    }
    return { ok: false, errorKey: mapAuthErrorToKey(err) };
  }
}
