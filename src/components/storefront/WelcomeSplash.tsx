"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { SITE_NAME } from "@/lib/config/site";
import { DEMO_SPLASH } from "@/lib/config/demoImages";
import { LanguageSwitcher } from "./LanguageSwitcher";

/** Session flag: set once the customer has entered, so the screen never repeats this session. */
export const SPLASH_SESSION_KEY = "elora_welcome_shown";

/** Attribute the pre-paint script (layout) and `enter()` put on <html> once entered. */
export const SPLASH_ENTERED_ATTR = "data-tia-entered";

/** Fade-out length when entering; matches the `[data-welcome-splash]` transition in globals.css. */
const EXIT_MS = 700;

/**
 * Inline script for the top of <body>: marks <html> as already-entered
 * *before first paint* when this session has entered, so a returning page
 * never flashes the screen. Blocked storage fails closed (treated as
 * entered), matching the component below.
 */
export const SPLASH_PREPAINT_SCRIPT = `try{if(sessionStorage.getItem(${JSON.stringify(SPLASH_SESSION_KEY)})==="1")document.documentElement.setAttribute(${JSON.stringify(SPLASH_ENTERED_ATTR)},"")}catch(e){document.documentElement.setAttribute(${JSON.stringify(SPLASH_ENTERED_ATTR)},"")}`;

function hasEnteredThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "1";
  } catch {
    // Blocked storage: fail closed rather than show it on every navigation.
    return true;
  }
}

/** Entrance-sequence delay, consumed by `.splash-rise` / `.splash-fade`. */
const delay = (ms: number) => ({ "--splash-delay": `${ms}ms` }) as React.CSSProperties;

/**
 * `WelcomeSplash` — TIA's single first-entry screen: a full-viewport
 * cinematic campaign photograph with the brand, the tagline, one ivory
 * ENTER THE COLLECTION action and the EN | AR switch.
 *
 * ── WHY IT IS SERVER-RENDERED OPEN ────────────────────────────────────────
 * It must be the *first* thing a customer sees, so it ships in the initial
 * HTML as an open <dialog> covering the page (not mounted after hydration,
 * which briefly showed the homepage first). `SPLASH_PREPAINT_SCRIPT` hides
 * it before paint for a session that has already entered. Once hydrated it
 * is re-opened with `showModal()` so the platform provides real focus
 * trapping and an inert background.
 *
 * ── HOW IT CLOSES ─────────────────────────────────────────────────────────
 * Only ENTER THE COLLECTION closes it — no auto-dismiss, Escape is
 * swallowed, and a background click does nothing. Entering fades it out
 * (instantly under reduced motion) to reveal the real page underneath,
 * then records the session flag. The EN | AR switch re-localizes the screen
 * through the existing locale routing and leaves it open — choosing a
 * language is not the same as entering.
 *
 * Mounted once in `[locale]/layout.tsx`, which stays mounted across
 * storefront navigation; `/admin/*` has its own root layout and never
 * renders it. Presentational only — no data, cart, auth or Firebase access.
 */
