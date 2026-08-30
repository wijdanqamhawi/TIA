"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/lib/i18n/navigation";
import { WhatsAppIcon } from "@/components/ui/SocialIcons";
import { useReservedBottomInset } from "./ViewportInsets";

/**
 * The floating WhatsApp contact button (T207, research.md §30, spec
 * FR-006e). Rendered once from the storefront layout (T210), never
 * per-page.
 *
 * Non-interference guarantees:
 *  - **Vertical**: its offset comes from `useReservedBottomInset()`, so it
 *    sits *above* whatever bottom-anchored fixed UI is currently visible
 *    (the PWA install banner today; a cookie notice or mobile sticky
 *    Add-to-Cart bar automatically, once either registers) rather than
 *    overlapping it.
 *  - **Horizontal/RTL**: anchored with the logical `end-4` (not a physical
 *    `right-4`), so it mirrors to the correct corner under Arabic RTL
 *    without a second rule (spec FR-070).
 *  - **Route**: hidden entirely on checkout, where it must never sit over
 *    the form's primary actions. Suppression lives here (this is already a
 *    Client Component with route access) so the layout mounts it
 *    unconditionally and no page has to remember to opt out.
 *
 * Fails safe (T208): renders nothing at all when WhatsApp is unconfigured
 * — never a dead or disabled-looking button. Uses the gold-on-burgundy
 * ELORA palette, never WhatsApp's default green (T209, research.md §31),
 * and meets the same 44px touch-target minimum as every other control
 * (research.md §18a).
 */
export function FloatingWhatsApp({ href }: { href: string | null }) {
  const t = useTranslations("Social");
  const pathname = usePathname();
  const reservedBottom = useReservedBottomInset();

  if (!href) return null;
  // `usePathname` from the i18n navigation helper returns the pathname
  // with the locale prefix already stripped, so this matches both
  // `/en/checkout` and `/ar/checkout`.
  if (pathname.startsWith("/checkout")) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsappLabel")}
      title={t("whatsappLabel")}
      data-testid="floating-whatsapp"
      style={{ bottom: `${reservedBottom + 16}px` }}
      className="fixed end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-burgundy text-brand-gold shadow-lg transition-colors hover:bg-brand-burgundy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
    >
      <WhatsAppIcon size={28} />
    </a>
  );
}
