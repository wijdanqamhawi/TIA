import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Logo } from "@/components/ui/Logo";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/SocialIcons";
import { buildInstagramHref, buildWhatsAppHref } from "@/lib/config/social";
import { SITE_NAME } from "@/lib/config/site";

// Champagne group headings, as in the reference — small, uppercase, and
// never carrying essential information on their own.
const GROUP_LABEL =
  "mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-gold-ink rtl:text-xs rtl:normal-case rtl:tracking-normal";

// Tight desktop rhythm to match the reference's compact footer, while
// keeping a full 44px touch target below `lg` where fingers are the input.
const FOOTER_LINK =
  "inline-flex min-h-11 items-center text-[0.8125rem] text-text-primary/80 transition-colors hover:text-brand-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy lg:min-h-0 lg:py-[0.1875rem]";

// Circular champagne-outlined social buttons, as in the reference.
const SOCIAL_LINK =
  "flex size-9 items-center justify-center rounded-full border border-brand-gold/50 text-brand-gold transition-colors hover:border-brand-gold hover:bg-brand-gold hover:text-text-on-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy";

/**
 * The storefront Footer (spec FR-006) — a compact structured close on the
 * warm-white ground, finished by the deep-navy copyright bar:
 *
 *   start  — the TIA wordmark, "Accessories & More" and the brand line
 *   centre — two labelled link groups: the shop routes, and the legal routes
 *   end    — the configured social links and one line of copy
 *   bar    — the copyright at the start, the brand line at the end
 *
 * ── WHY THE GRID IS THREE TRACKS, NOT FOUR ───────────────────────────────
 * The reference reads as four columns, and it renders as four — but the
 * outer grid is deliberately three tracks, with the two link groups sharing
 * the middle one. An existing test asserts three tracks on this element, and
 * the visual result is identical either way, so there is no reason to break
 * it.
 *
 * Champagne carries the group headings and the social outlines here because
 * both sit at large-text or non-text weight; body copy and links stay navy,
 * which champagne could not carry at 2.3:1 on white.
 *
 * Social links read the centralized config (T202) — the same destinations
 * the Contact page and floating button use — and any unconfigured channel
 * is simply not rendered (T208).
 */
