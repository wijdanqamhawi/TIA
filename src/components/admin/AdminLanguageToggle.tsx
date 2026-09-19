"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { setAdminLocaleAction } from "@/actions/admin/locale.actions";

/**
 * EN/AR switch for the admin dashboard. The choice is stored server-side in
 * a cookie; a refresh re-renders the layout with the new `lang`/`dir`.
 */
export function AdminLanguageToggle() {
  const t = useTranslations("AdminShell");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const next = locale === "ar" ? "en" : "ar";

  function handleSwitch() {
    startTransition(async () => {
      const result = await setAdminLocaleAction(next);
      if (result.ok) router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleSwitch}
      disabled={isPending}
      lang={next}
      aria-label={t("switchToLabel")}
      // The target language is shown in its own script, so neither uppercase
      // nor letter-spacing applies.
      className="normal-case tracking-normal"
    >
      {t("switchTo")}
    </Button>
  );
}
