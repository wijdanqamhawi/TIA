"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { BilingualField, type BilingualValue } from "@/components/admin/BilingualField";
import { CategorySelect, type CategoryOption } from "@/components/admin/CategorySelect";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { createProductAction, updateProductAction } from "@/actions/admin/product.actions";
import {
  attachUploadedImageAction,
  removeProductImageAction,
  reorderProductImagesAction,
} from "@/actions/admin/media.actions";
import type { ProductOption } from "@/types/product";

export type ProductFormInitial = {
  productId?: string;
  name: BilingualValue;
  description: BilingualValue;
  material: BilingualValue;
  price: number; // minor units
  categoryId: string;
  options: ProductOption[];
  stock: number;
  availability: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isOnSale: boolean;
  salePrice: number | null; // minor units
  saleStartAt: string | null; // ISO
  saleEndAt: string | null; // ISO
  images: { url: string; storagePath: string; position: number; alt: string }[];
};

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

let optionKeySeq = 0;
function nextKey(prefix: string) {
  optionKeySeq += 1;
  return `${prefix}-${Date.now()}-${optionKeySeq}`;
}

export function ProductForm({
  mode,
  initial,
  categories,
}: {
  mode: "create" | "edit";
  initial: ProductFormInitial;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [name, setName] = useState<BilingualValue>(initial.name);
  const [description, setDescription] = useState<BilingualValue>(initial.description);
  const [material, setMaterial] = useState<BilingualValue>(initial.material);
  const [priceInput, setPriceInput] = useState(String(initial.price / 100));
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [options, setOptions] = useState<ProductOption[]>(initial.options);
  const [stockInput, setStockInput] = useState(String(initial.stock));
  const [availability, setAvailability] = useState(initial.availability);
  const [isNewArrival, setIsNewArrival] = useState(initial.isNewArrival);
  const [isBestSeller, setIsBestSeller] = useState(initial.isBestSeller);
  const [isOnSale, setIsOnSale] = useState(initial.isOnSale);
  const [salePriceInput, setSalePriceInput] = useState(initial.salePrice != null ? String(initial.salePrice / 100) : "");
  const [saleStartAt, setSaleStartAt] = useState(toDateTimeLocal(initial.saleStartAt));
  const [saleEndAt, setSaleEndAt] = useState(toDateTimeLocal(initial.saleEndAt));
  const [images, setImages] = useState(initial.images);

  function addOption() {
    setOptions((prev) => [
      ...prev,
      { key: nextKey("option"), name: { en: "", ar: null }, values: [{ key: nextKey("value"), label: { en: "", ar: null } }] },
    ]);
  }

  function updateOption(index: number, patch: Partial<ProductOption>) {
    setOptions((prev) => prev.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function addOptionValue(optionIndex: number) {
    setOptions((prev) =>
      prev.map((option, i) =>
        i === optionIndex
          ? { ...option, values: [...option.values, { key: nextKey("value"), label: { en: "", ar: null } }] }
          : option,
      ),
    );
  }

  function updateOptionValue(optionIndex: number, valueIndex: number, label: BilingualValue) {
    setOptions((prev) =>
      prev.map((option, i) =>
        i === optionIndex
          ? { ...option, values: option.values.map((v, vi) => (vi === valueIndex ? { ...v, label } : v)) }
          : option,
      ),
    );
  }

  function removeOptionValue(optionIndex: number, valueIndex: number) {
    setOptions((prev) =>
      prev.map((option, i) =>
        i === optionIndex ? { ...option, values: option.values.filter((_, vi) => vi !== valueIndex) } : option,
      ),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const priceMinorUnits = Math.round(Number.parseFloat(priceInput) * 100);
    const stock = Number.parseInt(stockInput, 10);
    const salePriceMinorUnits = salePriceInput.trim() === "" ? null : Math.round(Number.parseFloat(salePriceInput) * 100);

    const payload = {
      name,
      description,
      material,
      price: priceMinorUnits,
      categoryId,
      images: mode === "create" ? [] : images,
      options,
      stock,
      availability,
      isNewArrival,
      isBestSeller,
      isOnSale,
      salePrice: salePriceMinorUnits,
      saleStartAt: saleStartAt ? new Date(saleStartAt) : null,
      saleEndAt: saleEndAt ? new Date(saleEndAt) : null,
    };

    startTransition(async () => {
      if (mode === "create") {
        const result = await createProductAction(payload);
        if (!result.ok) {
          setError(result.error.message);
          setFieldErrors(result.error.fieldErrors ?? {});
          return;
        }
        router.refresh();
        router.push(`/admin/products/${result.data.productId}/edit`);
        return;
      }

      const result = await updateProductAction({ productId: initial.productId!, ...payload });
      if (!result.ok) {
        setError(result.error.message);
        setFieldErrors(result.error.fieldErrors ?? {});
        return;
      }
      router.refresh();
      router.push("/admin/products");
    });
  }

  async function handleImageUploaded(image: { url: string; storagePath: string }) {
    if (!initial.productId) return;
    const result = await attachUploadedImageAction({
      productId: initial.productId,
      image: { url: image.url, storagePath: image.storagePath, alt: name.en || "Product image" },
    });
    if (result.ok) {
      setImages((prev) => [...prev, { ...image, alt: name.en || "Product image", position: prev.length }]);
    }
  }

  async function handleRemoveImage(storagePath: string) {
    if (!initial.productId) return;
    const result = await removeProductImageAction({ productId: initial.productId, storagePath });
    if (result.ok) {
      setImages((prev) => prev.filter((img) => img.storagePath !== storagePath).map((img, i) => ({ ...img, position: i })));
    }
  }

  async function handleMoveImage(index: number, direction: -1 | 1) {
    if (!initial.productId) return;
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const reordered = [...images];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const result = await reorderProductImagesAction({
      productId: initial.productId,
      orderedStoragePaths: reordered.map((img) => img.storagePath),
    });
    if (result.ok) {
      setImages(reordered.map((img, i) => ({ ...img, position: i })));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <BilingualField label="Name" value={name} onChange={setName} errorEn={fieldErrors["name"]?.[0]} />
      <BilingualField label="Description" value={description} onChange={setDescription} multiline errorEn={fieldErrors["description"]?.[0]} />
      <BilingualField label="Material" value={material} onChange={setMaterial} errorEn={fieldErrors["material"]?.[0]} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Price
          <Input type="number" min="0.01" step="0.01" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} required />
          <FormError message={fieldErrors["price"]?.[0]} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Category
          <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
          <FormError message={fieldErrors["categoryId"]?.[0]} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Stock
          <Input type="number" min="0" step="1" value={stockInput} onChange={(e) => setStockInput(e.target.value)} required />
          <FormError message={fieldErrors["stock"]?.[0]} />
        </label>
      </div>

      <div className="flex flex-wrap gap-4 text-sm font-medium">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={availability} onChange={(e) => setAvailability(e.target.checked)} />
          Available on storefront
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={isNewArrival} onChange={(e) => setIsNewArrival(e.target.checked)} />
          New Arrival
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={isBestSeller} onChange={(e) => setIsBestSeller(e.target.checked)} />
          Best Seller
        </label>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border-luxury p-4">
        <legend className="px-1 text-sm font-medium">Options (e.g. Size, Color)</legend>
        {options.map((option, optionIndex) => (
          <div key={option.key} className="flex flex-col gap-2 rounded-md border border-border-luxury p-3">
            <div className="flex items-center gap-2">
              <Input
                value={option.name.en}
                placeholder="Option name (English)"
                onChange={(e) => updateOption(optionIndex, { name: { ...option.name, en: e.target.value } })}
              />
              <Input
                value={option.name.ar ?? ""}
                placeholder="اسم الخيار (Arabic)"
                dir="rtl"
                onChange={(e) =>
                  updateOption(optionIndex, { name: { ...option.name, ar: e.target.value === "" ? null : e.target.value } })
                }
              />
              <Button type="button" variant="outline" size="sm" onClick={() => removeOption(optionIndex)}>
                Remove
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value, valueIndex) => (
                <div key={value.key} className="flex items-center gap-1">
                  <Input
                    value={value.label.en}
                    placeholder="Value (English)"
                    onChange={(e) => updateOptionValue(optionIndex, valueIndex, { ...value.label, en: e.target.value })}
                  />
                  <Input
                    value={value.label.ar ?? ""}
                    placeholder="القيمة (Arabic)"
                    dir="rtl"
                    onChange={(e) =>
                      updateOptionValue(optionIndex, valueIndex, {
                        ...value.label,
                        ar: e.target.value === "" ? null : e.target.value,
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeOptionValue(optionIndex, valueIndex)}
                    aria-label="Remove value"
                    className="rounded-md px-2 py-1 text-text-primary/70 hover:bg-brand-beige"
                  >
                    ×
                  </button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => addOptionValue(optionIndex)}>
                + Value
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addOption} className="self-start">
          + Add Option
        </Button>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-lg border border-border-luxury p-4">
        <legend className="px-1 text-sm font-medium">Special Offer</legend>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4" checked={isOnSale} onChange={(e) => setIsOnSale(e.target.checked)} />
          Enable this offer
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Sale price
            <Input type="number" min="0.01" step="0.01" value={salePriceInput} onChange={(e) => setSalePriceInput(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Start date (optional)
            <Input type="datetime-local" value={saleStartAt} onChange={(e) => setSaleStartAt(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            End date (optional)
            <Input type="datetime-local" value={saleEndAt} onChange={(e) => setSaleEndAt(e.target.value)} />
          </label>
        </div>
        <FormError message={fieldErrors["salePrice"]?.[0]} />
      </fieldset>

      {mode === "edit" && initial.productId ? (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-border-luxury p-4">
          <legend className="px-1 text-sm font-medium">Images</legend>
          <div className="flex flex-wrap gap-3">
            {images.map((image, index) => (
              <div key={image.storagePath} className="flex flex-col items-center gap-1">
                <div className="relative h-24 w-24 overflow-hidden rounded-md bg-brand-beige">
                  <Image src={image.url} alt={image.alt} fill sizes="96px" className="object-cover" />
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => handleMoveImage(index, -1)} className="rounded px-1.5 text-xs hover:bg-brand-beige">
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(image.storagePath)}
                    className="rounded px-1.5 text-xs text-red-700 hover:bg-brand-beige"
                  >
                    Remove
                  </button>
                  <button type="button" onClick={() => handleMoveImage(index, 1)} className="rounded px-1.5 text-xs hover:bg-brand-beige">
                    →
                  </button>
                </div>
              </div>
            ))}
          </div>
          <ImageUploader folder={`products/${initial.productId}`} onUploaded={handleImageUploaded} />
        </fieldset>
      ) : null}

      <FormError message={error} />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/products")} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create Product" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
