"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "@/components/ui/SocialIcons";

const SPLASH_SESSION_KEY = "elora_welcome_shown";

/** `true` once this tab's session has already shown the welcome screen — checked and set together so a rapid double-mount (React StrictMode, fast client-side nav) can never show it twice. */
function claimFirstVisitOfSession(): boolean {
  try {
    if (window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "1") {
      return false;
    }
    window.sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    return true;
  } catch {
    // sessionStorage can throw in private-browsing/blocked-storage contexts
    // — fail closed (never show) rather than risk showing the screen on
    // every single navigation for a shopper whose browser blocks storage.
    return false;
  }
}

/**
 * `WelcomeSplash`: a permanent, full-screen first-entry welcome screen — a
 * deep burgundy backdrop with a centered, elevated cream card holding the
 * official logo, tagline, and two large actions ("Shop Now" and
 * "WhatsApp"). Shown at most once per browser tab session (`sessionStorage`,
 * never a cookie/server value), so it never interferes with routing, PWA
 * precaching, auth, cart, wishlist, or Firebase — it is a purely
 * client-side, presentational overlay mounted once in `[locale]/layout.tsx`
 * (the storefront's own layout only — `/admin/*` uses a separate root
 * layout that never renders this component at all, so admin routes never
 * show it) that renders nothing at all once its one-time condition is
 * already spent, adding no delay to any other page. Because the layout
 * that mounts it stays mounted across every client-side storefront
 * navigation, it is never re-evaluated on ordinary in-app browsing after
 * "Shop Now" is clicked — only a fresh top-level page load can ever trigger
 * it again, and even then only once sessionStorage has been cleared.
 *
 * This is deliberately **not** a timed splash: there is no auto-dismiss and
 * no other way to close it — not Escape, not a background click, not the
 * logo (rendered here as a plain, non-interactive image, never a link, so
 * there is no accidental second exit route). "Shop Now" is the only action
 * that enters the storefront; "WhatsApp" opens the store's existing
 * configured WhatsApp link (`buildWhatsAppHref`, the exact same one
 * `FloatingWhatsApp` uses, computed once in the layout and passed down —
 * never a second copy of that URL) in a new tab and leaves this screen
 * exactly as it was, since contacting the store isn't "entering" it. The
 * WhatsApp button doesn't render at all when unconfigured (fails safe, the
 * same contract every other WhatsApp control in this app already follows).
 *
 * Built on the native `<dialog>` element directly (the same accessible-
 * dialog approach `components/ui/Dialog.tsx` already establishes elsewhere
 * in this app: `showModal()` gives real focus trapping for free from the
 * platform) rather than that component's own small centered-modal
 * card/header layout, which isn't styled for a full-viewport brand moment.
 */
export function WelcomeSplash({ whatsappHref }: { whatsappHref: string | null }) {
  const t = useTranslations("Splash");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (!claimFirstVisitOfSession()) return;
    setShouldRender(true);
  }, []);

  useEffect(() => {
    if (!shouldRender) return;
    dialogRef.current?.showModal();
    ctaRef.current?.focus();
  }, [shouldRender]);

  function enterStore() {
    dialogRef.current?.close();
    setShouldRender(false);
  }

  if (!shouldRender) return null;

  return (
    <dialog
      ref={dialogRef}
      // Escape fires the native `cancel` event before `close` — swallow it
      // so the platform can never close this screen on its own; "Shop Now"
      // (below) is the only way in, per this screen's own requirement.
      onCancel={(e) => e.preventDefault()}
      aria-label={t("title")}
      className="m-0 h-full max-h-none w-full max-w-none overflow-y-auto border-0 bg-gradient-to-b from-brand-burgundy via-brand-burgundy-dark to-brand-burgundy-dark p-0 backdrop:bg-brand-burgundy-dark"
    >
      <div className="flex min-h-full w-full items-center justify-center px-4 py-10 sm:px-6">
        <div className="animate-elora-splash-rise w-full max-w-sm rounded-2xl border border-brand-gold/40 bg-brand-ivory px-6 py-10 text-center shadow-2xl sm:max-w-md sm:px-10 sm:py-12">
          <Image
            src="/brand/logo.svg"
            alt="ELORA JEWELLERY"
            width={160}
            height={40}
            priority
            className="mx-auto h-auto w-36 sm:w-44"
            style={{ transform: "none" }}
          />

          <span
            aria-hidden="true"
            className="animate-elora-splash-line mx-auto mt-6 block h-px overflow-hidden bg-brand-gold"
          />

          <p className="mx-auto mt-6 max-w-xs font-display text-lg text-brand-burgundy sm:text-xl">
            {t("tagline")}
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <button
              ref={ctaRef}
              type="button"
              onClick={enterStore}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-brand-gold bg-brand-burgundy px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-text-on-dark transition-colors hover:bg-brand-burgundy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
            >
              {t("cta")}
            </button>

            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-brand-burgundy bg-transparent px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-brand-burgundy transition-colors hover:bg-brand-burgundy hover:text-text-on-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
              >
                <WhatsAppIcon size={18} />
                {t("whatsapp")}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </dialog>
  );
}
