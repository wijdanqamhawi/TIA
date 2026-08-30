import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

/** The empty-cart state (spec: Cart page). */
export async function CartEmptyState({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Cart" });

  return (
    <EmptyState
      title={t("emptyTitle")}
      description={t("emptyDescription")}
      action={
        <Link href="/shop">
          <Button type="button">{t("continueShopping")}</Button>
        </Link>
      }
    />
  );
}
