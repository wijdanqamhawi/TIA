import "server-only";
import { cookies } from "next/headers";
import { createTranslator } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";

/**
 * Admin-dashboard language. The dashboard lives outside the `[locale]`
 * segment, so its language is a per-browser preference kept in a cookie
 * (set by `setAdminLocaleAction`) rather than a URL prefix. Only the admin
 * shell and the Team page are translated for now; other admin pages keep
 * their English content inside the chosen direction.
 */
export const ADMIN_LOCALES = ["en", "ar"] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];
export const ADMIN_LOCALE_COOKIE = "tia_admin_locale";

/** The message namespaces the admin dashboard uses. */
const ADMIN_NAMESPACES = ["AdminShell", "AdminTeam"] as const;
type AdminNamespace = (typeof ADMIN_NAMESPACES)[number];

export function isAdminLocale(value: unknown): value is AdminLocale {
  return value === "en" || value === "ar";
}

export async function getAdminLocale(): Promise<AdminLocale> {
  const value = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  return isAdminLocale(value) ? value : "en";
}

export function adminDirection(locale: AdminLocale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Only the admin namespaces, so the client bundle never carries storefront copy. */
export async function getAdminMessages(locale: AdminLocale): Promise<AbstractIntlMessages> {
  const all = (await import(`../../../messages/${locale}.json`)).default as Record<string, AbstractIntlMessages>;
  return Object.fromEntries(ADMIN_NAMESPACES.map((ns) => [ns, all[ns]]));
}

export async function getAdminTranslator<N extends AdminNamespace>(namespace: N) {
  const locale = await getAdminLocale();
  const messages = await getAdminMessages(locale);
  return { t: createTranslator({ locale, messages, namespace }), locale };
}
