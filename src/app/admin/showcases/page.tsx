import { CircleCheck, CircleX, LayoutPanelTop, Layers } from "lucide-react";
import { getAllCategoryShowcases } from "@/lib/domain/catalog/categoryShowcase.service";
import { getAllCategories } from "@/lib/domain/catalog/category.service";
import { getAdminTranslator } from "@/lib/i18n/admin";
import { StatCard } from "@/components/admin/StatCard";
import { ShowcaseManager, type ShowcaseRow } from "@/components/admin/ShowcaseManager";

export const dynamic = "force-dynamic";

/** Admin — Homepage Category Showcases (T160): summary figures, the showcase list, and add/edit. */
export default async function AdminShowcasesPage() {
  const [showcases, categories, { t, locale }] = await Promise.all([
    getAllCategoryShowcases(),
    getAllCategories(),
    getAdminTranslator("AdminShowcases"),
  ]);
  const categoryNames = new Map(
    categories.map((c) => [c.id, locale === "ar" ? c.name.ar || c.name.en : c.name.en]),
  );

  const rows: ShowcaseRow[] = showcases.map((showcase) => ({
    id: showcase.id,
    categoryId: showcase.categoryId,
    categoryName: categoryNames.get(showcase.categoryId) ?? "—",
    title: showcase.title,
    subtitle: showcase.subtitle,
    cta: showcase.cta,
    // The full image records (url + storagePath), so saving an edit without re-uploading keeps them intact.
    desktopImage: showcase.desktopImage ?? null,
    mobileImage: showcase.mobileImage ?? null,
    displayOrder: showcase.displayOrder,
    isActive: showcase.isActive,
  }));

  const activeCount = rows.filter((row) => row.isActive).length;
  const stats = [
    { key: "total", value: rows.length, icon: LayoutPanelTop, tone: "gold" },
    { key: "active", value: activeCount, icon: CircleCheck, tone: "green" },
    { key: "inactive", value: rows.length - activeCount, icon: CircleX, tone: "red" },
    { key: "categories", value: categories.length, icon: Layers, tone: "gold" },
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

      <ShowcaseManager
        showcases={rows}
        categories={categories.map((c) => ({ id: c.id, nameEn: c.name.en, isActive: c.isActive }))}
      />
    </div>
  );
}
