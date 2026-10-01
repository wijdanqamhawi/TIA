import { getDashboardStats, getRecentOrders } from "@/lib/domain/admin/dashboard.service";
import { requireAdmin } from "@/lib/firebase/guards";
import { getAdminTranslator } from "@/lib/i18n/admin";
import { getCustomerById } from "@/lib/domain/admin/customer.service";
import { AdminDashboardView, type DashboardTranslate } from "@/components/admin/AdminDashboardView";

export const dynamic = "force-dynamic";

/** The signed-in staff member's first name for the greeting — best-effort, never blocks the dashboard. */
async function getFirstName(uid: string): Promise<string | null> {
  try {
    const user = await getCustomerById(uid);
    return user?.name?.trim().split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

/** Admin — Dashboard (T170): store-wide statistics, recent orders, and best sellers. */
export default async function AdminDashboardPage() {
  // The layout already ran requireAdmin(); this call gives the viewer's verified uid for the greeting.
  const viewer = await requireAdmin();
  const [{ stats, bestSellers, thumbnails }, recentOrders, { t, locale }, firstName] =
    await Promise.all([
      getDashboardStats(),
      getRecentOrders(),
      getAdminTranslator("AdminDashboard"),
      getFirstName(viewer.uid),
    ]);

  return (
    <AdminDashboardView
      t={t as unknown as DashboardTranslate}
      locale={locale}
      firstName={firstName}
      stats={stats}
      bestSellers={bestSellers}
      recentOrders={recentOrders}
      thumbnails={thumbnails}
    />
  );
}
