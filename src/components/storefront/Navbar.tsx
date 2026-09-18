import { getTranslations } from "next-intl/server";
import { Search, Heart, ShoppingBag, User } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { Logo } from "@/components/ui/Logo";
import { getSessionClaims } from "@/lib/firebase/guards";
import { getActiveCategories } from "@/lib/domain/catalog/category.service";
import { resolveLocalizedString } from "@/types/localizedString";
import { MobileNav } from "./MobileNav";
import { NavbarShell } from "./NavbarShell";
import { AnnouncementBar } from "./AnnouncementBar";
import { CartBadge } from "./CartBadge";
import { getCartItemCount } from "@/lib/domain/cart/cart-count";

// Circular icon affordances. Controls inherit their colour from the header
// rather than naming one, so the whole set stays deep navy on the warm-white
// bar and needs no per-route variant.
const ICON_LINK_CLASS =
  "flex min-h-11 min-w-11 items-center justify-center rounded-full text-current opacity-85 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

// Clean sans navigation, matching the reference: sentence case, no tracking,
// a underline drawn on hover. Nothing is uppercased or letter-spaced, so
// Arabic needs no override.
const NAV_LINK_CLASS =
  "link-underline py-1 font-body text-[0.9375rem] text-current opacity-90 transition-opacity hover:opacity-100 focus-visible:outline-none";

/**
 * The responsive storefront Navbar (spec FR-002/FR-003), built to the
 * approved reference: the navy announcement bar, then a slim white bar with
 * the TIA lockup at the start, the navigation optically centred, and the
 * four shopping icons at the end.
 *
 * Below `lg` it collapses to hamburger-start / wordmark-centre / icons-end.
 * One `Logo` instance serves both arrangements by moving between grid
 * columns, so there is never a duplicate home link in the accessibility
 * tree.
 */
export async function Navbar({ locale }: { locale: string }) {
  const [t, tHome, claims, categories, cartCount] = await Promise.all([
    getTranslations({ locale, namespace: "Nav" }),
    getTranslations({ locale, namespace: "Home" }),
    getSessionClaims(),
    getActiveCategories(),
    // Read-only projection of the existing cart; every mutation path already
    // calls `router.refresh()`, which re-renders this Server Component, so
    // the badge follows add/increase/decrease/remove/clear with no extra
    // state and no new invalidation.
    getCartItemCount(),
  ]);

  const accountHref = claims ? "/account" : "/login";
  const categoryLinks = categories.map((category) => ({
    slug: category.slug,
    label: resolveLocalizedString(category.name, locale),
  }));

  return (
    <NavbarShell>
      <AnnouncementBar locale={locale} />

      <div className="container-luxury grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-hairline sm:h-16 lg:h-[4.25rem] lg:grid-cols-[auto_1fr_auto]">
        {/* START — menu trigger below `lg`; the wordmark takes this cell
            from `lg` up. */}
        <div className="col-start-1 flex items-center justify-self-start lg:hidden">
          <MobileNav categoryLinks={categoryLinks} />
        </div>

        <Logo
          locale={locale}
          className="col-start-2 items-center justify-self-center lg:col-start-1 lg:items-start lg:justify-self-start"
          imageClassName="text-[1.375rem] font-normal tracking-[0.3em] sm:text-[1.5rem] lg:text-[1.625rem]"
          showTagline
          priority
        />

        {/* CENTRE — primary navigation (desktop only). */}
        <nav
          className="col-start-2 hidden items-center justify-center gap-8 justify-self-center lg:flex xl:gap-10"
          aria-label={t("shop")}
        >
          <Link href="/shop" className={NAV_LINK_CLASS}>
            {t("shop")}
          </Link>
          <Link href="/shop?sort=newest" className={NAV_LINK_CLASS}>
            {tHome("newArrivals")}
          </Link>
          {/* No "Collections" entry: the store has no /collections route,
              and pointing it at /shop would give two nav items the same
              destination. The category links themselves live on /shop and
              in the phone/tablet drawer. */}
          <Link href="/about" className={NAV_LINK_CLASS}>
            {t("about")}
          </Link>
          <Link href="/contact" className={NAV_LINK_CLASS}>
            {t("contact")}
          </Link>
        </nav>

        {/* END — the four shopping utilities only. */}
        <div className="col-start-3 flex items-center justify-end gap-0.5 justify-self-end">
          <Link href="/shop" aria-label={t("search")} className={ICON_LINK_CLASS}>
            <Search aria-hidden="true" size={18} strokeWidth={1.5} />
          </Link>
          <Link href="/wishlist" aria-label={t("wishlist")} className={`hidden sm:flex ${ICON_LINK_CLASS}`}>
            <Heart aria-hidden="true" size={18} strokeWidth={1.5} />
          </Link>
          <Link href={accountHref} aria-label={t("account")} className={`hidden sm:flex ${ICON_LINK_CLASS}`}>
            <User aria-hidden="true" size={18} strokeWidth={1.5} />
          </Link>
          <Link
            href="/cart"
            aria-label={t("cartWithCount", { count: cartCount })}
            className={`relative ${ICON_LINK_CLASS}`}
          >
            <ShoppingBag aria-hidden="true" size={18} strokeWidth={1.5} />
            <CartBadge count={cartCount} />
          </Link>
        </div>
      </div>
    </NavbarShell>
  );
}
