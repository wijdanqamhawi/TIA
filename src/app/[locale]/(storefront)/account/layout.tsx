import { redirect } from "next/navigation";
import { getSessionClaims } from "@/lib/firebase/guards";

// This route reads the session cookie to make a per-request authorization
// decision; it must never be statically prerendered/cached (that would
// freeze whichever visitor's auth state happened to be true at build
// time — e.g. always redirecting, even for a later signed-in customer).
export const dynamic = "force-dynamic";

/**
 * Guards every `/[locale]/account/*` route (spec FR-034/FR-035): a guest
 * is redirected to `/[locale]/login`, never shown even a partially-hidden
 * account UI. This is the real enforcement point — hidden navigation is
 * never sufficient (Constitution Principle 6).
 */
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const claims = await getSessionClaims();

  if (!claims) {
    redirect(`/${locale}/login?next=/${locale}/account`);
  }

  return <>{children}</>;
}
