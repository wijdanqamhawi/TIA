"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, X, Search, Heart, ShoppingBag, User } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/SocialIcons";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LocationSelector } from "./LocationSelector";
import type { RegionOption, LocationOption } from "./LocationSelectorDialog";

export type CategoryLink = { slug: string; label: string };

/**
 * Collapsible mobile hamburger navigation (spec FR-003) — preserves every
 * destination available on desktop, including categories, the
 * Instagram/WhatsApp contact entries (T205), and the language switcher.
 *
 * The social hrefs are passed in already-resolved from the centralized
 * config (T202) by the server-rendered `Navbar`, rather than read here:
 * this is a Client Component, and threading them through as props keeps
 * exactly one module reading the configuration. Either is `null` when
 * unconfigured, in which case that entry simply isn't rendered (T208).
 */
export function MobileNav({
  categoryLinks,
  accountHref,
  instagramHref,
  whatsappHref,
  locale,
  locationRegions,
  locationsByRegion,
}: {
  categoryLinks: CategoryLink[];
  accountHref: string;
  instagramHref: string | null;
  whatsappHref: string | null;
  locale: string;
  locationRegions: RegionOption[];
  locationsByRegion: Record<string, LocationOption[]>;
}) {
  const t = useTranslations("Nav");
  const tSocial = useTranslations("Social");
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("openMenu")}
        aria-expanded={open}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-primary hover:bg-brand-beige focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-burgundy"
      >
        <Menu aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label={t("closeMenu")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative ms-auto flex h-full w-[min(85vw,22rem)] flex-col overflow-y-auto bg-brand-ivory p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border-luxury pb-4">
              <span className="font-display text-lg text-text-primary">{t("menu")}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("closeMenu")}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-primary hover:bg-brand-beige focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-burgundy"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <nav className="flex flex-col gap-1 py-4 text-text-primary">
              <Link href="/" onClick={() => setOpen(false)} className="min-h-11 rounded-md px-2 py-2.5 hover:bg-brand-beige">
                {t("home")}
              </Link>
              <Link href="/shop" onClick={() => setOpen(false)} className="min-h-11 rounded-md px-2 py-2.5 hover:bg-brand-beige">
                {t("shop")}
              </Link>
              {categoryLinks.map((category) => (
                <Link
                  key={category.slug}
                  href={`/shop/category/${category.slug}`}
                  onClick={() => setOpen(false)}
                  className="min-h-11 rounded-md px-6 py-2 text-sm text-text-primary/80 hover:bg-brand-beige"
                >
                  {category.label}
                </Link>
              ))}
              <Link href="/about" onClick={() => setOpen(false)} className="min-h-11 rounded-md px-2 py-2.5 hover:bg-brand-beige">
                {t("about")}
              </Link>
              <Link href="/contact" onClick={() => setOpen(false)} className="min-h-11 rounded-md px-2 py-2.5 hover:bg-brand-beige">
                {t("contact")}
              </Link>
            </nav>

            <div className="flex flex-col gap-1 border-t border-border-luxury py-4 text-text-primary">
              <Link href="/shop" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2.5 hover:bg-brand-beige">
                <Search aria-hidden="true" size={18} /> {t("search")}
              </Link>
              <Link href="/wishlist" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2.5 hover:bg-brand-beige">
                <Heart aria-hidden="true" size={18} /> {t("wishlist")}
              </Link>
              <Link href="/cart" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2.5 hover:bg-brand-beige">
                <ShoppingBag aria-hidden="true" size={18} /> {t("cart")}
              </Link>
              <Link href={accountHref} onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2.5 hover:bg-brand-beige">
                <User aria-hidden="true" size={18} /> {t("account")}
              </Link>
            </div>

            {instagramHref || whatsappHref ? (
              <div className="flex flex-col gap-1 border-t border-border-luxury py-4 text-text-primary">
                {instagramHref ? (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tSocial("instagramLabel")}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2.5 hover:bg-brand-beige"
                  >
                    <InstagramIcon size={18} /> {tSocial("instagram")}
                  </a>
                ) : null}
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tSocial("whatsappLabel")}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2.5 hover:bg-brand-beige"
                  >
                    <WhatsAppIcon size={18} /> {tSocial("whatsapp")}
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="border-t border-border-luxury py-4">
              <LocationSelector
                locale={locale}
                regions={locationRegions}
                locationsByRegion={locationsByRegion}
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2.5 text-start text-text-primary hover:bg-brand-beige"
              />
            </div>

            <div className="mt-auto border-t border-border-luxury pt-4">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
