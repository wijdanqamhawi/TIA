import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { Inter, Noto_Kufi_Arabic, Noto_Sans_Arabic, Playfair_Display } from "next/font/google";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";
import type { SessionClaims } from "@/lib/firebase/auth";
import { isStaffRole } from "@/lib/auth/roles";
import { adminDirection, getAdminLocale, getAdminMessages } from "@/lib/i18n/admin";
import { getCustomerById } from "@/lib/domain/admin/customer.service";
import { AdminShell } from "@/components/admin/AdminShell";
import type { AdminAccount } from "@/components/admin/AdminAccountMenu";
import "../globals.css";

// The same TIA type pairings the storefront loads in `[locale]/layout.tsx`
// (the admin tree has its own root layout, so it must load them itself):
// Playfair Display for display type, Inter for UI text, and the Noto
// Arabic pair that `globals.css` swaps in under `dir="rtl"`.
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const notoKufiArabic = Noto_Kufi_Arabic({
  variable: "--font-noto-kufi-arabic",
  subsets: ["arabic"],
  display: "swap",
});
const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-sans-arabic",
  subsets: ["arabic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TIA — Admin",
  robots: { index: false, follow: false },
};

// Every /admin/* route makes a per-request authorization decision from the
// session cookie; it must never be statically prerendered/cached.
export const dynamic = "force-dynamic";

/** The signed-in staff member for the top bar — the display name is best-effort and never blocks the shell. */
async function getAdminAccount(claims: SessionClaims): Promise<AdminAccount> {
  const role = isStaffRole(claims.role) ? claims.role : "ADMIN";
  try {
    const user = await getCustomerById(claims.uid);
    return { name: user?.name ?? null, email: claims.email ?? user?.email ?? null, role };
  } catch {
    return { name: null, email: claims.email, role };
  }
}

/**
 * Server-side admin guard (defense layer 2 of 3, research.md §9) —
 * `middleware.ts` only does a cheap cookie-presence pre-filter (layer 1);
 * this is the actual, authoritative authorization decision, independently
 * re-verified via the Admin SDK on every request to any `/admin/*` route.
 * ADMIN and OWNER both pass (`requireAdmin`).
 *
 * The shell (sidebar, header), the Dashboard and the Team page follow the
 * admin language chosen with the header toggle (EN/AR, stored in a
 * cookie), including `lang`/`dir`. The other admin pages' own content is
 * still English.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let claims: SessionClaims;
  try {
    claims = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthenticatedError || err instanceof ForbiddenError) {
      redirect("/en/login?next=/admin");
    }
    throw err;
  }

  const locale = await getAdminLocale();
  const [messages, account] = await Promise.all([
    getAdminMessages(locale),
    getAdminAccount(claims),
  ]);

  return (
    <html lang={locale} dir={adminDirection(locale)} className="[scrollbar-gutter:stable]">
      <body
        className={`${playfairDisplay.variable} ${inter.variable} ${notoKufiArabic.variable} ${notoSansArabic.variable} font-body antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AdminShell account={account}>{children}</AdminShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
