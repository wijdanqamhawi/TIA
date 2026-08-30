import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import "../globals.css";

export const metadata: Metadata = {
  title: "ELORA JEWELLERY — Admin",
  robots: { index: false, follow: false },
};

// Every /admin/* route makes a per-request authorization decision from the
// session cookie; it must never be statically prerendered/cached.
export const dynamic = "force-dynamic";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/showcases", label: "Showcases" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/locations", label: "Delivery Locations" },
  { href: "/admin/exports", label: "Exports" },
];

/**
 * Server-side admin guard (defense layer 2 of 3, research.md §9) —
 * `middleware.ts` only does a cheap cookie-presence pre-filter (layer 1);
 * this is the actual, authoritative authorization decision, independently
 * re-verified via the Admin SDK on every request to any `/admin/*` route.
 * The Admin Dashboard's own chrome is deliberately English-only
 * (research.md §32) — only the *content* it manages is bilingual.
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

  return (
    <html lang="en" dir="ltr">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col bg-brand-ivory text-text-primary md:flex-row">
          <aside className="border-b border-border-luxury bg-brand-burgundy text-text-on-dark md:min-h-screen md:w-60 md:border-b-0 md:border-e">
            <div className="p-4">
              <p className="font-display text-lg">ELORA JEWELLERY</p>
              <p className="text-xs uppercase tracking-wide text-text-on-dark/70">Admin</p>
            </div>
            <nav className="flex flex-wrap gap-1 p-2 md:flex-col">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm hover:bg-brand-burgundy-dark"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </aside>
          <div className="flex-1">
            <header className="flex items-center justify-end border-b border-border-luxury p-4">
              <AdminLogoutButton />
            </header>
            <main className="p-4 md:p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
