import { getAllCategories } from "@/lib/domain/catalog/category.service";
import { CategoryManager, type CategoryRow } from "@/components/admin/CategoryManager";

export const dynamic = "force-dynamic";

/** Admin — Categories (T156). */
export default async function AdminCategoriesPage() {
  const categories = await getAllCategories();

  const rows: CategoryRow[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    displayOrder: category.displayOrder,
    isActive: category.isActive,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Categories</h1>
        <p className="mt-1 text-sm text-text-primary/70">Manage the catalog&apos;s category list.</p>
      </div>
      <CategoryManager categories={rows} />
    </div>
  );
}
