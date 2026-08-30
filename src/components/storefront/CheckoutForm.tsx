"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { resolveLocalizedString, type LocalizedString } from "@/types/localizedString";
import { checkoutSchema } from "@/lib/validation/checkout.schema";
import { submitCheckoutAction, getDeliveryLocationsForRegionAction, type DeliveryLocationOption } from "@/actions/checkout.actions";
import { LocationSelectorDialog, type LocationOption } from "./LocationSelectorDialog";
import type { DeliveryRegionId } from "@/types/deliveryRegion";

export type CheckoutRegionOption = { id: DeliveryRegionId; name: LocalizedString };

const ORDER_LINE_ISSUE_CODES = ["NOT_FOUND", "NOT_AVAILABLE", "SOLD_OUT", "INVALID_OPTION", "INSUFFICIENT_STOCK"] as const;

const selectClassName =
  "block w-full min-h-11 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const textareaClassName =
  "block w-full min-h-24 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary " +
  "placeholder:text-text-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-brand-burgundy disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The checkout form (T125, spec FR-077/FR-091–FR-093): full name, a
 * **required** mobile phone number, region + city/area (sourced live from
 * `deliveryRegions`/`deliveryLocations` — the approved West Bank/Inside-
 * 1948 system only), full address, email, optional notes, and Cash on
 * Delivery (the only payment method for launch). Supports both a guest
 * and a signed-in customer identically — no account is required.
 *
 * Client-side validation here (`checkoutSchema.safeParse`) is a UX
 * convenience only; `submitCheckoutAction` re-validates everything
 * server-side regardless, including a live re-check of the selected
 * delivery location against Firestore inside the order-creation
 * transaction (Constitution Principle 13).
 */
