"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { logoutAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/Button";

export function AdminLogoutButton() {
  const router = useRouter();
  const t = useTranslations("AdminShell");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      router.push(`/${locale === "ar" ? "ar" : "en"}/login`);
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleLogout} disabled={isPending}>
      {isPending ? t("signingOut") : t("signOut")}
    </Button>
  );
}
