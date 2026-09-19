"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { clientAuth } from "@/lib/firebase/client";
import { logoutAction } from "@/actions/auth.actions";

/**
 * Signs the current user out of the storefront using the existing session
 * architecture:
 *
 *  1. `signOut(clientAuth)` — clears the Firebase client SDK's persisted
 *     user (IndexedDB), which login leaves signed in on the device.
 *  2. `logoutAction()` — deletes the httpOnly session cookie that every
 *     server guard (`getSessionClaims`/`requireUser`/`requireAdmin`) reads.
 *  3. Navigate to the locale's login page and refresh, so every Server
 *     Component (navbar, cart badge, account routes) re-renders signed out.
 *
 * The cookie is the authoritative session, so it is cleared even if the
 * client-SDK sign-out fails. Roles and claims are never touched.
 */
export function AccountSignOutButton({ className }: { className?: string }) {
  const t = useTranslations("Account");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      try {
        await signOut(clientAuth);
      } catch {
        // Continue: the server session below is what actually authorizes.
      }
      await logoutAction();
      router.replace(`/${locale === "ar" ? "ar" : "en"}/login`);
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={handleSignOut} disabled={isPending} className={className} aria-busy={isPending}>
      <LogOut aria-hidden="true" />
      {isPending ? t("signingOut") : t("logout")}
    </button>
  );
}
