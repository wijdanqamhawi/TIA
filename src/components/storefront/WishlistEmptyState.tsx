import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

/** The empty-wishlist state (spec User Story 3, mirrors `CartEmptyState`). */
export async function WishlistEmptyState({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Wishlist" });

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
