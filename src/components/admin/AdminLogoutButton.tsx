"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth.actions";
import { DirectionalIcon } from "@/components/ui/DirectionalIcon";

export function AdminLogoutButton({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
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
    <button type="button" onClick={handleLogout} disabled={isPending} className={className}>
      <DirectionalIcon icon={LogOut} aria-hidden="true" className={iconClassName} />
      <span>{isPending ? t("signingOut") : t("signOut")}</span>
    </button>
  );
}