export function CheckoutForm({
  locale,
  regions,
  prefill,
  prefillLocation,
  locationsByRegionForDialog,
}: {
  locale: string;
  regions: CheckoutRegionOption[];
  prefill: { fullName: string; email: string; phone: string };
  /** The customer's persisted selection (T271), if any — prefills region/city on mount. */
  prefillLocation?: { regionId: DeliveryRegionId; locationId: string } | null;
  /** Every region's full active-location list, so reopening the selector (T279) needs no extra fetch. */
  locationsByRegionForDialog: Record<string, LocationOption[]>;
}) {
  const t = useTranslations("Checkout");
  const tLocation = useTranslations("LocationSelector");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(prefill.fullName);
  const [phone, setPhone] = useState(prefill.phone);
  const [email, setEmail] = useState(prefill.email);
  const [regionId, setRegionId] = useState<string>(prefillLocation?.regionId ?? "");
  const [locationId, setLocationId] = useState<string>("");
  const [locations, setLocations] = useState<DeliveryLocationOption[]>([]);
  const [locationsPending, startLocationsTransition] = useTransition();
  const [fullAddress, setFullAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

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

  // Resolve the persisted selection (T271) into real, live options on
  // mount — never trusted blindly: if the location no longer exists or
  // is no longer active among the freshly-fetched options, the fields
  // simply stay unselected so the customer picks again (the order-
  // creation transaction, T277, would reject a stale one regardless).
  useEffect(() => {
    if (!prefillLocation) return;
    startLocationsTransition(async () => {
      const result = await getDeliveryLocationsForRegionAction(prefillLocation.regionId);
      setLocations(result);
      if (result.some((location) => location.id === prefillLocation.locationId)) {
        setLocationId(prefillLocation.locationId);
      }
    });
    // Intentionally only on mount — this is a one-time prefill, not a
    // dependency the effect should re-run for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDialogSelect(nextRegionId: DeliveryRegionId, location: LocationOption) {
    setRegionId(nextRegionId);
    setLocationId(location.id);
    setLocations(
      (locationsByRegionForDialog[nextRegionId] ?? []).map((loc) => ({ id: loc.id, name: loc.name, slug: loc.slug })),
    );
    setLocationDialogOpen(false);
  }

  const selectedLocationLabel = (() => {
    if (!locationId) return null;
    const location = locations.find((loc) => loc.id === locationId);
    return location ? resolveLocalizedString(location.name, locale) : null;
  })();

  function firstErrorKey(field: unknown): string {
    switch (field) {
      case "fullName":
        return "fullNameRequired";
      case "phone":
        return phone.trim() ? "phoneInvalid" : "phoneRequired";
      case "regionId":
        return "regionRequired";
      case "locationId":
        return "locationRequired";
      case "fullAddress":
        return "addressRequired";
      case "email":
        return email.trim() ? "emailInvalid" : "emailRequired";
      case "notes":
        return "notesTooLong";
      case "paymentMethod":
        return "paymentMethodRequired";
      default:
        return "generic";
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const values = {
      fullName,
      phone,
      regionId,
      locationId,
      fullAddress,
      email,
      notes: notes || null,
      paymentMethod: "CASH_ON_DELIVERY" as const,
    };

    const parsed = checkoutSchema.safeParse(values);
    if (!parsed.success) {
      setError(t(`errors.${firstErrorKey(parsed.error.issues[0]?.path[0])}` as "errors.generic"));
      return;
    }

    startTransition(async () => {
      let result;
      try {
        result = await submitCheckoutAction(parsed.data);
      } catch {
        // The Server Action's network round trip itself failed (e.g. the
        // shopper is offline) — never a silent hang or a false success;
        // she must see a clear "reconnect to continue" message, and no
        // order was created since the request never reached the server.
        setError(t("errors.offline"));
        return;
      }

      if (!result.ok) {
        const code = result.error.code;
        if (code === "LOCATION_NOT_SUPPORTED") {
          setError(t("errors.locationNotSupported"));
        } else if (code === "RATE_LIMITED") {
          setError(result.error.message);
        } else if ((ORDER_LINE_ISSUE_CODES as readonly string[]).includes(code)) {
          setError(result.error.message);
        } else if (code === "VALIDATION_ERROR") {
          const field = Object.keys(result.error.fieldErrors ?? {})[0];
          setError(t(`errors.${firstErrorKey(field)}` as "errors.generic"));
        } else {
          setError(t("errors.generic"));
        }
        return;
      }

      router.push(`/${locale}/order-confirmation/${result.data.orderNumber}`);
      router.refresh();
    });
  }

  const isBusy = isPending;

  return (
    <>
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-display text-lg text-text-primary">{t("contactInfo")}</legend>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("fullNameLabel")}
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isBusy} required />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("phoneLabel")}
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isBusy}
            required
            aria-required="true"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("emailLabel")}
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isBusy} required />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-display text-lg text-text-primary">{t("deliveryInfo")}</legend>

        {selectedLocationLabel ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border-luxury bg-brand-beige/50 px-3 py-2 text-sm text-text-primary">
            <span>{tLocation("selected", { location: selectedLocationLabel })}</span>
            <button
              type="button"
              onClick={() => setLocationDialogOpen(true)}
              disabled={isBusy}
              className="font-medium text-brand-burgundy hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-burgundy"
            >
              {tLocation("change")}
            </button>
          </div>
        ) : null}

        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("regionLabel")}
          <select
            className={selectClassName}
            value={regionId}
            onChange={(e) => handleRegionChange(e.target.value)}
            disabled={isBusy}
            required
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
            disabled={isBusy || !regionId || locationsPending}
            required
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
            value={fullAddress}
            onChange={(e) => setFullAddress(e.target.value)}
            disabled={isBusy}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("notesLabel")}
          <textarea
            className={textareaClassName}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isBusy}
          />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-display text-lg text-text-primary">{t("paymentMethodLabel")}</legend>
        <label className="flex items-center gap-2 rounded-md border border-brand-burgundy bg-brand-beige/50 p-3 text-sm font-medium text-text-primary">
          <input type="radio" name="paymentMethod" checked readOnly />
          {t("cashOnDelivery")}
        </label>
      </fieldset>

      <FormError message={error} />

      <Button type="submit" disabled={isBusy} className="w-full">
        {isBusy ? t("placingOrder") : t("placeOrder")}
      </Button>
    </form>

    <LocationSelectorDialog
      open={locationDialogOpen}
      onClose={() => setLocationDialogOpen(false)}
      locale={locale}
      regions={regions.map((region) => ({ regionId: region.id, name: region.name }))}
      locationsByRegion={locationsByRegionForDialog}
      onSelect={handleDialogSelect}
    />
    </>
  );
}
