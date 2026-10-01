import { notFound } from "next/navigation";
import { ordersCollection } from "@/lib/firebase/firestore";
import { getProductsByIds } from "@/lib/domain/catalog/product.service";
import { getAdminTranslator } from "@/lib/i18n/admin";
import {
  AdminOrderDetailView,
  type OrderDetailTranslate,
} from "@/components/admin/AdminOrderDetailView";

export const dynamic = "force-dynamic";

/**
 * Admin — Order Details (T165): the stored order laid out compactly — summary cards, items with the
 * prices actually paid, customer & delivery, order information — plus the status control that reuses the
 * Admin > Orders flow (existing transition rules and protected `updateOrderStatusAction`). Every figure is
 * the order's own snapshot; the only live read is each product's photo.
 */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [snapshot, { t, locale }] = await Promise.all([
    ordersCollection().doc(id).get(),
    getAdminTranslator("AdminOrders"),
  ]);
  if (!snapshot.exists) {
    notFound();
  }
  const order = snapshot.data()!;

  // Orders store no product image: one batched read for the photos. A deleted product simply has none.
  const products = await getProductsByIds(order.items.map((item) => item.productId));
  const thumbnails = Object.fromEntries(
    order.items.map((item) => [
      item.productId,
      products.get(item.productId)?.images[0]?.url ?? null,
    ]),
  );

  return (
    <AdminOrderDetailView
      t={t as unknown as OrderDetailTranslate}
      locale={locale}
      order={order}
      thumbnails={thumbnails}
    />
  );
}
