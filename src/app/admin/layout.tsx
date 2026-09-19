import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";
import { adminDirection, getAdminLocale, getAdminMessages, getAdminTranslator } from "@/lib/i18n/admin";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { AdminLanguageToggle } from "@/components/admin/AdminLanguageToggle";
import "../globals.css";

export const metadata: Metadata = {
  title: "TIA — Admin",
  robots: { index: false, follow: false },
};

// Every /admin/* route makes a per-request authorization decision from the
// session cookie; it must never be statically prerendered/cached.
export const dynamic = "force-dynamic";

const NAV_LINKS = [
  { href: "/admin", key: "dashboard" },
  { href: "/admin/products", key: "products" },
  { href: "/admin/categories", key: "categories" },
  { href: "/admin/showcases", key: "showcases" },
  { href: "/admin/orders", key: "orders" },
  { href: "/admin/customers", key: "customers" },
  { href: "/admin/locations", key: "locations" },
  { href: "/admin/exports", key: "exports" },
  { href: "/admin/team", key: "team" },
] as const;

/**
 * Server-side admin guard (defense layer 2 of 3, research.md §9) —
 * `middleware.ts` only does a cheap cookie-presence pre-filter (layer 1);
 * this is the actual, authoritative authorization decision, independently
 * re-verified via the Admin SDK on every request to any `/admin/*` route.
 * ADMIN and OWNER both pass (`requireAdmin`).
 *
 * The shell (sidebar, header) and the Team page follow the admin language
 * chosen with the header toggle (EN/AR, stored in a cookie), including
 * `lang`/`dir`. The other admin pages' own content is still English.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthenticatedError || err instanceof ForbiddenError) {
      redirect("/en/login?next=/admin");
    }
    throw err;
  }

  const locale = await getAdminLocale();
  const messages = await getAdminMessages(locale);
  const { t } = await getAdminTranslator("AdminShell");

  return (
    <html lang={locale} dir={adminDirection(locale)}>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="flex min-h-screen flex-col bg-brand-ivory text-text-primary md:flex-row">
            <aside className="border-b border-border-luxury bg-brand-burgundy text-text-on-dark md:min-h-screen md:w-60 md:border-b-0 md:border-e">
              <div className="p-4">
                <p className="font-display text-lg tracking-[0.3em]">{t("brand")}</p>
                <p className="text-xs uppercase tracking-wide text-text-on-dark/70 rtl:normal-case rtl:tracking-normal">
                  {t("area")}
                </p>
              </div>
              <nav aria-label={t("menu")} className="flex flex-wrap gap-1 p-2 md:flex-col">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm hover:bg-brand-burgundy-dark"
                  >
                    {t(`nav.${link.key}`)}
                  </a>
                ))}
              </nav>
            </aside>
            <div className="flex-1">
              <header className="flex items-center justify-end gap-2 border-b border-border-luxury p-4">
                <AdminLanguageToggle />
                <AdminLogoutButton />
              </header>
              <main className="p-4 md:p-6">{children}</main>
            </div>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