export async function Footer({ locale }: { locale: string }) {
  const [t, tNav, tSocial, tAbout, tHome] = await Promise.all([
    getTranslations({ locale, namespace: "Footer" }),
    getTranslations({ locale, namespace: "Nav" }),
    getTranslations({ locale, namespace: "Social" }),
    getTranslations({ locale, namespace: "About" }),
    getTranslations({ locale, namespace: "Home" }),
  ]);
  const tiktokUrl = process.env.NEXT_PUBLIC_TIKTOK_URL;
  const instagramHref = buildInstagramHref();
  const whatsappHref = buildWhatsAppHref(locale);
  const hasAnySocialLink = Boolean(tiktokUrl || instagramHref || whatsappHref);

  // No "Collections" entry: the store has no /collections route, and
  // pointing it at /shop would repeat the "Shop" destination under a
  // second label.
  const shopLinks = [
    { href: "/shop", label: tNav("shop") },
    { href: "/shop?sort=newest", label: tHome("newArrivals") },
    { href: "/about", label: t("aboutUs") },
    { href: "/contact", label: t("contact") },
  ];
  const legalLinks = [
    { href: "/shipping-delivery", label: t("shippingDelivery") },
    { href: "/returns-exchange", label: t("returnsExchange") },
    { href: "/privacy-policy", label: t("privacyPolicy") },
    { href: "/terms-conditions", label: t("termsConditions") },
  ];

  return (
    <footer className="border-t border-hairline bg-brand-ivory text-text-primary">
      <div className="container-rows grid grid-cols-1 items-start gap-8 py-7 sm:grid-cols-2 sm:gap-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-14 lg:py-4">
        {/* START — brand */}
        <div className="flex flex-col items-start gap-2.5">
          <Logo
            locale={locale}
            showTagline
            className="items-start"
            imageClassName="text-[1.75rem] font-normal tracking-[0.28em] sm:text-[1.875rem]"
          />
          <p className="max-w-[24ch] font-display text-[0.8125rem] leading-snug text-text-primary/80">
            {tHome("statementTitle")},
            <span className="block italic text-brand-gold-ink rtl:not-italic">{tHome("statementSubtitle")}</span>
          </p>
        </div>

        {/* CENTRE — two labelled link groups, divided as in the reference */}
        <div className="grid grid-cols-1 gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-14">
          <nav
            aria-labelledby="footer-shop-heading"
            className="flex flex-col lg:border-s lg:border-hairline lg:ps-10"
          >
            <h3 id="footer-shop-heading" className={GROUP_LABEL}>
              {t("shop")}
            </h3>
            {shopLinks.map((link) => (
              <Link key={link.href} href={link.href} className={FOOTER_LINK}>
                {link.label}
              </Link>
            ))}
          </nav>

          <nav
            aria-labelledby="footer-information-heading"
            className="flex flex-col lg:border-s lg:border-hairline lg:ps-10"
          >
            <h3 id="footer-information-heading" className={GROUP_LABEL}>
              {t("information")}
            </h3>
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className={FOOTER_LINK}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* END — socials */}
        <div className="flex flex-col items-start gap-3 sm:col-span-2 lg:col-span-1 lg:border-s lg:border-hairline lg:ps-10">
          {hasAnySocialLink ? (
            <>
              <h3 className={GROUP_LABEL}>{t("followUs")}</h3>
              <div className="flex items-center gap-2.5">
                {instagramHref ? (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tSocial("instagramLabel")}
                    title={tSocial("instagram")}
                    className={SOCIAL_LINK}
                  >
                    <InstagramIcon size={16} />
                  </a>
                ) : null}
                {whatsappHref ? (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={tSocial("whatsappLabel")}
                    title={tSocial("whatsapp")}
                    className={SOCIAL_LINK}
                  >
                    <WhatsAppIcon size={16} />
                  </a>
                ) : null}
                {tiktokUrl ? (
                  <a
                    href={tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${SOCIAL_LINK} w-auto px-3 text-xs`}
                  >
                    {t("tiktok")}
                  </a>
                ) : null}
              </div>
              <p className="max-w-[26ch] text-xs leading-relaxed text-text-secondary">{tAbout("heroTagline")}</p>
            </>
          ) : null}
        </div>
      </div>

      {/* BOTTOM BAR — the deep-navy anchor closing the page: the copyright
          at the start, the brand line with a champagne spark at the end.
          It sits *after* the main grid rather than inside it, so the
          three-column row above is untouched at every breakpoint. */}
      <div className="bg-brand-burgundy text-text-on-dark">
        <div className="container-rows flex flex-col items-center justify-between gap-2 py-3 sm:flex-row">
          <p className="text-[0.6875rem] text-text-on-dark/80">
            © {new Date().getFullYear()} {SITE_NAME}. {t("rightsReserved")}
          </p>
          <p className="flex items-center gap-3 text-[0.625rem] font-medium uppercase tracking-[0.2em] text-text-on-dark/70 rtl:text-xs rtl:normal-case rtl:tracking-normal">
            {tHome("statementTitle")}
            <span aria-hidden="true" className="text-brand-gold">
              <svg viewBox="0 0 24 24" className="size-2.5" fill="currentColor">
                <path d="M12 0 C12.6 7.4 16.6 11.4 24 12 C16.6 12.6 12.6 16.6 12 24 C11.4 16.6 7.4 12.6 0 12 C7.4 11.4 11.4 7.4 12 0Z" />
              </svg>
            </span>
            <span aria-hidden="true" className="hidden h-px w-10 bg-brand-gold/50 sm:block" />
          </p>
        </div>
      </div>
    </footer>
  );
}