export function WelcomeSplash() {
  const t = useTranslations("Splash");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (hasEnteredThisSession()) {
      dialog.close();
      document.documentElement.setAttribute(SPLASH_ENTERED_ATTR, "");
      setClosed(true);
      return;
    }

    // Upgrade the server-rendered (non-modal) dialog to a real modal.
    try {
      if (!dialog.matches(":modal")) {
        dialog.close();
        dialog.showModal();
      }
    } catch {
      // Already modal, or :modal unsupported — the open dialog still covers the page.
    }
    setReady(true);
  }, []);

  // Focus the CTA once it is enabled — a `disabled` button cannot take
  // focus, so doing this in the effect above (before `ready`) was a no-op.
  useEffect(() => {
    if (ready) ctaRef.current?.focus({ preventScroll: true });
  }, [ready]);

  function enter() {
    if (leaving) return;
    try {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    } catch {
      // Storage blocked — still enter; it may simply show again next load.
    }
    setLeaving(true);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(
      () => {
        dialogRef.current?.close();
        document.documentElement.setAttribute(SPLASH_ENTERED_ATTR, "");
        setClosed(true);
      },
      reduceMotion ? 0 : EXIT_MS,
    );
  }

  if (closed) return null;

  return (
    <dialog
      ref={dialogRef}
      open
      data-welcome-splash=""
      data-ready={ready ? "" : undefined}
      data-leaving={leaving ? "" : undefined}
      // Escape fires `cancel` before `close` — swallow it so only ENTER
      // THE COLLECTION can close this screen.
      onCancel={(event) => event.preventDefault()}
      aria-label={t("title")}
      className="fixed inset-0 z-[100] m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-[#0a1226] p-0 text-text-on-dark backdrop:bg-[#0a1226]"
    >
      {/* The campaign photograph — the model on the end side, facing the
          copy (mirrored back under RTL so she still faces it). */}
      <div aria-hidden="true" className="splash-image absolute inset-0 lg:start-auto lg:w-[68%]">
        <Image
          src={DEMO_SPLASH.desktopUrl}
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 68vw"
          className="hidden object-cover object-[right_center] sm:block rtl:-scale-x-100"
        />
        <Image
          src={DEMO_SPLASH.mobileUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_20%] sm:hidden rtl:-scale-x-100"
        />
      </div>
      <div aria-hidden="true" className="splash-scrim absolute inset-0" />

      {/* Frame details — quiet, secondary. */}
      <div
        style={delay(1500)}
        className="splash-fade pointer-events-none absolute inset-x-0 top-0 flex items-center gap-6 px-6 pt-6 text-[0.5625rem] uppercase tracking-[0.3em] text-text-on-dark/60 sm:px-12 sm:pt-10 rtl:text-xs rtl:normal-case rtl:tracking-normal"
      >
        <span className="shrink-0">{t("established")}</span>
        <span aria-hidden="true" className="hidden h-px max-w-md flex-1 bg-brand-gold/30 sm:block" />
        <span className="ms-auto hidden sm:block">{t("motto")}</span>
      </div>
      <div
        style={delay(1500)}
        className="splash-fade pointer-events-none absolute inset-x-0 bottom-0 hidden justify-between px-12 pb-10 text-[0.5625rem] uppercase tracking-[0.3em] text-text-on-dark/55 sm:flex rtl:text-xs rtl:normal-case rtl:tracking-normal"
      >
        <span>{t("footStart")}</span>
        <span>{t("footEnd")}</span>
      </div>

      {/* The brand and the single action. */}
      <div className="relative flex h-full flex-col items-center justify-end px-6 pb-[max(3.5rem,env(safe-area-inset-bottom))] sm:justify-center sm:pb-0 lg:w-[46%] lg:px-16">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <p
            dir="ltr"
            style={delay(250)}
            className="splash-rise ps-[0.2em] font-display text-[4.5rem] font-light leading-none tracking-[0.2em] sm:text-[6rem] lg:text-[7rem]"
          >
            {SITE_NAME}
          </p>
          <p
            style={delay(450)}
            className="splash-rise mt-4 text-[0.6875rem] uppercase tracking-[0.36em] text-text-on-dark/85 sm:text-sm rtl:text-base rtl:normal-case rtl:tracking-normal"
          >
            {t("tagline")}
          </p>

          {/* Champagne divider with a small four-point spark. */}
          <div aria-hidden="true" style={delay(650)} className="splash-fade mt-7 flex items-center gap-3 text-brand-gold/80">
            <span className="block h-px w-16 bg-current opacity-60 sm:w-24" />
            <svg viewBox="0 0 24 24" className="size-2.5">
              <path d="M12 0 C12.6 7.4 16.6 11.4 24 12 C16.6 12.6 12.6 16.6 12 24 C11.4 16.6 7.4 12.6 0 12 C7.4 11.4 11.4 7.4 12 0Z" fill="currentColor" />
            </svg>
            <span className="block h-px w-16 bg-current opacity-60 sm:w-24" />
          </div>

          <p
            style={delay(800)}
            className="splash-rise mt-7 font-display text-[1.875rem] font-light leading-[1.2] sm:text-4xl lg:text-[2.625rem] rtl:leading-[1.5]"
          >
            <span className="block">{t("headlineLine1")}</span>
            <span className="block">{t("headlineLine2")}</span>
          </p>

          <button
            ref={ctaRef}
            type="button"
            onClick={enter}
            disabled={!ready}
            style={delay(1100)}
            className="splash-rise group/cta mt-10 inline-flex min-h-14 w-full max-w-sm items-center justify-center gap-4 bg-brand-ivory px-8 text-xs font-medium uppercase tracking-[0.24em] text-brand-espresso transition-colors duration-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text-on-dark disabled:cursor-default rtl:text-sm rtl:normal-case rtl:tracking-normal"
          >
            {t("cta")}
            <ArrowRight
              aria-hidden="true"
              size={16}
              strokeWidth={1.5}
              className="transition-transform duration-300 ease-luxury group-hover/cta:translate-x-1 rtl:-scale-x-100 rtl:group-hover/cta:-translate-x-1 motion-reduce:!translate-x-0"
            />
          </button>

          <div style={delay(1300)} className="splash-fade mt-7">
            <LanguageSwitcher className="gap-0 text-text-on-dark [&>button+button]:ms-4 [&>button+button]:border-s [&>button+button]:border-s-brand-gold/40 [&>button+button]:ps-4" />
          </div>
        </div>
      </div>
    </dialog>
  );
}
