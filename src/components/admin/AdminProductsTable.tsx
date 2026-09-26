"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils/currency";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/admin/DataTable";
import { setProductFlagAction, updateProductAction, deleteProductAction } from "@/actions/admin/product.actions";
import type { OfferStatus } from "@/lib/domain/catalog/offer";

export type AdminProductRow = {
  id: string;
  nameEn: string;
  categoryNameEn: string;
  price: number;
  stock: number;
  isSoldOut: boolean;
  availability: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  offerStatus: OfferStatus;
};

const OFFER_BADGE: Record<OfferStatus, { label: string; variant: "neutral" | "gold" | "burgundy" | "danger" }> = {
  DISABLED: { label: "No Offer", variant: "neutral" },
  SCHEDULED: { label: "Scheduled", variant: "gold" },
  ACTIVE: { label: "On Sale", variant: "burgundy" },
  EXPIRED: { label: "Expired", variant: "danger" },
};

/** T150 — the full admin product list, superseding the earlier offer-only table. */
export function AdminProductsTable({ products }: { products: AdminProductRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggleFlag(productId: string, flag: "isNewArrival" | "isBestSeller", value: boolean) {
    setPendingId(productId);
    await setProductFlagAction({ productId, flag, value: !value });
    setPendingId(null);
    router.refresh();
  }

  // The storefront-visibility toggle is a distinct field from
  // `isNewArrival`/`isBestSeller` (remediation finding F2) — it goes
  // through `updateProductAction` (T144), never `setProductFlagAction`
  // (T146), so it can never be confused with the derived Sold Out state.
  async function toggleAvailability(productId: string, value: boolean) {
    setPendingId(productId);
    await updateProductAction({ productId, availability: !value });
    setPendingId(null);
    router.refresh();
  }

  async function handleDelete(productId: string, nameEn: string) {
    if (!window.confirm(`Delete "${nameEn}"? This cannot be undone.`)) return;
    setPendingId(productId);
    await deleteProductAction({ productId });
    setPendingId(null);
    router.refresh();
  }

  return (
    <DataTable
      rows={products}
      rowKey={(row) => row.id}
      emptyMessage="No products yet. Create your first product to get started."
      columns={[
        {
          header: "Product",
          render: (row) => (
            <Link href={`/admin/products/${row.id}/edit`} className="font-medium text-brand-burgundy hover:underline">
              {row.nameEn}
            </Link>
          ),
        },
        { header: "Category", render: (row) => row.categoryNameEn },
        { header: "Price", render: (row) => formatCurrency(row.price, "en-US") },
        {
          header: "Stock",
          render: (row) => (row.isSoldOut ? <Badge variant="danger">Sold Out</Badge> : row.stock),
        },
        { header: "Offer", render: (row) => <Badge variant={OFFER_BADGE[row.offerStatus].variant}>{OFFER_BADGE[row.offerStatus].label}</Badge> },
        {
          header: "Visible",
          render: (row) => (
            <button
              type="button"
              disabled={pendingId === row.id}
              onClick={() => toggleAvailability(row.id, row.availability)}
              className="rounded-md border border-border-luxury px-2 py-1 text-xs hover:bg-brand-beige disabled:opacity-50"
            >
              {row.availability ? "Visible" : "Hidden"}
            </button>
          ),
        },
        {
          header: "New Arrival",
          render: (row) => (
            <button
              type="button"
              disabled={pendingId === row.id}
              onClick={() => toggleFlag(row.id, "isNewArrival", row.isNewArrival)}
              className="rounded-md border border-border-luxury px-2 py-1 text-xs hover:bg-brand-beige disabled:opacity-50"
            >
              {row.isNewArrival ? "Yes" : "No"}
            </button>
          ),
        },
        {
          header: "Best Seller",
          render: (row) => (
            <button
              type="button"
              disabled={pendingId === row.id}
              onClick={() => toggleFlag(row.id, "isBestSeller", row.isBestSeller)}
              className="rounded-md border border-border-luxury px-2 py-1 text-xs hover:bg-brand-beige disabled:opacity-50"
            >
              {row.isBestSeller ? "Yes" : "No"}
            </button>
          ),
        },
        {
          header: "",
          render: (row) => (
            <Button variant="outline" size="sm" disabled={pendingId === row.id} onClick={() => handleDelete(row.id, row.nameEn)}>
              Delete
            </Button>
          ),
        },
      ]}
    />
  );
}
