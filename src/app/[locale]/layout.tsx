import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import {
  Playfair_Display,
  Inter,
  Noto_Kufi_Arabic,
  Noto_Sans_Arabic,
} from "next/font/google";
import { routing, type Locale } from "@/lib/i18n/routing";
import { Navbar } from "@/components/storefront/Navbar";
import { Footer } from "@/components/storefront/Footer";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { FloatingWhatsApp } from "@/components/storefront/FloatingWhatsApp";
import { WelcomeSplash, SPLASH_PREPAINT_SCRIPT } from "@/components/storefront/WelcomeSplash";
import { MobileBottomNav } from "@/components/storefront/MobileBottomNav";
import { ViewportInsetsProvider } from "@/components/storefront/ViewportInsets";
import { PWA_THEME_COLOR } from "@/lib/config/brandColors";
import { buildWhatsAppHref } from "@/lib/config/social";
import { getCartItemCount } from "@/lib/domain/cart/cart-count";
import "../globals.css";

// TIA's editorial serif, per the approved design board: Playfair Display —
// higher stroke contrast and more presence at headline sizes than the
// previous Cormorant Garamond, which read too light against the navy.
// Italic is loaded because the hero headline ends on an italic champagne
// clause ("a part of you."), the reference's signature typographic move.
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const notoKufiArabic = Noto_Kufi_Arabic({
  variable: "--font-noto-kufi-arabic",
  subsets: ["arabic"],
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-sans-arabic",
  subsets: ["arabic"],
  display: "swap",
});

/**
 * `appleWebApp` (T191, research.md §23) controls iOS/iPadOS home-screen
 * launch behavior once installed via Safari's "Add to Home Screen" — Next's
 * `app/apple-icon.png` convention (T190) supplies the actual icon; iOS does
 * not read the web manifest's icon list at all.
 */
export const metadata: Metadata = {
  title: "TIA — Accessories & More",
  description: "TIA — Accessories & More. Rings, earrings, bracelets and necklaces selected to become part of your everyday story.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TIA",
  },
};

export const viewport: Viewport = {
  themeColor: PWA_THEME_COLOR,
  width: "device-width",
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const dir = locale === "ar" ? "rtl" : "ltr";
  const messages = await getMessages();
  // Computed once, server-side, and shared by both consumers (T202's
  // "single source every consumer reads" contract) — WelcomeSplash's
  // WhatsApp button and the floating WhatsApp button must never be able to
  // disagree about the destination.
  const whatsappHref = buildWhatsAppHref(locale);
  // `MobileBottomNav` is a Client Component and cannot perform a server
  // read, so the count is resolved once here — in the same Server Component
  // that already mounts it — and passed down. The Navbar reads it itself.
  const cartCount = await getCartItemCount();

  return (
    // `suppressHydrationWarning`: the first-entry pre-paint script below may
    // add `data-tia-entered` to <html> before React hydrates.
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body
        className={`${playfairDisplay.variable} ${inter.variable} ${notoKufiArabic.variable} ${notoSansArabic.variable} antialiased`}
      >
        {/* Runs before the first paint: hides the server-rendered welcome
            screen at once for a session that has already entered. */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_PREPAINT_SCRIPT }} />
        <NextIntlClientProvider messages={messages} locale={locale as Locale}>
          {/* Both bottom-anchored fixed elements live inside the provider
              so they coordinate their placement instead of overlapping
              (T207/T210, research.md §30). */}
          <ViewportInsetsProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar locale={locale} />
              <div className="flex-1">{children}</div>
              <Footer locale={locale} />
              {/* Reserves space for the fixed mobile bar so the footer's
                  last row can always be scrolled clear of it. */}
              <div aria-hidden="true" className="h-16 lg:hidden" />
            </div>
            <MobileBottomNav cartCount={cartCount} />
            <WelcomeSplash />
            <InstallPrompt />
            <FloatingWhatsApp href={whatsappHref} />
          </ViewportInsetsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
