"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Building2, Loader2, Mountain, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FormError } from "@/components/ui/FormError";
import {
  AdminDrawer,
  DRAWER_ACTION as ACTION,
  DRAWER_FIELD as FIELD,
  DRAWER_LABEL as LABEL,
} from "@/components/admin/AdminDrawer";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import type { BilingualValue } from "@/components/admin/BilingualField";
import {
  updateDeliveryRegionAction,
  createDeliveryLocationAction,
  updateDeliveryLocationAction,
  deleteDeliveryLocationAction,
} from "@/actions/admin/delivery-location.actions";
import type { DeliveryRegionId } from "@/types/deliveryRegion";

export type DeliveryRegionRow = {
  regionId: DeliveryRegionId;
  name: BilingualValue;
  displayOrder: number;
  isActive: boolean;
};

export type DeliveryLocationRow = {
  id: string;
  regionId: DeliveryRegionId;
  name: BilingualValue;
  slug: string;
  displayOrder: number;
  isActive: boolean;
};

const localized = (name: BilingualValue, locale: string) =>
  locale === "ar" ? name.ar || name.en : name.en;

/** A region's icon tile and header tint — purely decorative, keyed by the two fixed region ids. */
const REGION_STYLE: Record<
  DeliveryRegionId,
  { icon: typeof Mountain; tile: string; tint: string }
> = {
  "west-bank": { icon: Mountain, tile: "bg-[#f4e3de] text-[#a9604f]", tint: "bg-[#fbf3f0]" },
  "inside-1948": { icon: Building2, tile: "bg-[#e1e6f0] text-[#3c4f7a]", tint: "bg-[#f2f3f5]" },
};

const CARD =
  "rounded-[10px] border border-brand-gold/[0.16] bg-white shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)]";

/**
 * Optimistic ACTIVE ⇄ INACTIVE toggling of a city/area's existing `isActive`
 * field through the existing `updateDeliveryLocationAction` (only `isActive`
 * is sent, exactly as the Edit form's Active checkbox would change it). One
 * save per location at a time; a failed save drops the optimistic value.
 */
