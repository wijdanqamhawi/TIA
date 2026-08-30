"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/admin/DataTable";
import { BilingualField, type BilingualValue } from "@/components/admin/BilingualField";
import { updateCategoryAction } from "@/actions/admin/category.actions";

export type CategoryRow = {
  id: string;
  name: BilingualValue;
  description: BilingualValue | null;
  displayOrder: number;
  isActive: boolean;
};

function CategoryDialog({ category, open, onClose }: { category: CategoryRow; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<BilingualValue>(category.name);
  const [description, setDescription] = useState<BilingualValue>(category.description ?? { en: "", ar: null });
  const [displayOrder, setDisplayOrder] = useState(String(category.displayOrder));
  const [isActive, setIsActive] = useState(category.isActive);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateCategoryAction({
        categoryId: category.id,
        name,
        description: description.en.trim() === "" ? null : description,
        displayOrder: Number.parseInt(displayOrder, 10) || 0,
        isActive,
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Edit — ${category.name.en}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <BilingualField label="Name" value={name} onChange={setName} />
        <BilingualField label="Description" value={description} onChange={setDescription} multiline required={false} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Display order
          <Input type="number" min="0" step="1" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active (visible on storefront)
        </label>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Admin — Categories (T156): edits the storefront's fixed category set
 * (bilingual name/description, active/inactive, display order) only — this
 * page deliberately has no create/delete control (T155/T156's explicit
 * constraint; the four core categories are seeded once, never added to or
 * removed through the admin UI).
 */
export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const [editing, setEditing] = useState<CategoryRow | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        rows={categories}
        rowKey={(row) => row.id}
        emptyMessage="No categories found."
        columns={[
          {
            header: "Name",
            render: (row) => (
              <button type="button" onClick={() => setEditing(row)} className="font-medium text-brand-burgundy hover:underline">
                {row.name.en}
              </button>
            ),
          },
          { header: "Order", render: (row) => row.displayOrder },
          {
            header: "Status",
            render: (row) => <Badge variant={row.isActive ? "burgundy" : "neutral"}>{row.isActive ? "Active" : "Hidden"}</Badge>,
          },
        ]}
      />
      {editing ? <CategoryDialog category={editing} open={Boolean(editing)} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
