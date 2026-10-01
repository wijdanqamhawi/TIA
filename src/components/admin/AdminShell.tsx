"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlignLeft,
  Download,
  House,
  Image as ImageIcon,
  LayoutGrid,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  SquareArrowOutUpRight,
  Tag,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DirectionalIcon } from "@/components/ui/DirectionalIcon";
import { AdminLanguageToggle } from "@/components/admin/AdminLanguageToggle";
import { AdminAccountMenu, type AdminAccount } from "@/components/admin/AdminAccountMenu";

type NavKey =
  | "dashboard"
  | "products"
  | "categories"
  | "showcases"
  | "orders"
  | "customers"
  | "locations"
  | "specialOffers"
  | "exports"
  | "team";

type NavLink = {
  href: string;
  key: NavKey;
  icon: LucideIcon;
};

const NAV_LINKS: readonly NavLink[] = [
  { href: "/admin", key: "dashboard", icon: House },
  { href: "/admin/products", key: "products", icon: Package },
  { href: "/admin/categories", key: "categories", icon: LayoutGrid },
  { href: "/admin/showcases", key: "showcases", icon: ImageIcon },
  { href: "/admin/orders", key: "orders", icon: ShoppingBag },
  { href: "/admin/customers", key: "customers", icon: Users },
  { href: "/admin/locations", key: "locations", icon: MapPin },
  { href: "/admin/offers", key: "specialOffers", icon: Tag },
  { href: "/admin/exports", key: "exports", icon: Download },
  { href: "/admin/team", key: "team", icon: UserCog },
];

