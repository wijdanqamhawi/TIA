"use client";

export type CategoryOption = { id: string; nameEn: string };

/**
 * Category picker (T153) for the admin product form — options are always
 * `name.en` (Admin Dashboard chrome is deliberately English-only,
 * research.md §32); `categoryId` existence is re-verified server-side by
 * `createProductAction`/`updateProductAction` regardless of what this list
 * currently shows (Constitution Principle 13).
 */
export function CategorySelect({
  categories,
  value,
  onChange,
  id,
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (categoryId: string) => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
      className="block w-full min-h-11 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
    >
      <option value="" disabled>
        Select a category
      </option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.nameEn}
        </option>
      ))}
    </select>
  );
}
