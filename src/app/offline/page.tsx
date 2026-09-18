"use client";

import { useEffect, useState } from "react";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

const COPY = {
  en: { dir: "ltr" as const, ...enMessages.Pwa },
  ar: { dir: "rtl" as const, ...arMessages.Pwa },
};

function readLocaleCookie(): "en" | "ar" {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/);
  return match?.[1] === "ar" ? "ar" : "en";
}

/**
 * The branded `/offline` navigation fallback (T196, research.md §25,
 * spec FR-081) — precached and configured as Serwist's offline fallback
 * (T192/T193), so it must be a single, non-locale-prefixed URL reachable
 * without a network round trip. It can't render through the `[locale]`
 * layout's server-side `next-intl` provider (that itself needs a request
 * to resolve), so it reads the `NEXT_LOCALE` cookie client-side instead and
 * selects from the same message catalogs statically bundled at build time.
 */
export default function OfflinePage() {
  const [locale, setLocale] = useState<"en" | "ar">("en");

  useEffect(() => {
    const detected = readLocaleCookie();
    setLocale(detected);
    document.documentElement.lang = detected;
    document.documentElement.dir = COPY[detected].dir;
  }, []);

  const t = COPY[locale];

  return (
    <div
      dir={t.dir}
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-ivory px-6 text-center text-text-primary"
    >
      <span dir="ltr" className="font-display text-3xl font-light tracking-[0.3em] text-text-primary">TIA</span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl text-brand-burgundy">{t.offlineTitle}</h1>
        <p className="max-w-md text-sm text-text-primary/70">{t.offlineBody}</p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-11 rounded-md bg-brand-burgundy px-6 py-2.5 font-medium text-text-on-dark transition-colors hover:bg-brand-burgundy-dark"
      >
        {t.offlineRetry}
      </button>
    </div>
  );
}
