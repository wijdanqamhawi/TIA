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

function RegionDialog({ region, open, onClose }: { region: DeliveryRegionRow; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<BilingualValue>(region.name);
  const [displayOrder, setDisplayOrder] = useState(String(region.displayOrder));
  const [isActive, setIsActive] = useState(region.isActive);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateDeliveryRegionAction({
        regionId: region.regionId,
        name,
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
    <Dialog open={open} onClose={onClose} title={`Edit region — ${region.name.en}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <BilingualField label="Name" value={name} onChange={setName} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Display order
          <Input type="number" min="0" step="1" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
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

function LocationDialog({
  regionId,
  location,
  open,
  onClose,
}: {
  regionId: DeliveryRegionId;
  location: DeliveryLocationRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<BilingualValue>(location?.name ?? { en: "", ar: null });
  const [displayOrder, setDisplayOrder] = useState(String(location?.displayOrder ?? 0));
  const [isActive, setIsActive] = useState(location?.isActive ?? true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = location
        ? await updateDeliveryLocationAction({
            locationId: location.id,
            name,
            displayOrder: Number.parseInt(displayOrder, 10) || 0,
            isActive,
          })
        : await createDeliveryLocationAction({
            regionId,
            name,
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
    <Dialog open={open} onClose={onClose} title={location ? `Edit — ${location.name.en}` : "Add a city / area"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <BilingualField label="Name" value={name} onChange={setName} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Display order
          <Input type="number" min="0" step="1" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
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

function RegionSection({ region, locations }: { region: DeliveryRegionRow; locations: DeliveryLocationRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingRegion, setEditingRegion] = useState(false);
  const [editingLocation, setEditingLocation] = useState<DeliveryLocationRow | null>(null);
  const [addingLocation, setAddingLocation] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleDelete(locationId: string) {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteDeliveryLocationAction({ locationId });
      if (!result.ok) {
        setDeleteError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border-luxury p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <button
            type="button"
            onClick={() => setEditingRegion(true)}
            className="font-display text-lg text-brand-burgundy hover:underline"
          >
            {region.name.en}
          </button>
          <Badge variant={region.isActive ? "burgundy" : "neutral"} className="ms-2">
            {region.isActive ? "Active" : "Hidden"}
          </Badge>
        </div>
        <Button type="button" size="sm" onClick={() => setAddingLocation(true)}>
          + Add City / Area
        </Button>
      </div>

      <FormError message={deleteError} />

      <DataTable
        rows={locations}
        rowKey={(row) => row.id}
        emptyMessage="No cities/areas in this region yet."
        columns={[
          {
            header: "Name",
            render: (row) => (
              <button
                type="button"
                onClick={() => setEditingLocation(row)}
                className="font-medium text-brand-burgundy hover:underline"
              >
                {row.name.en}
              </button>
            ),
          },
          { header: "Order", render: (row) => row.displayOrder },
          {
            header: "Status",
            render: (row) => <Badge variant={row.isActive ? "burgundy" : "neutral"}>{row.isActive ? "Active" : "Hidden"}</Badge>,
          },
          {
            header: "",
            render: (row) => (
              <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => handleDelete(row.id)}>
                Delete
              </Button>
            ),
          },
        ]}
      />

      {editingRegion ? <RegionDialog region={region} open={editingRegion} onClose={() => setEditingRegion(false)} /> : null}
      {addingLocation ? (
        <LocationDialog regionId={region.regionId} location={null} open={addingLocation} onClose={() => setAddingLocation(false)} />
      ) : null}
      {editingLocation ? (
        <LocationDialog
          regionId={region.regionId}
          location={editingLocation}
          open={Boolean(editingLocation)}
          onClose={() => setEditingLocation(null)}
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
 * future checkout selection.
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
