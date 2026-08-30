import { getTranslations } from "next-intl/server";
import { LegalPagePlaceholder } from "@/components/storefront/LegalPagePlaceholder";

/** T215: Privacy Policy — clearly-marked placeholder, never invented policy text. */
export default async function PrivacyPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  return <LegalPagePlaceholder locale={locale} title={t("privacyPolicyTitle")} />;
}
