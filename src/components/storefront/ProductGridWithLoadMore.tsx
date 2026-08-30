"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { loadMoreProductsAction } from "@/actions/catalog.actions";
import type { ListProductsParams } from "@/lib/domain/catalog/product.service";
import type { ProductCardData } from "@/lib/domain/catalog/product.service";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductCard } from "./ProductCard";
import { PRODUCT_GRID_CLASS } from "./productGrid";

/**
 * Renders the initial server-fetched product page, then loads additional
 * pages via Firestore cursor-based pagination (research.md §17) as the
 * shopper clicks "Load More" — never loading the full product set at once.
 */
export function ProductGridWithLoadMore({
  locale,
  initialProducts,
  initialCursorId,
  filters,
}: {
  locale: string;
  initialProducts: ProductCardData[];
  initialCursorId: string | null;
  filters: Omit<ListProductsParams, "cursorId">;
}) {
  const t = useTranslations("Shop");
  const tCommon = useTranslations("Common");
  const [products, setProducts] = useState(initialProducts);
  const [cursorId, setCursorId] = useState(initialCursorId);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    startTransition(async () => {
      const result = await loadMoreProductsAction({ ...filters, cursorId });
      setProducts((prev) => [...prev, ...result.products]);
      setCursorId(result.nextCursorId);
    });
  }

  if (products.length === 0) {
    return <EmptyState title={t("noResults")} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className={PRODUCT_GRID_CLASS} data-testid="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} locale={locale} />
        ))}
      </div>

      {cursorId ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={loadMore} disabled={isPending}>
            {isPending ? tCommon("loading") : t("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
