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
import { WelcomeSplash } from "@/components/storefront/WelcomeSplash";
import { ViewportInsetsProvider } from "@/components/storefront/ViewportInsets";
import { PWA_THEME_COLOR } from "@/lib/config/brandColors";
import { buildWhatsAppHref } from "@/lib/config/social";
import "../globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
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
  title: "ELORA JEWELLERY",
  description: "ELORA JEWELLERY — Bracelets, Rings, Earrings & Watches",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ELORA JEWELLERY",
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

  return (
    <html lang={locale} dir={dir}>
      <body
        className={`${playfairDisplay.variable} ${inter.variable} ${notoKufiArabic.variable} ${notoSansArabic.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages} locale={locale as Locale}>
          {/* Both bottom-anchored fixed elements live inside the provider
              so they coordinate their placement instead of overlapping
              (T207/T210, research.md §30). */}
          <ViewportInsetsProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar locale={locale} />
              <div className="flex-1">{children}</div>
              <Footer locale={locale} />
            </div>
            <WelcomeSplash whatsappHref={whatsappHref} />
            <InstallPrompt />
            <FloatingWhatsApp href={whatsappHref} />
          </ViewportInsetsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
