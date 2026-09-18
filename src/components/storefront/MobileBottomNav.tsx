"use client";

import { useTranslations } from "next-intl";
import { Home, LayoutGrid, Heart, ShoppingBag, User } from "lucide-react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { useReserveBottomInset } from "./ViewportInsets";
import { CartBadge } from "./CartBadge";
import { cn } from "@/lib/utils/cn";

/**
 * The mobile bottom navigation bar — Home / Shop / Wishlist / Cart /
 * Account — so the phone experience reads as a polished shopping app
 * rather than a shrunken desktop page.
 *
 * Purely a set of links to routes that already exist; it introduces no
 * new destination, no state, and no data access.
 *
 * Three things it deliberately gets right:
 *  - **It never covers other fixed UI.** It registers its own height with
 *    the shared inset coordinator (`useReserveBottomInset`, research.md
 *    §30), which is the same mechanism the PWA install banner uses — so
 *    the floating WhatsApp button automatically lifts above it instead of
 *    overlapping, with no hardcoded offsets anywhere.
 *  - **It stays clear of the home indicator** via `safe-area-inset-bottom`.
 *  - **It hides during checkout**, where a persistent bar competes with
 *    the form's own primary action — mirroring `FloatingWhatsApp`'s
 *    existing route suppression rather than inventing a second rule.
 *
 * `lg:hidden` keeps it off tablet-landscape and desktop, where the header
 * already carries every one of these destinations.
 */
export function MobileBottomNav({ cartCount = 0 }: { cartCount?: number }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  // `usePathname` from the i18n helper returns the path with the locale
  // prefix already stripped, so this matches in both EN and AR.
  const hidden = pathname.startsWith("/checkout");

  // 0 offset: the bar is flush to the viewport bottom, unlike the
  // floating button's `bottom-4`.
  const ref = useReserveBottomInset("mobile-bottom-nav", !hidden, 0);

  if (hidden) return null;

  const items = [
    { href: "/", label: t("home"), Icon: Home, exact: true },
    { href: "/shop", label: t("shop"), Icon: LayoutGrid, exact: false },
    { href: "/wishlist", label: t("wishlist"), Icon: Heart, exact: false },
    { href: "/cart", label: t("cart"), Icon: ShoppingBag, exact: false, badge: cartCount },
    { href: "/account", label: t("account"), Icon: User, exact: false },
  ];

  return (
    <nav
      ref={ref}
      aria-label={t("menu")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-brand-ivory/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, Icon, exact, badge }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-label={badge ? t("cartWithCount", { count: badge }) : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-burgundy",
                  // Inactive tabs at 75% ink: ≥ 4.5:1 on the ivory bar
                  // (WCAG AA for small text). Active is full ink + a
                  // heavier icon stroke, so state never relies on colour.
                  active ? "text-text-primary" : "text-text-primary/75 hover:text-text-primary",
                )}
              >
                <span className="relative inline-flex">
                  <Icon aria-hidden="true" size={19} strokeWidth={active ? 1.9 : 1.5} />
                  {badge ? <CartBadge count={badge} /> : null}
                </span>
                <span className="text-[0.625rem] font-medium leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
