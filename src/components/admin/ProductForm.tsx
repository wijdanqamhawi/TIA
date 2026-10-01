"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  ChevronDown,
  Eye,
  FileText,
  Gift,
  Image as ImageIcon,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DirectionalIcon } from "@/components/ui/DirectionalIcon";
import Image from "next/image";
import { FormError } from "@/components/ui/FormError";
import {
  BilingualField,
  type BilingualFieldAppearance,
  type BilingualValue,
} from "@/components/admin/BilingualField";
import { CategorySelect, type CategoryOption } from "@/components/admin/CategorySelect";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { createProductAction, updateProductAction } from "@/actions/admin/product.actions";
import { formatCurrency } from "@/lib/utils/currency";
import {
  DISCOUNT_ERROR_KEY,
  initialDiscountInput,
  resolveOfferSalePrice,
} from "@/lib/domain/catalog/offer-discount";
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

/** Shared field styling for the admin product form — 40px fields on desktop, 44px touch targets below. */
const FIELD =
  "block h-11 w-full rounded-lg border border-brand-burgundy/[0.12] bg-white px-3.5 text-[14px] text-brand-burgundy placeholder:text-text-secondary/80 transition-colors hover:border-brand-burgundy/25 focus-visible:border-brand-gold/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-gold/15 disabled:cursor-not-allowed disabled:opacity-50 lg:h-10";
const TEXTAREA =
  "block min-h-16 w-full resize-y rounded-lg border border-brand-burgundy/[0.12] bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-brand-burgundy placeholder:text-text-secondary/80 transition-colors hover:border-brand-burgundy/25 focus-visible:border-brand-gold/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-gold/15";
const FIELD_LABEL = "text-[13.5px] font-semibold text-brand-burgundy";
const FIELD_LABEL_LIGHT = "text-[13px] text-brand-burgundy";
const CHECKBOX = "size-4 shrink-0 cursor-pointer rounded accent-brand-burgundy";
const SMALL_OUTLINE =
  "inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-brand-gold/60 bg-white px-4 text-[12px] font-medium uppercase tracking-[0.14em] text-brand-gold-ink transition-colors hover:bg-brand-gold/[0.08] rtl:text-[13px] rtl:normal-case rtl:tracking-normal";
const SMALL_GHOST =
  "inline-flex min-h-10 items-center rounded-md px-3 text-[13px] text-brand-gold-ink transition-colors hover:bg-brand-gold/[0.08]";
