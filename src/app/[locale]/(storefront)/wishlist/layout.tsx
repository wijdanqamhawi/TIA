import { redirect } from "next/navigation";
import { getSessionClaims } from "@/lib/firebase/guards";

// This route reads the session cookie to make a per-request authorization
// decision; it must never be statically prerendered/cached (mirrors
// `(storefront)/account/layout.tsx`).
export const dynamic = "force-dynamic";

/**
 * Guards `/[locale]/wishlist` (spec FR-033a): a guest is redirected to
 * `/[locale]/login`, never shown even a temporary/empty wishlist — there
 * is no guest wishlist to fall back to. This is the real enforcement
 * point; hidden navigation alone is never sufficient (Constitution
 * Principle 6). Mirrors `(storefront)/account/layout.tsx` exactly.
 */
export default async function WishlistLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const claims = await getSessionClaims();

  if (!claims) {
    redirect(`/${locale}/login?next=/${locale}/wishlist`);
  }

  return <>{children}</>;
}
