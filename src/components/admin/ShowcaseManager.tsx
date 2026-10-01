"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ImageIcon,
  Info,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { isPlaceholderUrl } from "@/lib/config/demoImages";
import { FormError } from "@/components/ui/FormError";
import {
  AdminDrawer,
  DRAWER_ACTION as ACTION,
  DRAWER_FIELD as FIELD,
  DRAWER_LABEL as LABEL,
} from "@/components/admin/AdminDrawer";
import type { BilingualValue } from "@/components/admin/BilingualField";
import { CategorySelect } from "@/components/admin/CategorySelect";
import { ImageUploader } from "@/components/admin/ImageUploader";
import {
  createCategoryShowcaseAction,
  updateCategoryShowcaseAction,
  attachShowcaseImageAction,
} from "@/actions/admin/category-showcase.actions";

type ShowcaseImage = { url: string; storagePath: string };

export type ShowcaseRow = {
  id: string;
  categoryId: string;
  /** The category name in the admin language. */
  categoryName: string;
  title: BilingualValue;
  subtitle: BilingualValue | null;
  cta: BilingualValue;
  desktopImage: ShowcaseImage | null;
  mobileImage: ShowcaseImage | null;
  displayOrder: number;
  isActive: boolean;
};

export type ShowcaseCategoryOption = { id: string; nameEn: string; isActive: boolean };

export type ShowcaseDrawerState =
  { mode: "create" } | { mode: "edit"; showcase: ShowcaseRow } | null;

/**
 * Admin — Homepage Category Showcases (T160): the showcase list plus an
 * Add / Edit drawer exposing every showcase field (category, bilingual
 * title/subtitle/CTA, desktop and mobile images, display order, active).
 * Each category has at most one showcase: the Category picker only offers
 * categories without one, New Showcase is disabled once every active
 * category has one, and the server actions enforce the same rule.
 */
