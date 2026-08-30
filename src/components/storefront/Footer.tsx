import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Logo } from "@/components/ui/Logo";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/SocialIcons";
import { buildInstagramHref, buildWhatsAppHref } from "@/lib/config/social";

/**
 * The storefront Footer shell (spec FR-006): branding, Shop/About Us/
 * Contact links, the four legal routes, a TikTok link, and the
 * Instagram/WhatsApp contact links (T206) — the latter two read from the
 * same centralized social config (T202) the Navbar and floating button
 * use, never their own copy of a URL/number.
 *
 * Any of the three that is unconfigured is simply not rendered (T208),
 * and the whole "Follow Us" column disappears when none is configured —
 * never a dead or misleading link. WhatsApp uses the burgundy/gold/cream
 * palette, never the platform's default green (T209).
 */
export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Footer" });
  const tNav = await getTranslations({ locale, namespace: "Nav" });
  const tSocial = await getTranslations({ locale, namespace: "Social" });
  const tiktokUrl = process.env.NEXT_PUBLIC_TIKTOK_URL;
  const instagramHref = buildInstagramHref();
  const whatsappHref = buildWhatsAppHref(locale);
  const hasAnySocialLink = Boolean(tiktokUrl || instagramHref || whatsappHref);

  return (
    <footer className="border-t border-border-luxury bg-brand-burgundy text-text-on-dark">
      <div
        className={`container-luxury grid grid-cols-1 gap-8 py-12 sm:grid-cols-2 ${
          hasAnySocialLink ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        <div>
          <Logo locale={locale} />
          <p className="mt-3 text-sm text-text-on-dark/70">ELORA JEWELLERY</p>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <h3 className="font-display text-base">{t("shop")}</h3>
          <Link href="/shop" className="text-text-on-dark/80 hover:text-brand-gold">
            {tNav("shop")}
          </Link>
          <Link href="/about" className="text-text-on-dark/80 hover:text-brand-gold">
            {t("aboutUs")}
          </Link>
          <Link href="/contact" className="text-text-on-dark/80 hover:text-brand-gold">
            {t("contact")}
          </Link>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <h3 className="font-display text-base">{t("shippingDelivery")}</h3>
          <Link href="/shipping-delivery" className="text-text-on-dark/80 hover:text-brand-gold">
            {t("shippingDelivery")}
          </Link>
          <Link href="/returns-exchange" className="text-text-on-dark/80 hover:text-brand-gold">
            {t("returnsExchange")}
          </Link>
          <Link href="/privacy-policy" className="text-text-on-dark/80 hover:text-brand-gold">
            {t("privacyPolicy")}
          </Link>
          <Link href="/terms-conditions" className="text-text-on-dark/80 hover:text-brand-gold">
            {t("termsConditions")}
          </Link>
        </div>

        {hasAnySocialLink ? (
          <div className="flex flex-col gap-2 text-sm">
            <h3 className="font-display text-base">{t("followUs")}</h3>
            {instagramHref ? (
              <a
                href={instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={tSocial("instagramLabel")}
                className="flex min-h-11 items-center gap-2 text-text-on-dark/80 hover:text-brand-gold"
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
                className="flex min-h-11 items-center gap-2 text-text-on-dark/80 hover:text-brand-gold"
              >
                <WhatsAppIcon size={18} /> {tSocial("whatsapp")}
              </a>
            ) : null}
            {tiktokUrl ? (
              <a
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center text-text-on-dark/80 hover:text-brand-gold"
              >
                {t("tiktok")}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-t border-text-on-dark/20 py-4 text-center text-xs text-text-on-dark/60">
        © {new Date().getFullYear()} ELORA JEWELLERY — {t("rightsReserved")}
      </div>
    </footer>
  );
}