function useLocationStatus(locations: DeliveryLocationRow[], errorMessage: string, onSaved: () => void) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());

  // Fresh server rows (after `router.refresh()`) are the source of truth again —
  // except for a location whose save is still in flight.
  const [source, setSource] = useState(locations);
  if (source !== locations) {
    setSource(locations);
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

  async function toggle(row: DeliveryLocationRow) {
    if (inFlight.current.has(row.id)) return;
    inFlight.current.add(row.id);
    const next = !row.isActive;
    setError(null);
    setOverrides((current) => ({ ...current, [row.id]: next }));
    setPending((current) => new Set(current).add(row.id));

    try {
      const result = await updateDeliveryLocationAction({ locationId: row.id, isActive: next });
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
    withStatus: (row: DeliveryLocationRow): DeliveryLocationRow =>
      row.id in overrides ? { ...row, isActive: overrides[row.id]! } : row,
  };
}

type DrawerState =
  | { kind: "region" }
  | { kind: "location"; location: DeliveryLocationRow | null }
  | null;

/**
 * One shared Add / Edit drawer for both a city/area (create + update) and a
 * region (relabel / reorder / activate). A city/area has no order field: a new
 * one is placed last in its region by the server, and editing never sends an
 * order, so it can't move. Only a region (two fixed rows) keeps its order input.
 */
function DeliveryDrawer({
  region,
  state,
  onClose,
}: {
  region: DeliveryRegionRow;
  state: NonNullable<DrawerState>;
  onClose: () => void;
}) {
  const t = useTranslations("AdminDelivery");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const location = state.kind === "location" ? state.location : null;
  const initial = state.kind === "region" ? region : location;
  const [name, setName] = useState<BilingualValue>(initial?.name ?? { en: "", ar: null });
  // Only used for a region; cities/areas are ordered automatically.
  const [displayOrder, setDisplayOrder] = useState(String(region.displayOrder));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result =
        state.kind === "region"
          ? await updateDeliveryRegionAction({
              regionId: region.regionId,
              name,
              displayOrder: Number.parseInt(displayOrder, 10) || 0,
              isActive,
            })
          : location
            ? await updateDeliveryLocationAction({ locationId: location.id, name, isActive })
            : await createDeliveryLocationAction({ regionId: region.regionId, name, isActive });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const title =
    state.kind === "region"
      ? t("drawer.regionTitle", { name: localized(region.name, locale) })
      : location
        ? t("drawer.editTitle", { name: localized(location.name, locale) })
        : t("drawer.addTitle");

  return (
    <AdminDrawer
      titleId="delivery-drawer-title"
      title={title}
      closeLabel={t("drawer.close")}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-2 pt-2">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>{t("drawer.nameEn")}</span>
            <input
              value={name.en}
              onChange={(e) => setName({ ...name, en: e.target.value })}
              placeholder={t("drawer.nameEnPlaceholder")}
              dir="ltr"
              className={cn(FIELD, "rtl:placeholder-shown:[direction:rtl]")}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>{t("drawer.nameAr")}</span>
            <input
              value={name.ar ?? ""}
              onChange={(e) => setName({ ...name, ar: e.target.value === "" ? null : e.target.value })}
              placeholder={t("drawer.nameArPlaceholder")}
              dir="rtl"
              className={cn(FIELD, "ltr:placeholder-shown:[direction:ltr]")}
            />
          </label>
          {state.kind === "region" ? (
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>{t("drawer.displayOrder")}</span>
              <input
                type="number"
                min="0"
                step="1"
                dir="ltr"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                className={cn(FIELD, "rtl:text-right")}
              />
            </label>
          ) : null}
          <div className="flex items-start gap-3 pt-0.5">
            <input
              id="delivery-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              aria-describedby="delivery-active-hint"
              className="mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-brand-burgundy"
            />
            <div>
              <label
                htmlFor="delivery-active"
                className="block cursor-pointer text-[14px] leading-tight text-brand-burgundy"
              >
                {t("drawer.active")}
              </label>
              <p id="delivery-active-hint" className="mt-1 text-[12.5px] text-text-secondary">
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
            className={cn(ACTION, "border border-brand-burgundy/20 bg-white text-brand-burgundy hover:bg-brand-ivory")}
          >
            {t("drawer.cancel")}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={cn(ACTION, "bg-brand-burgundy text-text-on-dark hover:bg-brand-burgundy-light")}
          >
            {isPending ? t("drawer.saving") : t("drawer.save")}
          </button>
        </div>
      </form>
    </AdminDrawer>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 rounded-full px-3 text-[11.5px] font-medium uppercase tracking-[0.08em] rtl:text-[12.5px] rtl:normal-case rtl:tracking-normal",
        active ? "bg-[#e6f0e9] text-[#2f6844]" : "bg-[#f6ecea] text-[#8f4a43]",
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", active ? "bg-[#2f6844]" : "bg-[#8f4a43]")} />
      {label}
    </span>
  );
}

function StatusToggle({
  row,
  pending,
  describedBy,
  onToggle,
}: {
  row: DeliveryLocationRow;
  pending: boolean;
  describedBy: string;
  onToggle: () => void;
}) {
  const t = useTranslations("AdminDelivery");
  const label = t(row.isActive ? "status.active" : "status.inactive");
  const action = t(row.isActive ? "status.deactivate" : "status.activate");
  // `aria-disabled` rather than `disabled` while saving, so keyboard focus stays on the pill.
  return (
    <button
      type="button"
      data-testid="location-status-toggle"
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
      {pending ? (
        <Loader2 aria-hidden="true" className="size-3 animate-spin stroke-[2.2]" />
      ) : (
        <span aria-hidden="true" className={cn("size-1.5 rounded-full", row.isActive ? "bg-[#2f6844]" : "bg-[#8f4a43]")} />
      )}
      {label}
    </button>
  );
}

/** Compact Edit / Delete controls: icon + label from `md`, icon-only (still 40px touch targets) on cards. */
function RowActions({
  describedBy,
  compact,
  disabled,
  onEdit,
  onDelete,
}: {
  describedBy: string;
  compact: boolean;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("AdminDelivery");
  const base =
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold disabled:cursor-wait disabled:opacity-60";
  const size = compact ? "size-10" : "h-9 px-3";
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onEdit}
        aria-label={t("edit")}
        aria-describedby={describedBy}
        className={cn(base, size, "border-brand-burgundy/[0.12] bg-white text-brand-burgundy hover:border-brand-gold/50 hover:bg-brand-ivory")}
      >
        <Pencil aria-hidden="true" className="size-[15px] stroke-[1.7]" />
        {compact ? null : t("edit")}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        aria-label={t("delete")}
        aria-describedby={describedBy}
        className={cn(base, size, "border-[#963a33]/15 bg-[#fbeeec] text-[#963a33] hover:border-[#963a33]/35 hover:bg-[#f7e0dc]")}
      >
        <Trash2 aria-hidden="true" className="size-[15px] stroke-[1.7]" />
        {compact ? null : t("delete")}
      </button>
    </div>
  );
}

function RegionSection({ region, locations }: { region: DeliveryRegionRow; locations: DeliveryLocationRow[] }) {
  const t = useTranslations("AdminDelivery");
  const locale = useLocale();
  const router = useRouter();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<DeliveryLocationRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const status = useLocationStatus(locations, t("status.toggleError"), () => router.refresh());

  // Rows carry the optimistic status, so the table, the cards and the Edit drawer agree while a toggle saves.
  const rows = locations.map((row) => status.withStatus(row));
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? rows.filter((row) => row.name.en.toLowerCase().includes(needle) || (row.name.ar ?? "").toLowerCase().includes(needle))
    : rows;
  // The Order column is the row's position in the region's list (already sorted by the
  // stored order), so gaps left by deleted cities never show.
  const position = new Map(rows.map((row, index) => [row.id, index + 1]));
  const style = REGION_STYLE[region.regionId];
  const Icon = style.icon;
  const regionName = localized(region.name, locale);
  const nameId = (row: DeliveryLocationRow, card: boolean) => `delivery-${card ? "card-" : ""}name-${row.id}`;

  function confirmDelete() {
    if (!toDelete) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteDeliveryLocationAction({ locationId: toDelete.id });
      if (!result.ok) {
        setDeleteError(result.error.message);
        return;
      }
      setToDelete(null);
      router.refresh();
    });
  }

  return (
    <section className={cn(CARD, "overflow-hidden")}>
      <div className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5", style.tint)}>
        <div className="flex min-w-0 items-center gap-3.5">
          <span aria-hidden="true" className={cn("grid size-12 shrink-0 place-items-center rounded-xl", style.tile)}>
            <Icon className="size-[22px] stroke-[1.6]" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 className="font-display text-[22px] leading-tight text-brand-burgundy">
                <button
                  type="button"
                  onClick={() => setDrawer({ kind: "region" })}
                  title={t("region.editRegion")}
                  className="text-start hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                >
                  {regionName}
                </button>
              </h2>
              <StatusPill active={region.isActive} label={t(region.isActive ? "region.active" : "region.inactive")} />
            </div>
            <p className="mt-0.5 text-[13px] text-text-secondary">{t("region.manage", { name: regionName })}</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <label className="relative block sm:w-[250px]">
            <span className="sr-only">{t("search.label", { name: regionName })}</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 stroke-[1.7] text-text-secondary"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              className={cn(FIELD, "ps-10")}
            />
          </label>
          <button
            type="button"
            onClick={() => setDrawer({ kind: "location", location: null })}
            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand-burgundy px-5 text-[14px] font-medium text-text-on-dark transition-colors hover:bg-brand-burgundy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2"
          >
            <Plus aria-hidden="true" className="size-4 stroke-[2]" />
            {t("addCity")}
          </button>
        </div>
      </div>

      {status.error ? (
        <p role="alert" className="mx-4 mt-3 rounded-lg bg-[#fbeeec] px-3.5 py-2.5 text-[13px] text-[#9a3f36] sm:mx-5">
          {status.error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="border-t border-brand-burgundy/[0.06] px-6 py-9 text-center text-[14px] text-text-secondary">
          {rows.length === 0 ? t("empty") : t("noMatch")}
        </p>
      ) : (
        <>
          {/* Desktop table (md+) */}
          <div className="hidden px-4 pb-4 pt-3 sm:px-5 md:block">
            <table className="w-full table-fixed border-collapse overflow-hidden rounded-lg text-start">
              <colgroup>
                <col className="w-[10%]" />
                <col />
                <col className="w-[20%]" />
                <col className="w-[27%]" />
              </colgroup>
              <thead>
                <tr className="h-[42px] bg-[#f2f3f5] text-[13px] text-brand-burgundy">
                  {(["order", "name", "status"] as const).map((key) => (
                    <th key={key} scope="col" className="whitespace-nowrap px-4 text-start font-medium first:ps-5">
                      {t(`columns.${key}`)}
                    </th>
                  ))}
                  <th scope="col" className="whitespace-nowrap px-4 pe-5 text-end font-medium">
                    {t("columns.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="h-[54px] border-b border-brand-burgundy/[0.06] last:border-b-0">
                    <td className="px-4 ps-5 text-[13.5px] lining-nums tabular-nums text-text-secondary">
                      {position.get(row.id)}
                    </td>
                    <td className="px-4">
                      <button
                        type="button"
                        id={nameId(row, false)}
                        onClick={() => setDrawer({ kind: "location", location: row })}
                        className="max-w-full truncate text-start text-[14px] font-medium text-brand-burgundy hover:underline"
                      >
                        {localized(row.name, locale)}
                      </button>
                    </td>
                    <td className="px-4">
                      <StatusToggle
                        row={row}
                        pending={status.isPending(row.id)}
                        describedBy={nameId(row, false)}
                        onToggle={() => status.toggle(row)}
                      />
                    </td>
                    <td className="px-4 pe-5">
                      <RowActions
                        describedBy={nameId(row, false)}
                        compact={false}
                        disabled={isDeleting}
                        onEdit={() => setDrawer({ kind: "location", location: row })}
                        onDelete={() => {
                          setDeleteError(null);
                          setToDelete(row);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card list (below md) */}
          <ul className="flex flex-col gap-2.5 px-4 pb-4 pt-3 md:hidden">
            {visible.map((row) => (
              <li
                key={row.id}
                data-testid="admin-row"
                className="flex items-center gap-3 rounded-lg border border-brand-burgundy/[0.08] p-3"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f2f3f5] text-[13px] lining-nums tabular-nums text-text-secondary">
                  {position.get(row.id)}
                </span>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    id={nameId(row, true)}
                    onClick={() => setDrawer({ kind: "location", location: row })}
                    className="max-w-full truncate text-start text-[15px] font-medium text-brand-burgundy"
                  >
                    {localized(row.name, locale)}
                  </button>
                  <div className="mt-1.5">
                    <StatusToggle
                      row={row}
                      pending={status.isPending(row.id)}
                      describedBy={nameId(row, true)}
                      onToggle={() => status.toggle(row)}
                    />
                  </div>
                </div>
                <RowActions
                  describedBy={nameId(row, true)}
                  compact
                  disabled={isDeleting}
                  onEdit={() => setDrawer({ kind: "location", location: row })}
                  onDelete={() => {
                    setDeleteError(null);
                    setToDelete(row);
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {drawer ? (
        <DeliveryDrawer
          key={drawer.kind === "location" ? (drawer.location?.id ?? "create") : "region"}
          region={region}
          state={drawer}
          onClose={() => setDrawer(null)}
        />
      ) : null}

      {toDelete ? (
        <ConfirmDialog
          titleId="delivery-delete-title"
          title={t("confirmDelete.title", { name: localized(toDelete.name, locale) })}
          description={t("confirmDelete.description")}
          cancelLabel={t("confirmDelete.cancel")}
          confirmLabel={t("confirmDelete.confirm")}
          pending={isDeleting}
          error={deleteError}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  );
}

/**
 * Admin — Delivery Locations (T284, spec FR-094): the two fixed regions
 * (relabel/reorder/activate only — never created or deleted, T282) each
 * with their own city/area list (add/edit/activate-deactivate/delete,
 * T283). Deleting a city never touches a historical order's already-
 * captured bilingual delivery snapshot (T280) — it only removes it from
 * future checkout selection. Deleting asks for confirmation first.
 */
export function DeliveryLocationManager({
  regions,
  locationsByRegion,
}: {
  regions: DeliveryRegionRow[];
  locationsByRegion: Record<string, DeliveryLocationRow[]>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {regions.map((region) => (
        <RegionSection key={region.regionId} region={region} locations={locationsByRegion[region.regionId] ?? []} />
      ))}
    </div>
  );
}
