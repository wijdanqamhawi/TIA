"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/admin/DataTable";
import { BilingualField, type BilingualValue } from "@/components/admin/BilingualField";
import { CategorySelect, type CategoryOption } from "@/components/admin/CategorySelect";
import { ImageUploader } from "@/components/admin/ImageUploader";
import {
  createCategoryShowcaseAction,
  updateCategoryShowcaseAction,
  attachShowcaseImageAction,
} from "@/actions/admin/category-showcase.actions";

export type ShowcaseRow = {
  id: string;
  categoryId: string;
  categoryNameEn: string;
  title: BilingualValue;
  subtitle: BilingualValue | null;
  cta: BilingualValue;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
};

function ShowcaseDialog({
  showcase,
  categories,
  open,
  onClose,
}: {
  showcase: ShowcaseRow | null;
  categories: CategoryOption[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(showcase?.categoryId ?? categories[0]?.id ?? "");
  const [title, setTitle] = useState<BilingualValue>(showcase?.title ?? { en: "", ar: null });
  const [subtitle, setSubtitle] = useState<BilingualValue>(showcase?.subtitle ?? { en: "", ar: null });
  const [cta, setCta] = useState<BilingualValue>(showcase?.cta ?? { en: "", ar: null });
  const [displayOrder, setDisplayOrder] = useState(String(showcase?.displayOrder ?? 0));
  const [isActive, setIsActive] = useState(showcase?.isActive ?? true);
  const [desktopImage, setDesktopImage] = useState<{ url: string; storagePath: string } | null>(
    showcase?.desktopImageUrl ? { url: showcase.desktopImageUrl, storagePath: "" } : null,
  );
  const [mobileImage, setMobileImage] = useState<{ url: string; storagePath: string } | null>(
    showcase?.mobileImageUrl ? { url: showcase.mobileImageUrl, storagePath: "" } : null,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!desktopImage) {
      setError("A desktop image is required.");
      return;
    }

    const payload = {
      categoryId,
      title,
      subtitle: subtitle.en.trim() === "" ? null : subtitle,
      cta,
      desktopImage,
      mobileImage: mobileImage ?? null,
      displayOrder: Number.parseInt(displayOrder, 10) || 0,
      isActive,
    };

    startTransition(async () => {
      const result = showcase
        ? await updateCategoryShowcaseAction({ showcaseId: showcase.id, ...payload })
        : await createCategoryShowcaseAction(payload);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  async function handleUpload(slot: "desktop" | "mobile", image: { url: string; storagePath: string }) {
    if (slot === "desktop") setDesktopImage(image);
    else setMobileImage(image);

    if (showcase) {
      await attachShowcaseImageAction({ showcaseId: showcase.id, slot, image });
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={showcase ? `Edit — ${showcase.title.en}` : "New Showcase"} className="w-[min(90vw,40rem)]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Category
          <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
        </label>
        <BilingualField label="Title" value={title} onChange={setTitle} />
        <BilingualField label="Subtitle" value={subtitle} onChange={setSubtitle} required={false} />
        <BilingualField label="Call to action" value={cta} onChange={setCta} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Display order
          <Input type="number" min="0" step="1" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active (visible on homepage)
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Desktop image</span>
            {desktopImage ? (
              <div className="relative h-24 w-full overflow-hidden rounded-md bg-brand-beige">
                <Image src={desktopImage.url} alt="Desktop showcase" fill sizes="300px" className="object-cover" />
              </div>
            ) : null}
            <ImageUploader folder={`showcases/${showcase?.id ?? "new"}`} onUploaded={(img) => handleUpload("desktop", img)} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Mobile image (optional)</span>
            {mobileImage ? (
              <div className="relative h-24 w-full overflow-hidden rounded-md bg-brand-beige">
                <Image src={mobileImage.url} alt="Mobile showcase" fill sizes="300px" className="object-cover" />
              </div>
            ) : null}
            <ImageUploader folder={`showcases/${showcase?.id ?? "new"}`} onUploaded={(img) => handleUpload("mobile", img)} />
          </div>
        </div>

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

/** Admin — Homepage Category Showcases (T160). */
export function ShowcaseManager({ showcases, categories }: { showcases: ShowcaseRow[]; categories: CategoryOption[] }) {
  const [editing, setEditing] = useState<ShowcaseRow | null | "new">(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>+ New Showcase</Button>
      </div>
      <DataTable
        rows={showcases}
        rowKey={(row) => row.id}
        emptyMessage="No homepage showcases yet."
        columns={[
          {
            header: "Category",
            render: (row) => (
              <button type="button" onClick={() => setEditing(row)} className="font-medium text-brand-burgundy hover:underline">
                {row.categoryNameEn}
              </button>
            ),
          },
          { header: "Title", render: (row) => row.title.en },
          { header: "Order", render: (row) => row.displayOrder },
          {
            header: "Status",
            render: (row) => <Badge variant={row.isActive ? "burgundy" : "neutral"}>{row.isActive ? "Active" : "Hidden"}</Badge>,
          },
        ]}
      />
      {editing ? (
        <ShowcaseDialog
          showcase={editing === "new" ? null : editing}
          categories={categories}
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
