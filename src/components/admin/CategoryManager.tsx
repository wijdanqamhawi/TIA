"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ListChecks, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FormError } from "@/components/ui/FormError";
import {
  AdminDrawer,
  DRAWER_ACTION as ACTION,
  DRAWER_FIELD as FIELD,
  DRAWER_LABEL as LABEL,
  DRAWER_TEXTAREA as TEXTAREA,
} from "@/components/admin/AdminDrawer";
import type { BilingualValue } from "@/components/admin/BilingualField";
import { createCategoryAction, updateCategoryAction } from "@/actions/admin/category.actions";

export type CategoryRow = {
  id: string;
  name: BilingualValue;
  description: BilingualValue | null;
  displayOrder: number;
  isActive: boolean;
  /** How many products are assigned to this category. */
  productCount: number;
};

export type DrawerState = { mode: "create" } | { mode: "edit"; category: CategoryRow } | null;

/**
 * Admin — Categories (T156): the category list with real product counts,
 * plus an Add / Edit drawer. Creating goes through `createCategoryAction`;
 * editing keeps using `updateCategoryAction` exactly as before. Categories
 * are never deleted here — an unwanted category is deactivated instead
 * (data-model.md: categories are never cascade-deleted).
 */
export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const t = useTranslations("AdminCategories");
  const locale = useLocale();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const nameOf = (row: CategoryRow) => (locale === "ar" ? row.name.ar || row.name.en : row.name.en);
  const nextOrder = categories.reduce((max, row) => Math.max(max, row.displayOrder), 0) + 1;

  return (
    <section className="rounded-[10px] border border-brand-gold/[0.16] bg-white shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-gold/[0.12]"
          >
            <ListChecks className="size-5 stroke-[1.7] text-brand-gold" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[20px] leading-tight text-brand-burgundy">
              {t("list.title")}
            </h2>
            <p className="mt-0.5 text-[13px] text-text-secondary">{t("list.subtitle")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDrawer({ mode: "create" })}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-gold px-5 text-[14px] font-medium text-brand-burgundy shadow-[0_8px_18px_-12px_rgba(127,100,44,0.7)] transition-colors hover:bg-brand-gold-muted lg:h-10"
        >
          <Plus aria-hidden="true" className="size-4 stroke-[2]" />
          {t("newCategory")}
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="border-t border-brand-burgundy/[0.06] px-6 py-10 text-center text-[14px] text-text-secondary">
          {t("list.empty")}
        </p>
      ) : (
        <>
          {/* Desktop table (md+) */}
          <div className="hidden px-4 pb-4 sm:px-5 md:block">
            <table className="w-full table-fixed border-collapse overflow-hidden rounded-lg text-start">
              <colgroup>
                <col className="w-[8%]" />
                <col />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="h-[45px] bg-brand-cream/70 text-[13px] text-brand-burgundy">
                  {(["number", "name", "products", "order", "status"] as const).map((key) => (
                    <th
                      key={key}
                      scope="col"
                      className="whitespace-nowrap px-4 text-start font-medium first:ps-5"
                    >
                      {t(`columns.${key}`)}
                    </th>
                  ))}
                  <th scope="col" className="whitespace-nowrap px-4 pe-5 text-end font-medium">
                    {t("columns.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((row, index) => (
                  <tr
                    key={row.id}
                    className="h-[58px] border-b border-brand-burgundy/[0.06] last:border-b-0"
                  >
                    <td className="px-4 ps-5 text-[13.5px] lining-nums text-text-secondary">
                      {index + 1}
                    </td>
                    <td className="px-4">
                      <button
                        type="button"
                        id={`category-name-${row.id}`}
                        onClick={() => setDrawer({ mode: "edit", category: row })}
                        className="max-w-full truncate text-start text-[14px] font-medium text-brand-burgundy hover:underline"
                      >
                        {nameOf(row)}
                      </button>
                    </td>
                    <td className="px-4 text-[14px] lining-nums tabular-nums text-brand-burgundy">
                      {row.productCount}
                    </td>
                    <td className="px-4 text-[14px] lining-nums tabular-nums text-brand-burgundy">
                      {row.displayOrder}
                    </td>
                    <td className="px-4">
                      <StatusPill
                        active={row.isActive}
                        label={t(row.isActive ? "status.active" : "status.inactive")}
                      />
                    </td>
                    <td className="px-4 pe-5">
                      <div className="flex justify-end">
                        <EditButton
                          label={t("edit")}
                          describedBy={`category-name-${row.id}`}
                          onClick={() => setDrawer({ mode: "edit", category: row })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card list (below md) */}
          <ul className="flex flex-col gap-2.5 px-4 pb-4 md:hidden">
            {categories.map((row, index) => (
              <li
                key={row.id}
                data-testid="admin-row"
                className="flex items-center gap-3 rounded-lg border border-brand-burgundy/[0.08] p-3"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-cream text-[13px] lining-nums text-text-secondary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    id={`category-card-name-${row.id}`}
                    onClick={() => setDrawer({ mode: "edit", category: row })}
                    className="max-w-full truncate text-start text-[15px] font-medium text-brand-burgundy"
                  >
                    {nameOf(row)}
                  </button>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-secondary">
                    <span>
                      {t("columns.products")}:{" "}
                      <span className="lining-nums text-brand-burgundy">{row.productCount}</span>
                    </span>
                    <span>
                      {t("columns.order")}:{" "}
                      <span className="lining-nums text-brand-burgundy">{row.displayOrder}</span>
                    </span>
                    <StatusPill
                      active={row.isActive}
                      label={t(row.isActive ? "status.active" : "status.inactive")}
                    />
                  </p>
                </div>
                <EditButton
                  label={t("edit")}
                  describedBy={`category-card-name-${row.id}`}
                  onClick={() => setDrawer({ mode: "edit", category: row })}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {drawer ? (
        <CategoryDrawer
          key={drawer.mode === "edit" ? drawer.category.id : "create"}
          state={drawer}
          defaultOrder={nextOrder}
          onClose={() => setDrawer(null)}
        />
      ) : null}
    </section>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center rounded-full px-3 text-[11.5px] font-medium uppercase tracking-[0.08em] rtl:text-[12.5px] rtl:normal-case rtl:tracking-normal",
        active ? "bg-[#e6f0e9] text-[#2f6844]" : "bg-brand-cream text-text-secondary",
      )}
    >
      {label}
    </span>
  );
}

function EditButton({
  label,
  describedBy,
  onClick,
}: {
  label: string;
  describedBy: string;
  onClick: () => void;
}) {
  // Named just "Edit" (and described by the row's name) so the category name
  // itself stays the one control that carries the category's name.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-describedby={describedBy}
      className="grid size-10 shrink-0 place-items-center rounded-lg border border-brand-burgundy/[0.12] bg-white text-brand-burgundy transition-colors hover:border-brand-gold/50 hover:bg-brand-ivory md:size-9"
    >
      <Pencil aria-hidden="true" className="size-[15px] stroke-[1.7]" />
    </button>
  );
}

export function CategoryDrawer({
  state,
  defaultOrder,
  onClose,
}: {
  state: NonNullable<DrawerState>;
  defaultOrder: number;
  onClose: () => void;
}) {
  const t = useTranslations("AdminCategories");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const editing = state.mode === "edit" ? state.category : null;
  const [name, setName] = useState<BilingualValue>(editing?.name ?? { en: "", ar: null });
  const [description, setDescription] = useState<BilingualValue>(
    editing?.description ?? { en: "", ar: null },
  );
  const [displayOrder, setDisplayOrder] = useState(String(editing?.displayOrder ?? defaultOrder));
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = editing
        ? await updateCategoryAction({
            categoryId: editing.id,
            name,
            description: description.en.trim() === "" ? null : description,
            displayOrder: Number.parseInt(displayOrder, 10) || 0,
            isActive,
          })
        : await createCategoryAction({
            name: { en: name.en, ar: name.ar ?? "" },
            description: null,
            displayOrder: Number.parseInt(displayOrder, 10),
            isActive,
          });

      if (!result.ok) {
        setError(result.error.message);
        setFieldErrors(result.error.fieldErrors ?? {});
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const title = editing ? t("drawer.editTitle") : t("drawer.addTitle");
  const nameError = fieldErrors["name"]?.[0];
  const orderError = fieldErrors["displayOrder"]?.[0];

  return (
    <AdminDrawer
      titleId="category-drawer-title"
      title={title}
      closeLabel={t("drawer.close")}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-2 pt-2">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>
              {t("drawer.nameEn")}{" "}
              <span aria-hidden="true" className="text-[#b0493f]">
                *
              </span>
            </span>
            <input
              value={name.en}
              onChange={(e) => setName({ ...name, en: e.target.value })}
              placeholder={t("drawer.nameEnPlaceholder")}
              required
              dir="ltr"
              aria-invalid={Boolean(nameError) || undefined}
              className={cn(FIELD, "rtl:placeholder-shown:[direction:rtl]")}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>
              {t("drawer.nameAr")}
              {editing ? null : (
                <>
                  {" "}
                  <span aria-hidden="true" className="text-[#b0493f]">
                    *
                  </span>
                </>
              )}
            </span>
            <input
              value={name.ar ?? ""}
              onChange={(e) =>
                setName({ ...name, ar: e.target.value === "" ? null : e.target.value })
              }
              placeholder={t("drawer.nameArPlaceholder")}
              required={!editing}
              dir="rtl"
              aria-invalid={Boolean(nameError) || undefined}
              className={cn(FIELD, "ltr:placeholder-shown:[direction:ltr]")}
            />
            <FormError message={nameError} className="text-[12.5px]" />
          </label>

          {editing ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>{t("drawer.descriptionEn")}</span>
                <textarea
                  rows={2}
                  dir="ltr"
                  value={description.en}
                  onChange={(e) => setDescription({ ...description, en: e.target.value })}
                  className={TEXTAREA}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>{t("drawer.descriptionAr")}</span>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={description.ar ?? ""}
                  onChange={(e) =>
                    setDescription({
                      ...description,
                      ar: e.target.value === "" ? null : e.target.value,
                    })
                  }
                  className={TEXTAREA}
                />
              </label>
            </>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>
              {t("drawer.displayOrder")}{" "}
              <span aria-hidden="true" className="text-[#b0493f]">
                *
              </span>
            </span>
            <input
              type="number"
              min="0"
              step="1"
              required
              dir="ltr"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              aria-invalid={Boolean(orderError) || undefined}
              className={cn(FIELD, "rtl:text-right")}
            />
            <FormError message={orderError} className="text-[12.5px]" />
          </label>

          <div className="flex items-start gap-3 pt-0.5">
            <input
              id="category-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              aria-describedby="category-active-hint"
              className="mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-brand-burgundy"
            />
            <div>
              <label
                htmlFor="category-active"
                className="block cursor-pointer text-[14px] leading-tight text-brand-burgundy"
              >
                {t("drawer.active")}
              </label>
              <p id="category-active-hint" className="mt-1 text-[12.5px] text-text-secondary">
                {t("drawer.activeHint")}
              </p>
            </div>
          </div>

          <FormError message={error} className="text-[13px]" />
        </div>

        <div className="flex gap-3 px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={cn(
              ACTION,
              "border border-brand-burgundy/20 bg-white text-brand-burgundy hover:bg-brand-ivory",
            )}
          >
            {t("drawer.cancel")}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              ACTION,
              "bg-brand-burgundy text-text-on-dark hover:bg-brand-burgundy-light",
            )}
          >
            {isPending ? t("drawer.saving") : editing ? t("drawer.save") : t("drawer.create")}
          </button>
        </div>
      </form>
    </AdminDrawer>
  );
}
