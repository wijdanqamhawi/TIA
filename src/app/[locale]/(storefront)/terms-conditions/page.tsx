import { getTranslations } from "next-intl/server";
import { LegalPagePlaceholder } from "@/components/storefront/LegalPagePlaceholder";

/** T215: Terms & Conditions — clearly-marked placeholder, never invented policy text. */
export default async function TermsConditionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  return <LegalPagePlaceholder locale={locale} title={t("termsConditionsTitle")} />;
}
