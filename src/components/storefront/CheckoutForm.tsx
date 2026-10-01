"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Building2,
  House,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  StickyNote,
  User,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FormError } from "@/components/ui/FormError";
import { resolveLocalizedString, type LocalizedString } from "@/types/localizedString";
import { checkoutSchema } from "@/lib/validation/checkout.schema";
import {
  submitCheckoutAction,
  getDeliveryLocationsForRegionAction,
  type DeliveryLocationOption,
} from "@/actions/checkout.actions";
import { LocationSelectorDialog, type LocationOption } from "./LocationSelectorDialog";
import {
  Field,
  INPUT_CLASS,
  SectionHeading,
  SelectChevron,
  SELECT_CLASS,
  TEXTAREA_CLASS,
} from "./checkout/formControls";
import type { DeliveryRegionId } from "@/types/deliveryRegion";

export type CheckoutRegionOption = { id: DeliveryRegionId; name: LocalizedString };

const ORDER_LINE_ISSUE_CODES = [
  "NOT_FOUND",
  "NOT_AVAILABLE",
  "SOLD_OUT",
  "INVALID_OPTION",
  "INSUFFICIENT_STOCK",
] as const;

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
      (locationsByRegionForDialog[nextRegionId] ?? []).map((loc) => ({
        id: loc.id,
        name: loc.name,
        slug: loc.slug,
      })),
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
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-6 rounded-2xl border border-hairline bg-white p-5 shadow-elev-1 sm:p-7"
      >
        <section aria-labelledby="checkout-contact-title" className="flex flex-col gap-3.5">
          <SectionHeading
            id="checkout-contact-title"
            icon={User}
            title={t("contactInfo")}
            hint={t("contactHint")}
          />

          <Field label={t("fullNameLabel")} icon={User} required>
            <input
              className={INPUT_CLASS}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isBusy}
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label={t("phoneLabel")} icon={Phone} required>
              <input
                type="tel"
                className={INPUT_CLASS}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isBusy}
                required
                aria-required="true"
              />
            </Field>

            <Field label={t("emailLabel")} icon={Mail} required>
              <input
                type="email"
                className={INPUT_CLASS}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isBusy}
                required
              />
            </Field>
          </div>
        </section>

        <div aria-hidden="true" className="h-px bg-hairline" />

        <section aria-labelledby="checkout-delivery-title" className="flex flex-col gap-3.5">
          <SectionHeading
            id="checkout-delivery-title"
            icon={MapPin}
            title={t("deliveryInfo")}
            hint={t("deliveryHint")}
          />

          {selectedLocationLabel ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-brand-cream/60 px-3.5 py-2 text-[0.8125rem] text-text-primary">
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

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label={t("regionLabel")} icon={MapPin} required>
              <select
                className={SELECT_CLASS}
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
              <SelectChevron />
            </Field>

            <Field label={t("cityLabel")} icon={Building2} required>
              <select
                className={SELECT_CLASS}
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
              <SelectChevron />
            </Field>
          </div>

          <Field label={t("addressLabel")} icon={House} required iconAtTop>
            <textarea
              rows={2}
              className={cn(TEXTAREA_CLASS, "min-h-[4.25rem]")}
              placeholder={t("addressPlaceholder")}
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
              disabled={isBusy}
              required
            />
          </Field>

          <Field label={t("notesLabel")} icon={StickyNote} iconAtTop>
            <textarea
              rows={2}
              className={cn(TEXTAREA_CLASS, "min-h-[3.75rem]")}
              placeholder={t("notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isBusy}
            />
          </Field>
        </section>

        <div aria-hidden="true" className="h-px bg-hairline" />

        <section aria-labelledby="checkout-payment-title" className="flex flex-col gap-3.5">
          <SectionHeading
            id="checkout-payment-title"
            icon={Wallet}
            title={t("paymentMethodLabel")}
            hint={t("paymentHint")}
          />
          {/* Cash on Delivery is the only method; it is shown as the selected card. */}
          <label className="flex cursor-default items-center gap-3 rounded-xl border border-brand-burgundy/70 bg-brand-ivory px-4 py-3 ring-1 ring-brand-burgundy/10">
            <input
              type="radio"
              name="paymentMethod"
              checked
              readOnly
              className="size-4 shrink-0 accent-brand-burgundy"
            />
            <Banknote
              aria-hidden="true"
              className="size-[22px] shrink-0 stroke-[1.4] text-brand-gold-ink"
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-[0.875rem] font-medium leading-snug text-text-primary">
                {t("cashOnDelivery")}
              </span>
              <span className="text-[0.75rem] leading-snug text-text-secondary">
                {t("codHint")}
              </span>
            </span>
          </label>
        </section>

        <div className="flex flex-col gap-3">
          <FormError message={error} />

          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex h-[50px] w-full items-center justify-center gap-2.5 rounded-lg bg-brand-burgundy px-6 text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-text-on-dark shadow-[0_10px_22px_-14px_rgba(16,28,54,0.75)] outline-none transition-colors hover:bg-brand-burgundy-light focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 rtl:text-[0.875rem] rtl:normal-case rtl:tracking-normal"
          >
            <Lock aria-hidden="true" className="size-[15px] stroke-[1.8]" />
            {isBusy ? t("placingOrder") : t("placeOrder")}
          </button>

          <p className="flex items-center justify-center gap-1.5 text-center text-[0.75rem] text-text-secondary">
            <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0 stroke-[1.6]" />
            {t("secureNote")}
          </p>
        </div>
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
