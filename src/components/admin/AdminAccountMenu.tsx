"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { StaffRole } from "@/lib/auth/roles";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";

/** The signed-in staff member, as read from their session and `users/{uid}` document. */
export type AdminAccount = {
  name: string | null;
  email: string | null;
  role: StaffRole;
};

/** The name to greet and label the account with — the profile name, else the email, else the role. */
export function accountDisplayName(account: AdminAccount): string | null {
  return account.name?.trim() || account.email || null;
}

/**
 * Sidebar-foot identity block: avatar initial, name and role, opening a
 * small menu (upwards) with the account email and Logout. Everything shown
 * comes from the real signed-in account.
 */
export function AdminAccountMenu({ account }: { account: AdminAccount }) {
  const t = useTranslations("AdminShell");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const roleLabel = t(`roles.${account.role}`);
  const displayName = accountDisplayName(account) ?? roleLabel;
  const initial = Array.from(displayName)[0]?.toLocaleUpperCase() ?? "";

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

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <div className="absolute inset-x-0 bottom-full z-10 mb-2 overflow-hidden rounded-xl border border-white/10 bg-brand-burgundy-light shadow-elev-3">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="truncate text-[14px] text-text-on-dark">{displayName}</p>
            {account.email ? (
              <p
                dir="ltr"
                className="mt-1 truncate text-[12.5px] text-text-on-dark/65 rtl:text-right"
              >
                {account.email}
              </p>
            ) : null}
          </div>
          <div className="p-1.5">
            <AdminLogoutButton
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-[14px] text-text-on-dark transition-colors hover:bg-white/[0.07]"
              iconClassName="size-[18px] shrink-0 stroke-[1.5] text-brand-gold"
            />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("account")}
        className="flex min-h-12 w-full items-center gap-2.5 rounded-xl px-2.5 text-start transition-colors hover:bg-white/[0.05]"
      >
        <span
          aria-hidden="true"
          className="grid size-[34px] shrink-0 place-items-center rounded-full bg-brand-gold/90 text-[15px] leading-none text-brand-burgundy [font-family:var(--font-playfair),serif]"
        >
          {initial}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-medium leading-tight text-text-on-dark">
            {displayName}
          </span>
          <span className="mt-1 text-[10.5px] uppercase leading-none tracking-[0.1em] text-text-on-dark/65 rtl:text-[11px] rtl:normal-case rtl:tracking-normal">
            {roleLabel}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 stroke-[1.7] text-text-on-dark/75 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
    </div>
  );
}
