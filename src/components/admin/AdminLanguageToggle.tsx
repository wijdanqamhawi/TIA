"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { setAdminLocaleAction } from "@/actions/admin/locale.actions";
import type { AdminLocale } from "@/lib/i18n/admin";

const LOCALES: readonly AdminLocale[] = ["en", "ar"];
/** The compact label on the pill — each language in its own script. */
const SHORT_LABEL: Record<AdminLocale, string> = { en: "EN", ar: "عربي" };

/**
 * EN/AR language menu for the admin dashboard. The choice is stored
 * server-side in a cookie; a refresh re-renders the layout with the new
 * `lang`/`dir`.
 */
export function AdminLanguageToggle() {
  const t = useTranslations("AdminShell");
  const locale = useLocale() as AdminLocale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function switchTo(next: AdminLocale) {
    setOpen(false);
    if (next === locale) return;
    startTransition(async () => {
      const result = await setAdminLocaleAction(next);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={isPending}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("language")}
        className={cn(
          "flex h-11 items-center gap-2 rounded-full bg-brand-cream px-4 text-[14.5px] text-brand-burgundy transition-colors hover:bg-brand-beige lg:h-[38px] lg:px-3.5 lg:text-[13.5px]",
          isPending && "opacity-60",
        )}
      >
        <span lang={locale}>{SHORT_LABEL[locale]}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 stroke-[1.6] transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <ul className="absolute end-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-xl border border-brand-burgundy/[0.08] bg-white p-1.5 shadow-elev-3">
          {LOCALES.map((option) => (
            <li key={option}>
              <button
                type="button"
                lang={option}
                aria-current={option === locale ? "true" : undefined}
                onClick={() => switchTo(option)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-start text-[14px] text-brand-burgundy hover:bg-brand-cream"
              >
                {t(`languageNames.${option}`)}
                {option === locale ? (
                  <Check aria-hidden="true" className="size-4 text-brand-gold" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
