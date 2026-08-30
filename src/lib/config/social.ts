/**
 * The single centralized Instagram/WhatsApp configuration (T202,
 * research.md §28/§37, spec FR-006a/FR-006b). Every Instagram/WhatsApp
 * control anywhere in the app — `Navbar` (T204), `MobileNav` (T205),
 * `Footer` (T206), `FloatingWhatsApp` (T207) — reads through this module.
 * None of them touches `process.env` directly or holds its own copy of a
 * URL/number, so "every consumer reads from one place" is structurally
 * true rather than a convention that could be violated later
 * (Constitution Principle 11).
 *
 * `NEXT_PUBLIC_*` is required (not a server-only var) because these links
 * are rendered and clicked entirely client-side — an `<a href>`, not a
 * server round trip — and carry no secret (same reasoning as the Firebase
 * client config, research.md §2). Each var MUST be referenced as a
 * literal `process.env.NEXT_PUBLIC_…` expression: Next.js inlines these at
 * build time by static text replacement, so a computed/dynamic lookup
 * would silently read `undefined` in the browser bundle.
 *
 * If the store owner later wants to self-serve edit these without a
 * redeploy, migrating this one function to read Firestore instead of
 * `process.env` is a localized, single-file change precisely because every
 * consumer already goes through it.
 */

export type SocialConfig = {
  /** The configured Instagram profile URL, or `null` when unconfigured. */
  instagramUrl: string | null;
  /** E.164 phone (e.g. `+15551234567`), or `null` when unconfigured. */
  whatsappPhone: string | null;
  /** Bilingual pre-filled greeting; `ar` is optional and falls back to `en` (research.md §37). */
  whatsappDefaultMessage: { en: string; ar: string | null };
};

/** Treats a missing, empty, or whitespace-only env var as unconfigured. */
function readOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getSocialConfig(): SocialConfig {
  return {
    instagramUrl: readOptional(process.env.NEXT_PUBLIC_INSTAGRAM_URL),
    whatsappPhone: readOptional(process.env.NEXT_PUBLIC_WHATSAPP_PHONE),
    whatsappDefaultMessage: {
      en: readOptional(process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_EN) ?? "",
      ar: readOptional(process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE_AR),
    },
  };
}

/**
 * The Instagram destination, returned unmodified (research.md §29):
 * Instagram's own iOS/Android apps register as the OS-level handler for
 * `instagram.com` universal links, so a plain anchor already hands off to
 * the app when installed and falls back to the browser otherwise — no
 * user-agent sniffing or `instagram://` deep-link scheme needed.
 *
 * Returns `null` when unconfigured, so every consumer can fail safe
 * (T208) rather than rendering a dead link.
 */
export function buildInstagramHref(config: SocialConfig = getSocialConfig()): string | null {
  return config.instagramUrl;
}

/**
 * The WhatsApp "click to chat" destination (research.md §29/§37):
 * `https://wa.me/<digitsOnly>?text=<encoded greeting>`. `wa.me` itself
 * routes to the WhatsApp app on mobile and WhatsApp Web/desktop otherwise,
 * so no platform-detection code is needed here.
 *
 * The greeting matching `locale` is selected, falling back to the English
 * message when Arabic is unset (the same `LocalizedString` fallback rule
 * used everywhere else). An explicit `message` overrides both. Returns
 * `null` when no phone is configured (T208).
 */
export function buildWhatsAppHref(
  locale: string,
  message?: string,
  config: SocialConfig = getSocialConfig(),
): string | null {
  if (!config.whatsappPhone) return null;

  // `wa.me` accepts digits only — strip the leading `+` and any spacing/
  // punctuation the store owner may have included in the E.164 value.
  const digitsOnly = config.whatsappPhone.replace(/\D/g, "");
  if (!digitsOnly) return null;

  const localized =
    locale === "ar" ? (config.whatsappDefaultMessage.ar ?? config.whatsappDefaultMessage.en) : config.whatsappDefaultMessage.en;
  const text = message ?? localized;

  return text ? `https://wa.me/${digitsOnly}?text=${encodeURIComponent(text)}` : `https://wa.me/${digitsOnly}`;
}
