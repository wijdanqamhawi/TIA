import { locales } from "@/lib/i18n/routing";

/**
 * Turns the `?next=` value on /login and /register into a path that is safe to hand to the
 * locale-aware router.
 *
 * Several callers put the *already locale-prefixed* URL in `next` — the guards on
 * `/[locale]/account/*` and `/[locale]/wishlist` redirect to `/en/login?next=/en/account`, and
 * the wishlist heart on a product card sends `usePathname()` from `next/navigation`
 * (`/en/shop/...`). next-intl's `router.push` prefixes the locale unconditionally, so pushing
 * `/en/account` navigates to `/en/en/account`, which does not exist (Next.js 404).
 *
 * This strips a leading locale segment so the router can re-add the current one, and falls
 * back to `/` for anything that is not a plain same-site absolute path. `/admin/*` is
 * returned untouched: it lives outside the `[locale]` segment and is navigated with a full
 * page load by the login form.
 */
export function resolvePostLoginPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";

  for (const locale of locales) {
    if (raw === `/${locale}`) return "/";
    if (raw.startsWith(`/${locale}/`) || raw.startsWith(`/${locale}?`) || raw.startsWith(`/${locale}#`)) {
      const rest = raw.slice(locale.length + 1);
      return rest.startsWith("/") ? rest : `/${rest}`;
    }
  }
  return raw;
}
