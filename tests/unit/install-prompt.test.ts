import { describe, expect, it } from "vitest";
import {
  detectInstallPlatform,
  isRecentlyDismissed,
  shouldShowInstallPrompt,
  INSTALL_DISMISS_COOLDOWN_MS,
} from "@/lib/pwa/install-prompt";

/** T199: install-suppression logic (already installed / unsupported / recently dismissed). */

describe("detectInstallPlatform", () => {
  it("returns 'chromium' whenever beforeinstallprompt has fired, regardless of UA", () => {
    expect(detectInstallPlatform("Mozilla/5.0 (iPhone)", true)).toBe("chromium");
  });

  it("returns 'ios' for an iPhone/iPad/iPod UA when the event never fired", () => {
    expect(detectInstallPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", false)).toBe("ios");
    expect(detectInstallPlatform("Mozilla/5.0 (iPad; CPU OS 17_0)", false)).toBe("ios");
  });

  it("returns 'unsupported' for a desktop Safari UA with no install event", () => {
    expect(detectInstallPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Safari", false)).toBe(
      "unsupported",
    );
  });
});

describe("isRecentlyDismissed", () => {
  const now = 1_000_000_000_000;

  it("is false when never dismissed", () => {
    expect(isRecentlyDismissed(null, now)).toBe(false);
  });

  it("is true within the cooldown window", () => {
    expect(isRecentlyDismissed(now - 1000, now)).toBe(true);
    expect(isRecentlyDismissed(now - (INSTALL_DISMISS_COOLDOWN_MS - 1), now)).toBe(true);
  });

  it("is false once the cooldown has elapsed", () => {
    expect(isRecentlyDismissed(now - INSTALL_DISMISS_COOLDOWN_MS, now)).toBe(false);
    expect(isRecentlyDismissed(now - (INSTALL_DISMISS_COOLDOWN_MS + 1), now)).toBe(false);
  });
});

describe("shouldShowInstallPrompt", () => {
  const now = 1_000_000_000_000;

  it("never shows when already running standalone (installed)", () => {
    expect(
      shouldShowInstallPrompt({ isStandalone: true, platform: "chromium", dismissedAtMs: null, nowMs: now }),
    ).toBe(false);
  });

  it("never shows on an unsupported platform, even if not standalone/dismissed", () => {
    expect(
      shouldShowInstallPrompt({ isStandalone: false, platform: "unsupported", dismissedAtMs: null, nowMs: now }),
    ).toBe(false);
  });

  it("does not show again within the dismissal cooldown", () => {
    expect(
      shouldShowInstallPrompt({
        isStandalone: false,
        platform: "chromium",
        dismissedAtMs: now - 1000,
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("shows for a supported, non-standalone, non-recently-dismissed platform", () => {
    expect(
      shouldShowInstallPrompt({ isStandalone: false, platform: "chromium", dismissedAtMs: null, nowMs: now }),
    ).toBe(true);
    expect(
      shouldShowInstallPrompt({ isStandalone: false, platform: "ios", dismissedAtMs: null, nowMs: now }),
    ).toBe(true);
  });

  it("shows again once the dismissal cooldown has elapsed", () => {
    expect(
      shouldShowInstallPrompt({
        isStandalone: false,
        platform: "chromium",
        dismissedAtMs: now - INSTALL_DISMISS_COOLDOWN_MS - 1,
        nowMs: now,
      }),
    ).toBe(true);
  });
});