const ACTION =
  "inline-flex h-11 items-center justify-center rounded-md px-6 text-[12px] font-semibold uppercase tracking-[0.16em] transition-colors disabled:cursor-wait disabled:opacity-60 lg:h-10 rtl:text-[13.5px] rtl:normal-case rtl:tracking-normal";

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
  const t = useTranslations("AdminProductForm");
  const locale = useLocale();
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
  // `salePrice` stays the persisted field; the discount % is only derived from it for editing and
  // the sale price shown below is calculated from it (shared with the /admin/offers drawer).
  const savedOffer =
    initial.salePrice != null ? { regular: initial.price, salePrice: initial.salePrice } : null;
  const [discountInput, setDiscountInput] = useState(initialDiscountInput(savedOffer));
  const [saleStartAt, setSaleStartAt] = useState(toDateTimeLocal(initial.saleStartAt));
  const [saleEndAt, setSaleEndAt] = useState(toDateTimeLocal(initial.saleEndAt));
  const [images, setImages] = useState(initial.images);

  function addOption() {
    setOptions((prev) => [
      ...prev,
      {
        key: nextKey("option"),
        name: { en: "", ar: null },
        values: [{ key: nextKey("value"), label: { en: "", ar: null } }],
      },
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
          ? {
              ...option,
              values: [...option.values, { key: nextKey("value"), label: { en: "", ar: null } }],
            }
          : option,
      ),
    );
  }

  function updateOptionValue(optionIndex: number, valueIndex: number, label: BilingualValue) {
    setOptions((prev) =>
      prev.map((option, i) =>
        i === optionIndex
          ? {
              ...option,
              values: option.values.map((v, vi) => (vi === valueIndex ? { ...v, label } : v)),
            }
          : option,
      ),
    );
  }

  function removeOptionValue(optionIndex: number, valueIndex: number) {
    setOptions((prev) =>
      prev.map((option, i) =>
        i === optionIndex
          ? { ...option, values: option.values.filter((_, vi) => vi !== valueIndex) }
          : option,
      ),
    );
  }

  const regularMinorUnits = Math.round(Number.parseFloat(priceInput) * 100);
  const offerResult = resolveOfferSalePrice({
    regular: Number.isFinite(regularMinorUnits) ? regularMinorUnits : null,
    percentInput: discountInput,
    saved: savedOffer,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const priceMinorUnits = Math.round(Number.parseFloat(priceInput) * 100);
    const stock = Number.parseInt(stockInput, 10);
    // A disabled offer may leave the discount empty (the sale price is then cleared); anything typed,
    // and every enabled offer, must be a valid discount.
    let salePriceMinorUnits: number | null = null;
    if (offerResult.ok) {
      salePriceMinorUnits = offerResult.salePrice;
    } else if (isOnSale || discountInput.trim() !== "") {
      setFieldErrors({ salePrice: [t(`offer.errors.${DISCOUNT_ERROR_KEY[offerResult.error]}`)] });
      return;
    }

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
      setImages((prev) => [
        ...prev,
        { ...image, alt: name.en || "Product image", position: prev.length },
      ]);
    }
  }

  async function handleRemoveImage(storagePath: string) {
    if (!initial.productId) return;
    const result = await removeProductImageAction({ productId: initial.productId, storagePath });
    if (result.ok) {
      setImages((prev) =>
        prev
          .filter((img) => img.storagePath !== storagePath)
          .map((img, i) => ({ ...img, position: i })),
      );
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

  // English inputs are pinned LTR and Arabic ones RTL; while a placeholder is
  // showing, it follows the page language so it never reads back-to-front.
  const bilingualAppearance = (
    field: "name" | "description" | "material",
  ): BilingualFieldAppearance => ({
    labelEn: `${t(`fields.${field}`)} — ${t("fields.english")}`,
    labelAr: `${t(`fields.${field}`)} — ${t("fields.arabic")}`,
    placeholderEn: t(`placeholders.${field}En`),
    placeholderAr: t(`placeholders.${field}Ar`),
    legendClassName:
      "mb-1 text-[13.5px] font-semibold text-brand-burgundy [&>span]:text-brand-gold",
    gridClassName: "grid grid-cols-1 gap-x-7 gap-y-3 md:grid-cols-2",
    inputLabelClassName: "text-[13px] text-text-secondary",
    fieldClassName: field === "description" ? TEXTAREA : FIELD,
    fieldClassNameEn: locale === "ar" ? "placeholder-shown:[direction:rtl]" : undefined,
    fieldClassNameAr: locale === "ar" ? undefined : "placeholder-shown:[direction:ltr]",
    textareaRows: 2,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <FormCard icon={FileText} title={t("sections.info")}>
        <div className="flex flex-col gap-3">
          <BilingualField
            label={t("fields.name")}
            value={name}
            onChange={setName}
            errorEn={fieldErrors["name"]?.[0]}
            appearance={bilingualAppearance("name")}
          />
          <BilingualField
            label={t("fields.description")}
            value={description}
            onChange={setDescription}
            multiline
            errorEn={fieldErrors["description"]?.[0]}
            appearance={bilingualAppearance("description")}
          />
          <BilingualField
            label={t("fields.material")}
            value={material}
            onChange={setMaterial}
            errorEn={fieldErrors["material"]?.[0]}
            appearance={bilingualAppearance("material")}
          />
        </div>
      </FormCard>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.43fr_1fr]">
        <FormCard icon={Tag} title={t("sections.pricing")}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>{t("fields.price")}</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                dir="ltr"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                required
                aria-invalid={Boolean(fieldErrors["price"]?.[0]) || undefined}
                className={cn(FIELD, "rtl:text-right")}
              />
              <FormError message={fieldErrors["price"]?.[0]} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>{t("fields.category")}</span>
              <span className="relative block">
                <CategorySelect
                  categories={categories}
                  value={categoryId}
                  onChange={setCategoryId}
                  placeholder={t("fields.selectCategory")}
                  className={cn(FIELD, "cursor-pointer appearance-none pe-10")}
                />
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 stroke-[1.7] text-brand-burgundy"
                />
              </span>
              <FormError message={fieldErrors["categoryId"]?.[0]} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>{t("fields.stock")}</span>
              <input
                type="number"
                min="0"
                step="1"
                dir="ltr"
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value)}
                required
                aria-invalid={Boolean(fieldErrors["stock"]?.[0]) || undefined}
                className={cn(FIELD, "rtl:text-right")}
              />
              <FormError message={fieldErrors["stock"]?.[0]} />
            </label>
          </div>
        </FormCard>

        <FormCard icon={Eye} title={t("sections.status")}>
          <div className="flex flex-col gap-3">
            <StatusCheckbox
              id="product-availability"
              checked={availability}
              onChange={setAvailability}
              label={t("status.availability")}
              hint={t("status.availabilityHint")}
            />
            <StatusCheckbox
              id="product-new-arrival"
              checked={isNewArrival}
              onChange={setIsNewArrival}
              label={t("status.newArrival")}
              hint={t("status.newArrivalHint")}
            />
            <StatusCheckbox
              id="product-best-seller"
              checked={isBestSeller}
              onChange={setIsBestSeller}
              label={t("status.bestSeller")}
              hint={t("status.bestSellerHint")}
            />
          </div>
        </FormCard>
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1fr_1.3fr]">
        <FormCard icon={Box} title={t("sections.options")}>
          <div className="flex flex-col gap-3 rounded-lg border border-brand-burgundy/[0.08] bg-brand-ivory/60 p-3">
            {options.map((option, optionIndex) => (
              <div
                key={option.key}
                className="flex flex-col gap-2.5 rounded-lg border border-brand-burgundy/[0.08] bg-white p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={option.name.en}
                    placeholder={t("placeholders.optionNameEn")}
                    dir="ltr"
                    onChange={(e) =>
                      updateOption(optionIndex, { name: { ...option.name, en: e.target.value } })
                    }
                    className={FIELD}
                  />
                  <input
                    value={option.name.ar ?? ""}
                    placeholder={t("placeholders.optionNameAr")}
                    dir="rtl"
                    onChange={(e) =>
                      updateOption(optionIndex, {
                        name: { ...option.name, ar: e.target.value === "" ? null : e.target.value },
                      })
                    }
                    className={FIELD}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(optionIndex)}
                    className={SMALL_OUTLINE}
                  >
                    {t("options.remove")}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {option.values.map((value, valueIndex) => (
                    <div
                      key={value.key}
                      className="flex w-full items-center gap-1.5 rounded-lg bg-brand-cream/70 p-1.5 sm:w-auto"
                    >
                      <input
                        value={value.label.en}
                        placeholder={t("placeholders.valueEn")}
                        dir="ltr"
                        onChange={(e) =>
                          updateOptionValue(optionIndex, valueIndex, {
                            ...value.label,
                            en: e.target.value,
                          })
                        }
                        className={cn(FIELD, "min-w-0 sm:w-36")}
                      />
                      <input
                        value={value.label.ar ?? ""}
                        placeholder={t("placeholders.valueAr")}
                        dir="rtl"
                        onChange={(e) =>
                          updateOptionValue(optionIndex, valueIndex, {
                            ...value.label,
                            ar: e.target.value === "" ? null : e.target.value,
                          })
                        }
                        className={cn(FIELD, "min-w-0 sm:w-36")}
                      />
                      <button
                        type="button"
                        onClick={() => removeOptionValue(optionIndex, valueIndex)}
                        aria-label={t("options.removeValue")}
                        className="grid size-9 shrink-0 place-items-center rounded-md text-text-secondary transition-colors hover:bg-white hover:text-brand-burgundy"
                      >
                        <X aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOptionValue(optionIndex)}
                    className={SMALL_GHOST}
                  >
                    {t("options.addValue")}
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addOption} className={cn(SMALL_OUTLINE, "self-start")}>
              {t("options.add")}
            </button>
          </div>
        </FormCard>

        <FormCard icon={Gift} title={t("sections.offer")}>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2.5 text-[13.5px] text-brand-burgundy">
              <input
                type="checkbox"
                className={CHECKBOX}
                checked={isOnSale}
                onChange={(e) => setIsOnSale(e.target.checked)}
              />
              {t("offer.enable")}
            </label>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_LIGHT}>{t("fields.discountPercent")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="99.99"
                  step="0.01"
                  dir="ltr"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  aria-describedby="discount-help"
                  aria-invalid={Boolean(fieldErrors["salePrice"]?.[0]) || undefined}
                  className={cn(FIELD, "lining-nums rtl:text-right")}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span id="sale-price-label" className={FIELD_LABEL_LIGHT}>
                  {t("fields.salePrice")}{" "}
                  <span className="font-normal text-text-secondary">
                    ({t("offer.salePriceCalculated")})
                  </span>
                </span>
                <output
                  aria-labelledby="sale-price-label"
                  data-testid="product-sale-price"
                  dir="ltr"
                  className="flex h-11 items-center rounded-lg border border-brand-burgundy/[0.08] bg-brand-cream px-3.5 text-[14px] lining-nums text-brand-burgundy rtl:justify-end lg:h-10"
                >
                  {offerResult.ok
                    ? formatCurrency(offerResult.salePrice, locale === "ar" ? "ar" : "en-US")
                    : "—"}
                </output>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_LIGHT}>{t("fields.startDate")}</span>
                <input
                  type="datetime-local"
                  dir="ltr"
                  value={saleStartAt}
                  onChange={(e) => setSaleStartAt(e.target.value)}
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_LIGHT}>{t("fields.endDate")}</span>
                <input
                  type="datetime-local"
                  dir="ltr"
                  value={saleEndAt}
                  onChange={(e) => setSaleEndAt(e.target.value)}
                  className={FIELD}
                />
              </label>
            </div>
            <p id="discount-help" className="text-[12.5px] leading-snug text-text-secondary">
              {t("offer.discountHelp")}
            </p>
            <FormError message={fieldErrors["salePrice"]?.[0]} />
          </div>
        </FormCard>
      </div>

      {mode === "edit" && initial.productId ? (
        <FormCard icon={ImageIcon} title={t("sections.images")}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              {images.map((image, index) => (
                <div key={image.storagePath} className="flex flex-col items-center gap-1.5">
                  <div className="relative size-24 overflow-hidden rounded-lg border border-brand-burgundy/[0.08] bg-brand-cream">
                    <Image
                      src={image.url}
                      alt={image.alt}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveImage(index, -1)}
                      aria-label={t("images.moveEarlier")}
                      className="grid size-8 place-items-center rounded-md text-brand-burgundy hover:bg-brand-cream"
                    >
                      <DirectionalIcon icon={ArrowLeft} aria-hidden="true" className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(image.storagePath)}
                      className="rounded-md px-2 py-1 text-[12px] text-[#963a33] hover:bg-[#f7e8e6]"
                    >
                      {t("images.remove")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveImage(index, 1)}
                      aria-label={t("images.moveLater")}
                      className="grid size-8 place-items-center rounded-md text-brand-burgundy hover:bg-brand-cream"
                    >
                      <DirectionalIcon icon={ArrowRight} aria-hidden="true" className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <ImageUploader
              folder={`products/${initial.productId}`}
              onUploaded={handleImageUploaded}
            />
          </div>
        </FormCard>
      ) : null}

      <FormError message={error} />

      <div className="flex flex-wrap items-center justify-end gap-3 pt-0.5">
        <button
          type="button"
          onClick={() => router.push("/admin/products")}
          disabled={isPending}
          className={cn(
            ACTION,
            "min-w-[120px] border border-brand-burgundy/20 bg-white text-brand-burgundy hover:bg-brand-ivory",
          )}
        >
          {t("actions.cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            ACTION,
            "min-w-[180px] bg-brand-burgundy text-text-on-dark shadow-[0_8px_20px_-12px_rgba(16,28,54,0.6)] hover:bg-brand-burgundy-light",
          )}
        >
          {isPending
            ? t("actions.saving")
            : mode === "create"
              ? t("actions.create")
              : t("actions.save")}
        </button>
      </div>
    </form>
  );
}

function FormCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-brand-gold/[0.16] bg-white px-4 pb-4 pt-3.5 shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)] sm:px-5 sm:pb-5">
      <h2 className="mb-2.5 flex items-center gap-3 font-display text-[19px] leading-tight text-brand-burgundy">
        <span
          aria-hidden="true"
          className="grid size-[34px] shrink-0 place-items-center rounded-full bg-brand-gold/[0.12]"
        >
          <Icon className="size-[17px] stroke-[1.7] text-brand-gold" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusCheckbox({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className={cn(CHECKBOX, "mt-0.5")}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-hint`}
      />
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="block cursor-pointer text-[14px] leading-tight text-brand-burgundy"
        >
          {label}
        </label>
        <p id={`${id}-hint`} className="mt-1 text-[12.5px] leading-snug text-text-secondary">
          {hint}
        </p>
      </div>
    </div>
  );
}
