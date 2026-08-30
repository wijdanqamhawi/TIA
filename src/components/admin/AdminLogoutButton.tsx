"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/Button";

export function AdminLogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      router.push("/en/login");
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleLogout} disabled={isPending}>
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
