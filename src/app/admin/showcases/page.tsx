import { getAllCategoryShowcases } from "@/lib/domain/catalog/categoryShowcase.service";
import { getAllCategories, getActiveCategories } from "@/lib/domain/catalog/category.service";
import { ShowcaseManager, type ShowcaseRow } from "@/components/admin/ShowcaseManager";

export const dynamic = "force-dynamic";

/** Admin — Homepage Category Showcases (T160). */
export default async function AdminShowcasesPage() {
  const [showcases, categories, activeCategories] = await Promise.all([
    getAllCategoryShowcases(),
    getAllCategories(),
    getActiveCategories(),
  ]);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name.en]));

  const rows: ShowcaseRow[] = showcases.map((showcase) => ({
    id: showcase.id,
    categoryId: showcase.categoryId,
    categoryNameEn: categoryNames.get(showcase.categoryId) ?? "—",
    title: showcase.title,
    subtitle: showcase.subtitle,
    cta: showcase.cta,
    desktopImageUrl: showcase.desktopImage?.url ?? null,
    mobileImageUrl: showcase.mobileImage?.url ?? null,
    displayOrder: showcase.displayOrder,
    isActive: showcase.isActive,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Homepage Showcases</h1>
        <p className="mt-1 text-sm text-text-primary/70">Manage each category&apos;s large homepage merchandising section.</p>
      </div>
      <ShowcaseManager showcases={rows} categories={activeCategories.map((c) => ({ id: c.id, nameEn: c.name.en }))} />
    </div>
  );
}
