"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils/cn";

/**
 * AR | EN switcher (spec FR-067). Navigating via next-intl's locale-aware
 * router to the equivalent `/ar/...`/`/en/...` path sets the `NEXT_LOCALE`
 * cookie through the routing middleware (T026) — no separate cookie write
 * needed here.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className={cn("inline-flex items-center gap-1 text-sm", className)} aria-label={t("label")}>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          aria-current={loc === locale ? "true" : undefined}
          onClick={() => router.replace(pathname, { locale: loc })}
          className={cn(
            "min-h-11 px-1.5 py-1 text-xs font-medium text-current transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
            loc === locale
              ? "border-b border-current opacity-100"
              : "opacity-75 hover:opacity-100",
          )}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
