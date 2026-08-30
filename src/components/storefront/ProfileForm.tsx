"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { resolveLocalizedString } from "@/types/localizedString";
import { updateProfileAction } from "@/actions/account.actions";
import { getDeliveryLocationsForRegionAction, type DeliveryLocationOption } from "@/actions/checkout.actions";
import type { CheckoutRegionOption } from "./CheckoutForm";

const selectClassName =
  "block w-full min-h-11 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const textareaClassName =
  "block w-full min-h-24 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary " +
  "placeholder:text-text-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-brand-burgundy disabled:cursor-not-allowed disabled:opacity-50";

export type ProfileFormAddress = {
  regionId: string;
  locationId: string;
  addressLine: string;
  notes: string | null;
};

/**
 * The account profile edit form (T135, spec User Story 2): name, phone,
 * and an optional saved delivery address — the same region/city dropdown
 * pattern as `CheckoutForm`, reusing `getDeliveryLocationsForRegionAction`
 * so there is exactly one region→city cascading implementation in the
 * codebase. `email` is displayed read-only (Firebase-Auth-owned, never
 * editable here).
 */
export function ProfileForm({
  locale,
  email,
  initialName,
  initialPhone,
  initialAddress,
  regions,
  initialLocations,
}: {
  locale: string;
  email: string;
  initialName: string;
  initialPhone: string;
  initialAddress: ProfileFormAddress | null;
  regions: CheckoutRegionOption[];
  initialLocations: DeliveryLocationOption[];
}) {
  const t = useTranslations("Account");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [regionId, setRegionId] = useState(initialAddress?.regionId ?? "");
  const [locationId, setLocationId] = useState(initialAddress?.locationId ?? "");
  const [locations, setLocations] = useState<DeliveryLocationOption[]>(initialLocations);
  const [locationsPending, startLocationsTransition] = useTransition();
  const [addressLine, setAddressLine] = useState(initialAddress?.addressLine ?? "");
  const [notes, setNotes] = useState(initialAddress?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleRegionChange(nextRegionId: string) {
    setRegionId(nextRegionId);
    setLocationId("");
    setLocations([]);
    if (!nextRegionId) return;
    startLocationsTransition(async () => {
      const result = await getDeliveryLocationsForRegionAction(nextRegionId);
      setLocations(result);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const hasAddressFields = regionId || locationId || addressLine;
    if (hasAddressFields && (!regionId || !locationId || !addressLine.trim())) {
      setError(
        !regionId ? t("errors.regionRequired") : !locationId ? t("errors.locationRequired") : t("errors.addressRequired"),
      );
      return;
    }

    startTransition(async () => {
      const result = await updateProfileAction({
        name,
        phone: phone || null,
        address:
          regionId && locationId && addressLine.trim()
            ? { regionId, locationId, addressLine: addressLine.trim(), notes: notes || null }
            : null,
      });

      if (!result.ok) {
        const field = Object.keys(result.error.fieldErrors ?? {})[0];
        const key =
          field === "name"
            ? "nameRequired"
            : field === "phone"
              ? "phoneInvalid"
              : field === "address"
                ? "addressRequired"
                : "generic";
        setError(t(`errors.${key}` as "errors.generic"));
        return;
      }

      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-display text-lg text-text-primary">{t("profileHeading")}</legend>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("nameLabel")}
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} required />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("phoneLabel")}
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isPending} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("emailLabel")}
          <Input type="email" value={email} disabled readOnly />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-display text-lg text-text-primary">{t("addressHeading")}</legend>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("regionLabel")}
          <select
            className={selectClassName}
            value={regionId}
            onChange={(e) => handleRegionChange(e.target.value)}
            disabled={isPending}
          >
            <option value="">{t("regionPlaceholder")}</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {resolveLocalizedString(region.name, locale)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("cityLabel")}
          <select
            className={selectClassName}
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={isPending || !regionId || locationsPending}
          >
            <option value="">{t("cityPlaceholder")}</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {resolveLocalizedString(location.name, locale)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("addressLabel")}
          <textarea
            className={textareaClassName}
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            disabled={isPending}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("notesLabel")}
          <textarea
            className={textareaClassName}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isPending}
          />
        </label>
      </fieldset>

      <FormError message={error} />
      {success && !error ? <p className="text-sm text-green-700">{t("saveSuccess")}</p> : null}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? t("saving") : t("saveButton")}
      </Button>
    </form>
  );
}
