import { getTranslations } from "next-intl/server";
import { LegalPagePlaceholder } from "@/components/storefront/LegalPagePlaceholder";

/** T215: Shipping & Delivery — clearly-marked placeholder, never invented policy text. */
export default async function ShippingDeliveryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  return <LegalPagePlaceholder locale={locale} title={t("shippingDeliveryTitle")} />;
}
