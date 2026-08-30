import { getTranslations } from "next-intl/server";
import { Search, Heart, ShoppingBag, User } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { Logo } from "@/components/ui/Logo";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/SocialIcons";
import { getSessionClaims } from "@/lib/firebase/guards";
import { getActiveCategories } from "@/lib/domain/catalog/category.service";
import { getActiveDeliveryRegions, getActiveDeliveryLocationsByRegion } from "@/lib/domain/delivery/deliveryLocation.service";
import { resolveLocalizedString } from "@/types/localizedString";
import { buildInstagramHref, buildWhatsAppHref } from "@/lib/config/social";
import { MobileNav } from "./MobileNav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LocationSelector } from "./LocationSelector";

const ICON_LINK_CLASS =
  "flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-primary hover:bg-brand-beige focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-burgundy";

/**
 * The responsive storefront Navbar shell (spec FR-002/FR-003): logo, main
 * nav, live category quick-links (never hardcoded — spec FR-046a), search/
 * wishlist/cart/account icons, Instagram/WhatsApp contact icons (T204),
 * language switcher, and the mobile hamburger fallback.
 *
 * The social icons read the centralized config (T202) and simply do not
 * render when unconfigured (T208) — never a dead link. Both use the
 * burgundy/gold/cream palette via `currentColor`, never WhatsApp's default
 * green (T209, research.md §31), and `target="_blank" rel="noopener
 * noreferrer"` for safe external handoff that also leaves an installed
 * PWA's standalone window intact (research.md §29).
 */
export async function Navbar({ locale }: { locale: string }) {
  const [t, tSocial, claims, categories, regions] = await Promise.all([
    getTranslations({ locale, namespace: "Nav" }),
    getTranslations({ locale, namespace: "Social" }),
    getSessionClaims(),
    getActiveCategories(),
    getActiveDeliveryRegions(),
  ]);
  const locationsByRegionEntries = await Promise.all(
    regions.map(async (region) => [region.regionId, await getActiveDeliveryLocationsByRegion(region.regionId)] as const),
  );
  const regionOptions = regions.map((region) => ({ regionId: region.regionId, name: region.name }));
  const locationsByRegion = Object.fromEntries(
    locationsByRegionEntries.map(([regionId, locations]) => [
      regionId,
      locations.map((location) => ({
        id: location.id,
        name: location.name,
        slug: location.slug,
        searchTerms: location.searchTerms,
      })),
    ]),
  );

  const accountHref = claims ? "/account" : "/login";
  const instagramHref = buildInstagramHref();
  const whatsappHref = buildWhatsAppHref(locale);
  const categoryLinks = categories.map((category) => ({
    slug: category.slug,
    label: resolveLocalizedString(category.name, locale),
  }));

  return (
    <header className="sticky top-0 z-40 border-b border-border-luxury bg-brand-ivory/95 backdrop-blur">
      <div className="container-luxury flex h-16 items-center justify-between gap-4">
        <Logo locale={locale} className="shrink-0" priority />

        <nav className="hidden items-center gap-6 lg:flex" aria-label={t("shop")}>
          <Link href="/" className="text-sm font-medium text-text-primary hover:text-brand-burgundy">
            {t("home")}
          </Link>
          <Link href="/shop" className="text-sm font-medium text-text-primary hover:text-brand-burgundy">
            {t("shop")}
          </Link>
          {categoryLinks.map((category) => (
            <Link
              key={category.slug}
              href={`/shop/category/${category.slug}`}
              className="text-sm font-medium text-text-primary/80 hover:text-brand-burgundy"
            >
              {category.label}
            </Link>
          ))}
          <Link href="/about" className="text-sm font-medium text-text-primary hover:text-brand-burgundy">
            {t("about")}
          </Link>
          <Link href="/contact" className="text-sm font-medium text-text-primary hover:text-brand-burgundy">
            {t("contact")}
          </Link>
        </nav>

        <div className="flex items-center gap-1">
          {instagramHref ? (
            <a
              href={instagramHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={tSocial("instagramLabel")}
              title={tSocial("instagramLabel")}
              className={`hidden sm:flex ${ICON_LINK_CLASS}`}
            >
              <InstagramIcon size={20} />
            </a>
          ) : null}
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={tSocial("whatsappLabel")}
              title={tSocial("whatsappLabel")}
              className={`hidden sm:flex ${ICON_LINK_CLASS}`}
            >
              <WhatsAppIcon size={20} />
            </a>
          ) : null}
          <div className="hidden md:block">
            <LocationSelector locale={locale} regions={regionOptions} locationsByRegion={locationsByRegion} />
          </div>
          <div className="hidden md:block">
            <LanguageSwitcher className="me-2" />
          </div>
          <Link href="/shop" aria-label={t("search")} className={ICON_LINK_CLASS}>
            <Search aria-hidden="true" size={20} />
          </Link>
          <Link href="/wishlist" aria-label={t("wishlist")} className={`hidden sm:flex ${ICON_LINK_CLASS}`}>
            <Heart aria-hidden="true" size={20} />
          </Link>
          <Link href="/cart" aria-label={t("cart")} className={ICON_LINK_CLASS}>
            <ShoppingBag aria-hidden="true" size={20} />
          </Link>
          <Link href={accountHref} aria-label={t("account")} className={`hidden sm:flex ${ICON_LINK_CLASS}`}>
            <User aria-hidden="true" size={20} />
          </Link>
          <MobileNav
            categoryLinks={categoryLinks}
            accountHref={accountHref}
            instagramHref={instagramHref}
            whatsappHref={whatsappHref}
            locale={locale}
            locationRegions={regionOptions}
            locationsByRegion={locationsByRegion}
          />
        </div>
      </div>
    </header>
  );
}
