"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useReserveBottomInset } from "@/components/storefront/ViewportInsets";
import {
  INSTALL_DISMISS_STORAGE_KEY,
  detectInstallPlatform,
  shouldShowInstallPrompt,
  type InstallPlatform,
} from "@/lib/pwa/install-prompt";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(INSTALL_DISMISS_STORAGE_KEY);
    return raw ? Number.parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

function writeDismissedNow(): void {
  try {
    window.localStorage.setItem(INSTALL_DISMISS_STORAGE_KEY, String(Date.now()));
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts;
    // worst case the prompt reappears next visit, never a functional break.
  }
}

function isCurrentlyStandalone(): boolean {
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mediaStandalone || iosStandalone;
}

/**
 * `InstallPrompt` (T197, research.md §26, spec FR-058–FR-060): a small,
 * non-aggressive install call-to-action. Never shown once already
 * installed (standalone), on a platform with no install path, or within
 * the 14-day cooldown after a dismissal. Chromium-family browsers get the
 * real one-tap `beforeinstallprompt` flow; iOS Safari (which never fires
 * that event) gets accurate manual "Add to Home Screen" instructions
 * instead of a non-functional button.
 */
export function InstallPrompt() {
  const t = useTranslations("Pwa");
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<InstallPlatform>("unsupported");
  const [visible, setVisible] = useState(false);
  // Reserves the bottom band this banner occupies (its measured height
  // plus its own `bottom-4` offset) so `FloatingWhatsApp` shifts above it
  // instead of overlapping (research.md §30).
  const insetRef = useReserveBottomInset("pwa-install-prompt", visible, 16);

  useEffect(() => {
    function evaluate(nextPlatform: InstallPlatform) {
      setPlatform(nextPlatform);
      setVisible(
        shouldShowInstallPrompt({
          isStandalone: isCurrentlyStandalone(),
          platform: nextPlatform,
          dismissedAtMs: readDismissedAt(),
          nowMs: Date.now(),
        }),
      );
    }

    evaluate(detectInstallPlatform(window.navigator.userAgent, false));

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
      evaluate("chromium");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  function handleDismiss() {
    writeDismissedNow();
    setVisible(false);
  }

  async function handleInstall() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    writeDismissedNow();
    setDeferredEvent(null);
    setVisible(false);
  }

  if (!visible) return null;

  const isIos = platform === "ios";

  return (
    <div
      ref={insetRef}
      role="dialog"
      aria-label={isIos ? t("iosTitle") : t("installTitle")}
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-sm items-start gap-3 rounded-lg border border-border-luxury bg-brand-ivory p-4 shadow-xl sm:inset-x-auto sm:end-4"
    >
      <div className="flex-1">
        <p className="font-display text-base text-text-primary">{isIos ? t("iosTitle") : t("installTitle")}</p>
        <p className="mt-1 text-sm text-text-primary/70">{isIos ? t("iosBody") : t("installBody")}</p>
        {!isIos ? (
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={handleInstall}>
              {t("installButton")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDismiss}>
              {t("dismissButton")}
            </Button>
          </div>
        ) : (
          <div className="mt-3">
            <Button type="button" variant="outline" size="sm" onClick={handleDismiss}>
              {t("iosDismiss")}
            </Button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("dismissButton")}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-text-primary/70 hover:bg-brand-beige focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-burgundy"
      >
        <X aria-hidden="true" size={18} />
      </button>
    </div>
  );
}
