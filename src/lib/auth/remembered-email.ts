/**
 * "Remember me" for the customer login form — the EMAIL ADDRESS only, kept in
 * this browser's localStorage so it survives logout and browser restarts.
 *
 * Deliberately never stores a password, a token or anything session-related,
 * and has no connection to the `__session` / `__admin_session` cookies.
 * Every access is wrapped: storage can be blocked or throw (private windows,
 * cleared site data), and the login form must work without it.
 */
export const REMEMBERED_EMAIL_STORAGE_KEY = "tia:customer-login-email";

const MAX_EMAIL_LENGTH = 254;

function isPlausibleEmail(value: string): boolean {
  return value.length > 0 && value.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@]+$/.test(value);
}

export function readRememberedEmail(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): string {
  try {
    const value = storage?.getItem(REMEMBERED_EMAIL_STORAGE_KEY)?.trim() ?? "";
    return isPlausibleEmail(value) ? value : "";
  } catch {
    return "";
  }
}

export function rememberEmail(email: string, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  const value = email.trim();
  if (!isPlausibleEmail(value)) return;
  try {
    storage?.setItem(REMEMBERED_EMAIL_STORAGE_KEY, value);
  } catch {
    // Storage unavailable: the email simply isn't remembered.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