export function ShowcaseManager({
  showcases,
  categories,
}: {
  showcases: ShowcaseRow[];
  categories: ShowcaseCategoryOption[];
}) {
  const t = useTranslations("AdminShowcases");
  const locale = useLocale();
  const router = useRouter();
  const [drawer, setDrawer] = useState<ShowcaseDrawerState>(null);
  const status = useStatusToggle(showcases, t("status.toggleError"), () => router.refresh());
  // Rows carry the optimistic status, so the table, the cards and the Edit drawer's
  // Active checkbox all show the same value while a toggle is saving.
  const rows = showcases.map((row) => status.withStatus(row));
  const titleOf = (row: ShowcaseRow) =>
    locale === "ar" ? row.title.ar || row.title.en : row.title.en;
  const taken = new Set(showcases.map((row) => row.categoryId));
  const freeCategories = categories.filter((c) => c.isActive && !taken.has(c.id));
  const nextOrder = showcases.reduce((max, row) => Math.max(max, row.displayOrder), 0) + 1;

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
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <button
            type="button"
            onClick={() => setDrawer({ mode: "create" })}
            disabled={freeCategories.length === 0}
            aria-describedby={freeCategories.length === 0 ? "showcase-new-unavailable" : undefined}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-gold px-5 text-[14px] font-medium text-brand-burgundy shadow-[0_8px_18px_-12px_rgba(127,100,44,0.7)] transition-colors hover:bg-brand-gold-muted disabled:cursor-not-allowed disabled:bg-brand-cream disabled:text-text-secondary disabled:shadow-none lg:h-10"
          >
            <Plus aria-hidden="true" className="size-4 stroke-[2]" />
            {t("newShowcase")}
          </button>
          {freeCategories.length === 0 ? (
            <p
              id="showcase-new-unavailable"
              className="max-w-[360px] text-[12px] text-text-secondary sm:text-end"
            >
              {t("allCategoriesHaveShowcase")}
            </p>
          ) : null}
        </div>
      </div>

      {status.error ? (
        <p
          role="alert"
          className="mx-4 mb-3 rounded-lg bg-[#fbeeec] px-3.5 py-2.5 text-[13px] text-[#9a3f36] sm:mx-5"
        >
          {status.error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="border-t border-brand-burgundy/[0.06] px-6 py-10 text-center text-[14px] text-text-secondary">
          {t("list.empty")}
        </p>
      ) : (
        <>
          {/* Desktop table (md+) */}
          <div className="hidden px-4 pb-4 sm:px-5 md:block">
            <table className="w-full table-fixed border-collapse overflow-hidden rounded-lg text-start">
              <colgroup>
                <col className="w-[7%]" />
                <col className="w-[27%]" />
                <col />
                <col className="w-[11%]" />
                <col className="w-[15%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead>
                <tr className="h-[45px] bg-brand-cream/70 text-[13px] text-brand-burgundy">
                  {(["number", "category", "title", "order", "status"] as const).map((key) => (
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
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    data-testid="admin-row"
                    className="h-[64px] border-b border-brand-burgundy/[0.06] last:border-b-0"
                  >
                    <td className="px-4 ps-5 text-[13.5px] lining-nums text-text-secondary">
                      {index + 1}
                    </td>
                    <td className="px-4">
                      <div className="flex items-center gap-3">
                        <Thumbnail src={row.desktopImage?.url ?? null} className="h-11 w-14" />
                        <button
                          type="button"
                          id={`showcase-category-${row.id}`}
                          onClick={() => setDrawer({ mode: "edit", showcase: row })}
                          className="min-w-0 truncate text-start text-[14px] font-medium text-brand-burgundy hover:underline"
                        >
                          {row.categoryName}
                        </button>
                      </div>
                    </td>
                    <td className="truncate px-4 text-[14px] text-brand-burgundy">
                      {titleOf(row)}
                    </td>
                    <td className="px-4 text-[14px] lining-nums tabular-nums text-brand-burgundy">
                      {row.displayOrder}
                    </td>
                    <td className="px-4">
                      <StatusToggle
                        row={row}
                        pending={status.isPending(row.id)}
                        describedBy={`showcase-category-${row.id}`}
                        onToggle={() => status.toggle(row)}
                      />
                    </td>
                    <td className="px-4 pe-5">
                      <div className="flex justify-end">
                        <EditButton
                          label={t("edit")}
                          describedBy={`showcase-category-${row.id}`}
                          onClick={() => setDrawer({ mode: "edit", showcase: row })}
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
            {rows.map((row) => (
              <li
                key={row.id}
                data-testid="admin-row"
                className="flex items-center gap-3 rounded-lg border border-brand-burgundy/[0.08] p-3"
              >
                <Thumbnail src={row.desktopImage?.url ?? null} className="h-12 w-16" />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    id={`showcase-card-category-${row.id}`}
                    onClick={() => setDrawer({ mode: "edit", showcase: row })}
                    className="max-w-full truncate text-start text-[15px] font-medium text-brand-burgundy"
                  >
                    {row.categoryName}
                  </button>
                  <p className="truncate text-[13px] text-text-secondary">{titleOf(row)}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-secondary">
                    <span>
                      {t("columns.order")}:{" "}
                      <span className="lining-nums text-brand-burgundy">{row.displayOrder}</span>
                    </span>
                    <StatusToggle
                      row={row}
                      pending={status.isPending(row.id)}
                      describedBy={`showcase-card-category-${row.id}`}
                      onToggle={() => status.toggle(row)}
                    />
                  </p>
                </div>
                <EditButton
                  label={t("edit")}
                  describedBy={`showcase-card-category-${row.id}`}
                  onClick={() => setDrawer({ mode: "edit", showcase: row })}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {drawer ? (
        <ShowcaseDrawer
          key={drawer.mode === "edit" ? drawer.showcase.id : "create"}
          state={drawer}
          categoryOptions={
            drawer.mode === "edit"
              ? categories.filter(
                  (c) => c.id === drawer.showcase.categoryId || (c.isActive && !taken.has(c.id)),
                )
              : freeCategories
          }
          defaultOrder={nextOrder}
          onClose={() => setDrawer(null)}
        />
      ) : null}
    </section>
  );
}

/**
 * The showcase's own Desktop Image. The seeded brand-logo URL is not a real
 * photo, so it (like a missing image) shows the TIA placeholder instead.
 */
function Thumbnail({ src, className }: { src: string | null; className: string }) {
  const real = !isPlaceholderUrl(src);
  return (
    <span
      data-testid="showcase-thumbnail"
      data-placeholder={real ? undefined : ""}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border border-brand-burgundy/[0.08] bg-brand-cream",
        className,
      )}
    >
      {real ? (
        <Image key={src} src={src as string} alt="" fill sizes="64px" className="object-cover" />
      ) : (
        <Image
          src="/brand/logo.svg"
          alt=""
          fill
          sizes="64px"
          className="object-contain p-2 opacity-60"
        />
      )}
    </span>
  );
}

/**
 * Optimistic ACTIVE ⇄ INACTIVE toggling of a showcase's existing `isActive`
 * field through `updateCategoryShowcaseAction`. One save per showcase at a
 * time (a ref guards against a double click landing before re-render); a
 * failed save drops the optimistic value, restoring the previous status.
 */
function useStatusToggle(showcases: ShowcaseRow[], errorMessage: string, onSaved: () => void) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());

  // Fresh server rows (after `router.refresh()`) are the source of truth again —
  // except for a showcase whose save is still in flight.
  const [source, setSource] = useState(showcases);
  if (source !== showcases) {
    setSource(showcases);
    setOverrides((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => pending.has(id))),
    );
  }

  function settle(id: string) {
    inFlight.current.delete(id);
    setPending((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function revert(id: string) {
    setOverrides(({ [id]: _dropped, ...rest }) => rest);
    setError(errorMessage);
  }

  async function toggle(row: ShowcaseRow) {
    if (inFlight.current.has(row.id)) return;
    inFlight.current.add(row.id);
    const next = !row.isActive;
    setError(null);
    setOverrides((current) => ({ ...current, [row.id]: next }));
    setPending((current) => new Set(current).add(row.id));

    try {
      const result = await updateCategoryShowcaseAction({ showcaseId: row.id, isActive: next });
      if (result.ok) onSaved();
      else revert(row.id);
    } catch {
      revert(row.id);
    } finally {
      settle(row.id);
    }
  }

  return {
    error,
    toggle,
    isPending: (id: string) => pending.has(id),
    withStatus: (row: ShowcaseRow): ShowcaseRow =>
      row.id in overrides ? { ...row, isActive: overrides[row.id]! } : row,
  };
}

function StatusToggle({
  row,
  pending,
  describedBy,
  onToggle,
}: {
  row: ShowcaseRow;
  pending: boolean;
  describedBy: string;
  onToggle: () => void;
}) {
  const t = useTranslations("AdminShowcases");
  const label = t(row.isActive ? "status.active" : "status.inactive");
  const action = t(row.isActive ? "status.deactivate" : "status.activate");
  // `aria-disabled` rather than `disabled` while saving, so keyboard focus stays on the pill.
  return (
    <button
      type="button"
      data-testid="showcase-status-toggle"
      onClick={() => {
        if (!pending) onToggle();
      }}
      aria-label={pending ? `${label} — ${t("status.saving")}` : `${label} — ${action}`}
      aria-describedby={describedBy}
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      title={action}
      className={cn(
        "inline-flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full px-3 text-[11.5px] font-medium uppercase tracking-[0.08em] outline-none ring-offset-1 transition-[background-color,box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-brand-gold rtl:text-[12.5px] rtl:normal-case rtl:tracking-normal",
        row.isActive
          ? "bg-[#e6f0e9] text-[#2f6844] hover:bg-[#d6e7db] hover:ring-1 hover:ring-[#2f6844]/25"
          : "bg-[#f6ecea] text-[#8f4a43] hover:bg-[#f0dfdb] hover:ring-1 hover:ring-[#8f4a43]/25",
        pending && "cursor-wait opacity-70",
      )}
    >
      {pending ? <Loader2 aria-hidden="true" className="size-3 animate-spin stroke-[2.2]" /> : null}
      {label}
    </button>
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
  // Named just "Edit" (and described by the row's category) so the category
  // button stays the first — and only — control carrying the row's name.
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

const EMPTY: BilingualValue = { en: "", ar: null };

export function ShowcaseDrawer({
  state,
  categoryOptions,
  defaultOrder,
  onClose,
}: {
  state: NonNullable<ShowcaseDrawerState>;
  categoryOptions: ShowcaseCategoryOption[];
  defaultOrder: number;
  onClose: () => void;
}) {
  const t = useTranslations("AdminShowcases");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const showcase = state.mode === "edit" ? state.showcase : null;
  const [categoryId, setCategoryId] = useState(showcase?.categoryId ?? "");
  const [title, setTitle] = useState<BilingualValue>(showcase?.title ?? EMPTY);
  const [subtitle, setSubtitle] = useState<BilingualValue>(showcase?.subtitle ?? EMPTY);
  const [cta, setCta] = useState<BilingualValue>(showcase?.cta ?? EMPTY);
  const [displayOrder, setDisplayOrder] = useState(String(showcase?.displayOrder ?? defaultOrder));
  const [isActive, setIsActive] = useState(showcase?.isActive ?? true);
  const [desktopImage, setDesktopImage] = useState<ShowcaseImage | null>(
    showcase?.desktopImage ?? null,
  );
  const [mobileImage, setMobileImage] = useState<ShowcaseImage | null>(
    showcase?.mobileImage ?? null,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!desktopImage) {
      setError(t("drawer.desktopImageRequired"));
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
        setFieldErrors(result.error.fieldErrors ?? {});
        return;
      }
      router.refresh();
      onClose();
    });
  }

  // Unchanged behaviour: when editing, an upload is attached to the showcase immediately.
  async function handleUpload(slot: "desktop" | "mobile", image: ShowcaseImage) {
    if (slot === "desktop") setDesktopImage(image);
    else setMobileImage(image);

    if (showcase) {
      await attachShowcaseImageAction({ showcaseId: showcase.id, slot, image });
      router.refresh();
    }
  }

  const required = (
    <span aria-hidden="true" className="text-[#b0493f]">
      {" "}
      *
    </span>
  );
  const folder = `showcases/${showcase?.id ?? "new"}`;
  const uploadIcon = <Upload aria-hidden="true" className="size-4 shrink-0 stroke-[1.8]" />;

  return (
    <AdminDrawer
      titleId="showcase-drawer-title"
      title={showcase ? t("drawer.editTitle") : t("drawer.addTitle")}
      subtitle={showcase ? t("drawer.editSubtitle") : t("drawer.addSubtitle")}
      closeLabel={t("drawer.close")}
      onClose={onClose}
      widthClassName="sm:w-[min(760px,calc(100vw-32px))]"
      titleClassName="text-[26px] sm:text-[30px]"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-3 pt-2">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>
              {t("drawer.category")}
              {required}
            </span>
            <span className="relative block">
              <CategorySelect
                categories={categoryOptions}
                value={categoryId}
                onChange={setCategoryId}
                placeholder={t("drawer.selectCategory")}
                className={cn(FIELD, "cursor-pointer appearance-none pe-10")}
              />
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 stroke-[1.7] text-brand-burgundy"
              />
            </span>
            <FormError message={fieldErrors["categoryId"]?.[0]} className="text-[12.5px]" />
          </label>

          <BilingualInputs
            labelEn={t("drawer.titleEn")}
            labelAr={t("drawer.titleAr")}
            placeholderEn={t("drawer.titleEnPlaceholder")}
            placeholderAr={t("drawer.titleArPlaceholder")}
            value={title}
            onChange={setTitle}
            requiredEn={required}
            error={fieldErrors["title"]?.[0]}
          />
          <BilingualInputs
            labelEn={t("drawer.subtitleEn")}
            labelAr={t("drawer.subtitleAr")}
            placeholderEn={t("drawer.subtitleEnPlaceholder")}
            placeholderAr={t("drawer.subtitleArPlaceholder")}
            value={subtitle}
            onChange={setSubtitle}
          />
          <BilingualInputs
            labelEn={t("drawer.ctaEn")}
            labelAr={t("drawer.ctaAr")}
            placeholderEn={t("drawer.ctaEnPlaceholder")}
            placeholderAr={t("drawer.ctaArPlaceholder")}
            value={cta}
            onChange={setCta}
            requiredEn={required}
            error={fieldErrors["cta"]?.[0]}
          />

          <div className={GRID}>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={LABEL}>
                {t("drawer.displayOrder")}
                {required}
              </span>
              <input
                type="number"
                min="0"
                step="1"
                required
                dir="ltr"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                aria-invalid={Boolean(fieldErrors["displayOrder"]?.[0]) || undefined}
                className={cn(FIELD, "lining-nums rtl:text-right")}
              />
            </label>
            <div className="flex items-start gap-3 sm:pt-[27px]">
              <span className="relative grid size-[22px] shrink-0 place-items-center">
                <input
                  id="showcase-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  aria-describedby="showcase-active-hint"
                  className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[5px] border border-brand-burgundy/30 bg-white transition-colors checked:border-brand-burgundy checked:bg-brand-burgundy hover:border-brand-burgundy/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-gold/40"
                />
                <Check
                  aria-hidden="true"
                  className="pointer-events-none relative size-3.5 stroke-[3] text-white opacity-0 peer-checked:opacity-100"
                />
              </span>
              <div className="min-w-0">
                <label
                  htmlFor="showcase-active"
                  className="block cursor-pointer text-[15px] font-medium leading-[22px] text-brand-burgundy"
                >
                  {t("drawer.active")}
                </label>
                <p
                  id="showcase-active-hint"
                  className="mt-0.5 max-w-[280px] text-[12.5px] leading-snug text-text-secondary"
                >
                  {t("drawer.activeHint")}
                </p>
              </div>
            </div>
          </div>

          <div className={cn(GRID, "gap-y-4")}>
            <ImageSlot
              label={t("drawer.desktopImage")}
              image={desktopImage}
              emptyState="brand"
              emptyLabel={t("drawer.noImage")}
              hint={t("drawer.recommendedSize")}
              size="1920 × 800 px (16:9)"
              required={required}
            >
              <ImageUploader
                folder={folder}
                onUploaded={(img) => handleUpload("desktop", img)}
                label={t("drawer.uploadImage")}
                uploadingLabel={t("drawer.uploading")}
                buttonClassName={UPLOAD}
                icon={uploadIcon}
              />
            </ImageSlot>
            <ImageSlot
              label={t("drawer.mobileImage")}
              image={mobileImage}
              emptyState="empty"
              emptyLabel={t("drawer.noImage")}
              hint={t("drawer.recommendedSize")}
              size="1080 × 1350 px (4:5)"
            >
              <ImageUploader
                folder={folder}
                onUploaded={(img) => handleUpload("mobile", img)}
                label={t("drawer.uploadImage")}
                uploadingLabel={t("drawer.uploading")}
                buttonClassName={UPLOAD}
                icon={uploadIcon}
              />
            </ImageSlot>
          </div>

          <p className="flex items-center gap-2.5 rounded-lg bg-brand-cream px-4 py-3 text-[13px] leading-snug text-brand-burgundy/80">
            <Info
              aria-hidden="true"
              className="size-[18px] shrink-0 stroke-[1.6] text-brand-burgundy"
            />
            {t("drawer.oneShowcaseNote")}
          </p>

          <FormError message={error} className="text-[13px]" />
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-brand-burgundy/[0.06] px-6 pb-5 pt-4 sm:gap-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={cn(
              ACTION,
              "h-12 border border-brand-gold/50 bg-white text-brand-burgundy outline-none hover:border-brand-gold hover:bg-brand-ivory focus-visible:ring-2 focus-visible:ring-brand-gold/50",
            )}
          >
            {t("drawer.cancel")}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              ACTION,
              "group h-12 gap-2.5 bg-brand-burgundy text-text-on-dark shadow-[0_10px_22px_-14px_rgba(16,28,54,0.8)] outline-none ring-offset-2 hover:bg-brand-burgundy-light hover:shadow-[0_0_0_1px_var(--brand-gold),0_10px_22px_-14px_rgba(16,28,54,0.8)] focus-visible:ring-2 focus-visible:ring-brand-gold",
            )}
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin stroke-[2]" />
            ) : null}
            {isPending ? t("drawer.saving") : showcase ? t("drawer.save") : t("drawer.create")}
            {isPending ? null : (
              <ArrowRight
                aria-hidden="true"
                className="size-4 stroke-[1.8] text-brand-gold transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
              />
            )}
          </button>
        </div>
      </form>
    </AdminDrawer>
  );
}

/** Two columns from `sm`, one on phones. */
const GRID = "grid grid-cols-1 gap-x-5 gap-y-3.5 sm:grid-cols-2";

const UPLOAD =
  "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-brand-gold/50 bg-white px-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-burgundy outline-none transition-colors hover:border-brand-gold hover:bg-brand-ivory focus-visible:ring-2 focus-visible:ring-brand-gold/50 disabled:cursor-wait disabled:opacity-60 rtl:text-[13.5px] rtl:normal-case rtl:tracking-normal";

/** An English | Arabic input pair (English required only when `requiredEn` is given). */
function BilingualInputs({
  labelEn,
  labelAr,
  placeholderEn,
  placeholderAr,
  value,
  onChange,
  requiredEn,
  error,
}: {
  labelEn: string;
  labelAr: string;
  placeholderEn?: string;
  placeholderAr?: string;
  value: BilingualValue;
  onChange: (value: BilingualValue) => void;
  requiredEn?: React.ReactNode;
  error?: string;
}) {
  return (
    <div className={GRID}>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className={LABEL}>
          {labelEn}
          {requiredEn}
        </span>
        <input
          value={value.en}
          onChange={(e) => onChange({ ...value, en: e.target.value })}
          placeholder={placeholderEn}
          required={Boolean(requiredEn)}
          dir="ltr"
          aria-invalid={Boolean(error) || undefined}
          className={cn(FIELD, "rtl:placeholder-shown:[direction:rtl]")}
        />
        <FormError message={error} className="text-[12.5px]" />
      </label>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className={LABEL}>{labelAr}</span>
        <input
          value={value.ar ?? ""}
          onChange={(e) =>
            onChange({ ...value, ar: e.target.value === "" ? null : e.target.value })
          }
          placeholder={placeholderAr}
          dir="rtl"
          className={cn(FIELD, "ltr:placeholder-shown:[direction:ltr]")}
        />
      </label>
    </div>
  );
}

/**
 * A labelled image preview with its upload button and a recommended-size
 * hint (informational only — nothing is enforced). A real photo fills the
 * frame; a missing or seeded-logo image shows the TIA placeholder
 * (`emptyState="brand"`), and a missing optional image an empty frame.
 */
function ImageSlot({
  label,
  image,
  emptyState,
  emptyLabel,
  hint,
  size,
  required,
  children,
}: {
  label: string;
  image: ShowcaseImage | null;
  emptyState: "brand" | "empty";
  emptyLabel: string;
  hint: string;
  size: string;
  required?: React.ReactNode;
  children: React.ReactNode;
}) {
  const src = isPlaceholderUrl(image?.url) ? null : (image?.url ?? null);
  const brand = emptyState === "brand" || image !== null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className={LABEL}>
        {label}
        {required}
      </span>
      <div
        data-testid="showcase-image-preview"
        data-placeholder={src ? undefined : ""}
        className="relative h-[168px] w-full overflow-hidden rounded-lg border border-brand-burgundy/[0.08] bg-brand-cream/70 sm:h-[150px] lg:h-[172px]"
      >
        {src ? (
          <Image
            key={src}
            src={src}
            alt=""
            fill
            sizes="(min-width: 640px) 360px, 100vw"
            className="object-cover"
          />
        ) : brand ? (
          <Image
            src="/brand/logo.svg"
            alt=""
            fill
            sizes="200px"
            className="object-contain p-10 opacity-50"
          />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-2 text-[12.5px] text-text-secondary">
            <ImageIcon aria-hidden="true" className="size-6 stroke-[1.4] text-brand-burgundy/35" />
            {emptyLabel}
          </span>
        )}
      </div>
      {children}
      <p className="text-[12px] leading-snug text-text-secondary">
        {hint}{" "}
        <bdi dir="ltr" className="lining-nums">
          {size}
        </bdi>
      </p>
    </div>
  );
}
