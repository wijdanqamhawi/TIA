/**
 * Pure install-prompt suppression logic (T197/T199, research.md §26,
 * spec FR-058–FR-060) — kept free of any DOM/browser API so it's directly
 * unit-testable, and so the actual suppression rule lives in exactly one
 * place `InstallPrompt.tsx` calls into, never duplicated inline.
 */

export const INSTALL_DISMISS_STORAGE_KEY = "elora-install-dismissed-at";

/** 14 days — "avoid repeatedly showing installation prompts" without permanently hiding it. */
export const INSTALL_DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export type InstallPlatform = "chromium" | "ios" | "unsupported";

/** Chromium-family install path (`beforeinstallprompt` fired) takes priority over iOS UA sniffing. */
export function detectInstallPlatform(userAgent: string, beforeInstallPromptFired: boolean): InstallPlatform {
  if (beforeInstallPromptFired) return "chromium";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  return "unsupported";
}

export function isRecentlyDismissed(dismissedAtMs: number | null, nowMs: number): boolean {
  if (dismissedAtMs == null) return false;
  return nowMs - dismissedAtMs < INSTALL_DISMISS_COOLDOWN_MS;
}

/**
 * The single suppression rule: never show the install UI when already
 * running standalone (installed), when the platform offers no install
 * path at all, or when the shopper dismissed it within the cooldown.
 */
export function shouldShowInstallPrompt(params: {
  isStandalone: boolean;
  platform: InstallPlatform;
  dismissedAtMs: number | null;
  nowMs: number;
}): boolean {
  if (params.isStandalone) return false;
  if (params.platform === "unsupported") return false;
  if (isRecentlyDismissed(params.dismissedAtMs, params.nowMs)) return false;
  return true;
}
