"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

export type CategoryLink = { slug: string; label: string };

// Declared once so every row in the drawer shares one padding and one
// hover/focus treatment.
const ROW_CLASS =
  "flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-brand-cream hover:text-brand-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy";
const SUBROW_CLASS =
  "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm text-text-primary/80 transition-colors hover:bg-brand-cream hover:text-brand-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy";

/**
 * Collapsible mobile/tablet hamburger navigation (spec FR-003): the live
 * category links (never hardcoded — spec FR-046a) under a "Collections"
 * label, then About and Contact.
 *
 * Deliberately navigation only. Home / Shop / Wishlist / Cart / Account
 * live in the bottom tab bar and Search in the header; social links live
 * in the footer (and the floating WhatsApp button); delivery location is
 * chosen at checkout; and the visible language choice is on the
 * first-entry welcome screen. None of those is repeated here.
 */
export function MobileNav({ categoryLinks }: { categoryLinks: CategoryLink[] }) {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);

  return (
    // `lg`, not `md`: the Navbar reveals its desktop link row at `lg`, so
    // the hamburger covers every width below it (phones and tablets).
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("openMenu")}
        aria-expanded={open}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-current opacity-85 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        <Menu aria-hidden="true" strokeWidth={1.5} />
      </button>

      {open ? createPortal(
        // Portalled to <body>: rendered in place, the drawer sat inside the
        // sticky header's `z-40` stacking context, so later fixed layers at
        // the same level (the PWA install banner) painted over it. At body
        // level its own `z-50` applies.
        <div data-nav-drawer-open="" className="fixed inset-0 z-50 flex text-text-primary">
          <button
            type="button"
            aria-label={t("closeMenu")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-brand-burgundy-dark/45 backdrop-blur-sm"
          />
          <div className="relative ms-auto flex h-full w-[min(88vw,23rem)] flex-col overflow-y-auto border-s border-hairline bg-brand-ivory shadow-elev-3">
            <div className="flex items-center justify-between gap-4 border-b border-hairline bg-brand-cream/50 px-4 py-4">
              <span className="font-display text-xl text-text-primary">{t("menu")}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("closeMenu")}
                className="-me-2 flex min-h-11 min-w-11 items-center justify-center rounded-full text-text-primary/70 transition-colors hover:bg-brand-beige hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <nav aria-label={t("menu")} className="flex flex-col px-2 py-5">
              {categoryLinks.length > 0 ? (
                <div className="flex flex-col gap-1 pb-5">
                  <p className="px-3 pb-2 text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-text-primary/75 rtl:text-xs rtl:normal-case rtl:tracking-normal">
                    {t("collections")}
                  </p>
                  {categoryLinks.map((category) => (
                    <Link
                      key={category.slug}
                      href={`/shop/category/${category.slug}`}
                      onClick={() => setOpen(false)}
                      className={SUBROW_CLASS}
                    >
                      {category.label}
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className={categoryLinks.length > 0 ? "flex flex-col gap-1 border-t border-hairline pt-5" : "flex flex-col gap-1"}>
                <Link href="/about" onClick={() => setOpen(false)} className={ROW_CLASS}>
                  {t("about")}
                </Link>
                <Link href="/contact" onClick={() => setOpen(false)} className={ROW_CLASS}>
                  {t("contact")}
                </Link>
              </div>
            </nav>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
