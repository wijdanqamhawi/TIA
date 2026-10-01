import { Box, CircleCheck, CircleX, Layers } from "lucide-react";
import { getAllCategories } from "@/lib/domain/catalog/category.service";
import { getProductCountsByCategory } from "@/lib/domain/catalog/product.service";
import { getAdminTranslator } from "@/lib/i18n/admin";
import { StatCard } from "@/components/admin/StatCard";
import { CategoryManager, type CategoryRow } from "@/components/admin/CategoryManager";

export const dynamic = "force-dynamic";

/** Admin — Categories (T156): summary figures, the category list with real product counts, and add/edit. */
export default async function AdminCategoriesPage() {
  const [categories, productCounts, { t }] = await Promise.all([
    getAllCategories(),
    getProductCountsByCategory(),
    getAdminTranslator("AdminCategories"),
  ]);

  const rows: CategoryRow[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    displayOrder: category.displayOrder,
    isActive: category.isActive,
    productCount: productCounts.byCategory[category.id] ?? 0,
  }));

  const activeCount = rows.filter((row) => row.isActive).length;
  const stats = [
    { key: "total", value: rows.length, icon: Box, tone: "gold" },
    { key: "active", value: activeCount, icon: CircleCheck, tone: "green" },
    { key: "inactive", value: rows.length - activeCount, icon: CircleX, tone: "red" },
    { key: "products", value: productCounts.total, icon: Layers, tone: "gold" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-1">
        <h1 className="font-display text-[32px] font-normal leading-[1.1] text-brand-burgundy lg:text-[38px] rtl:text-[28px] rtl:leading-[1.4] rtl:lg:text-[32px]">
          {t("title")}
        </h1>
        <p className="mt-1.5 font-display text-[15px] leading-snug text-text-secondary lg:text-[16px] rtl:font-body rtl:text-[14.5px]">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-[13px] xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.key}
            label={t(`stats.${stat.key}`)}
            value={stat.value}
            icon={stat.icon}
            tone={stat.tone}
          />
        ))}
      </div>

      <CategoryManager categories={rows} />
    </div>
  );
}
