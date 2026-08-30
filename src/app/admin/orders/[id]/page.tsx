import { notFound } from "next/navigation";
import { ordersCollection } from "@/lib/firebase/firestore";
import { OrderDetailCard } from "@/components/storefront/OrderDetailCard";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

/**
 * Admin — Order Detail (T165): reuses `OrderDetailCard` (T126/T138) for the
 * items/total/payment/status/delivery-region summary so the admin view can
 * never render different item pricing than what the customer sees, plus an
 * admin-only panel with full contact/address/notes and the status-
 * transition control (T163/T172).
 */
export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await ordersCollection().doc(id).get();
  if (!snapshot.exists) {
    notFound();
  }
  const order = snapshot.data()!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Order {order.orderNumber}</h1>
          <p className="mt-1 text-sm text-text-primary/70">Placed {order.createdAt.toDate().toLocaleString("en-US")}</p>
        </div>
        <OrderStatusSelect orderId={order.id} status={order.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OrderDetailCard order={order} locale="en" />

        <Card>
          <CardHeader>
            <h2 className="font-display text-lg">Customer &amp; Delivery</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-3 text-sm">
            <div>
              <p className="font-medium text-text-primary/70">Customer</p>
              <p>{order.customerSnapshot.fullName}</p>
              <p>{order.customerSnapshot.email}</p>
              <p dir="ltr">{order.customerSnapshot.phone}</p>
              <p className="text-text-primary/70">{order.userId ? "Registered customer" : "Guest checkout"}</p>
            </div>
            <div>
              <p className="font-medium text-text-primary/70">Delivery Address</p>
              <p>{order.deliverySnapshot.regionName.en} — {order.deliverySnapshot.locationName.en}</p>
              <p>{order.deliverySnapshot.fullAddress}</p>
            </div>
            {order.notes ? (
              <div>
                <p className="font-medium text-text-primary/70">Notes</p>
                <p>{order.notes}</p>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