function isActive(pathname: string, link: NavLink): boolean {
  if (link.href === "/admin") return pathname === "/admin";
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

const ROW =
  "relative flex min-h-11 w-full items-center gap-3 rounded-lg px-4 text-[14.5px] leading-none transition-colors duration-200 lg:min-h-[42px] lg:px-3.5 lg:text-[14px]";
const ROW_IDLE = "text-text-on-dark/90 hover:bg-white/[0.05] hover:text-text-on-dark";
const ICON = "size-5 shrink-0 stroke-[1.45]";

/**
 * The admin chrome: deep-navy sidebar (235px, as in the approved dashboard
 * reference), warm top bar and the page area.
 *
 * At `lg` and up the sidebar is a fixed column (the top-bar menu button
 * hides/shows it); below `lg` it becomes an off-canvas drawer opened by the
 * same button. The sidebar is placed with `inset-inline-start`, so under
 * `dir="rtl"` it sits on the right and slides in from the right with no
 * direction-specific transforms.
 */
export function AdminShell({
  account,
  children,
}: {
  account: AdminAccount;
  children: React.ReactNode;
}) {
  const t = useTranslations("AdminShell");
  const locale = useLocale();
  const pathname = usePathname() ?? "/admin";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Close the drawer after navigating, and on Escape.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function toggleMenu() {
    if (window.matchMedia("(min-width: 1024px)").matches) setCollapsed((value) => !value);
    else setDrawerOpen((value) => !value);
  }

  const menuExpanded = drawerOpen || !collapsed;

  return (
    <div className="min-h-screen bg-brand-ivory text-text-primary">
      {drawerOpen ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-brand-burgundy/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <aside
        id="admin-sidebar"
        className={cn(
          "fixed inset-y-0 z-50 flex w-[235px] flex-col lg:w-[210px] bg-brand-burgundy text-text-on-dark",
          "transition-[inset-inline-start,visibility] duration-300 ease-luxury",
          drawerOpen ? "max-lg:start-0" : "max-lg:invisible max-lg:-start-[235px]",
          collapsed ? "lg:invisible lg:-start-[210px]" : "lg:start-0",
        )}
      >
        <div className="relative flex h-24 shrink-0 items-center justify-center lg:h-[82px]">
          <Link
            href="/admin"
            aria-label={t("nav.dashboard")}
            dir="ltr"
            className="flex flex-col items-center pt-1 leading-none"
          >
            <span className="text-[40px] font-normal leading-none tracking-[0.12em] lg:text-[35px] text-brand-gold [font-family:var(--font-playfair),serif]">
              {t("brand")}
            </span>
            <span className="mt-1.5 ps-[0.42em] text-[10px] uppercase lg:mt-[5px] lg:text-[9px] leading-none tracking-[0.42em] text-brand-gold [font-family:var(--font-inter),sans-serif]">
              {t("brandTagline")}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label={t("closeMenu")}
            className="absolute end-2 top-2 grid size-11 place-items-center rounded-lg text-text-on-dark/80 hover:bg-white/[0.06] lg:hidden"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav
          aria-label={t("menu")}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex flex-col gap-1.5 lg:gap-[5px]">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link);
              const Icon = link.icon;
              return (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(ROW, active ? "bg-brand-gold/[0.12] text-brand-gold" : ROW_IDLE)}
                  >
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 start-0 w-[3px] rounded-s-lg bg-brand-gold"
                      />
                    ) : null}
                    <Icon
                      aria-hidden="true"
                      className={cn(ICON, active ? "text-brand-gold" : "text-text-on-dark/85")}
                    />
                    <span>{t(`nav.${link.key}`)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div aria-hidden="true" className="mx-3 my-4 h-px shrink-0 bg-white/[0.14] lg:my-3" />

          <a
            href={`/${locale === "ar" ? "ar" : "en"}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(ROW, ROW_IDLE)}
          >
            <DirectionalIcon
              icon={SquareArrowOutUpRight}
              aria-hidden="true"
              className={cn(ICON, "text-text-on-dark/85")}
            />
            <span>{t("viewStore")}</span>
          </a>
        </nav>

        <div className="shrink-0 px-2.5 pb-3 pt-2">
          <div aria-hidden="true" className="mx-3 mb-2.5 h-px bg-white/[0.14]" />
          <AdminAccountMenu account={account} />
        </div>
      </aside>

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ease-luxury",
          collapsed ? "lg:ps-0" : "lg:ps-[210px]",
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-brand-burgundy/[0.06] bg-brand-ivory/95 px-3 backdrop-blur-sm sm:gap-4 sm:px-6 lg:h-[60px] lg:gap-3 lg:px-6">
          <button
            type="button"
            onClick={toggleMenu}
            aria-label={menuExpanded ? t("closeMenu") : t("openMenu")}
            aria-controls="admin-sidebar"
            aria-expanded={menuExpanded}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-brand-burgundy transition-colors hover:bg-brand-burgundy/[0.05] lg:-ms-2.5 lg:size-10"
          >
            <DirectionalIcon
              icon={AlignLeft}
              aria-hidden="true"
              className="size-6 stroke-[1.5] lg:size-[22px]"
            />
          </button>

          {/* Searches orders (customer name / order number) through the existing Orders page filter. */}
          <form
            action="/admin/orders"
            method="get"
            role="search"
            className="min-w-0 flex-1 lg:ms-1 lg:max-w-[350px]"
          >
            <label className="relative flex h-11 items-center lg:h-[38px]">
              <span className="sr-only">{t("searchLabel")}</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-4 size-[18px] stroke-[1.6] lg:size-4 text-text-secondary"
              />
              <input
                type="search"
                name="q"
                placeholder={t("search")}
                className="h-full w-full min-w-0 rounded-full border border-transparent bg-brand-cream pe-4 ps-11 text-[14.5px] text-brand-burgundy lg:ps-10 lg:text-[13.5px] placeholder:text-text-secondary focus-visible:border-brand-gold/60 focus-visible:bg-white focus-visible:outline-none"
              />
            </label>
          </form>

          <div className="ms-auto flex shrink-0 items-center">
            <AdminLanguageToggle />
          </div>
        </header>

        <main className="relative min-w-0 flex-1 px-4 pb-10 pt-5 sm:px-6 lg:px-6 lg:pb-6 lg:pt-4">
          {children}
        </main>
      </div>
    </div>
  );
}
