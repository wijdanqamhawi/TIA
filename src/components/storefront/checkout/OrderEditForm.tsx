"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Building2,
  House,
  Minus,
  MapPin,
  Phone,
  Plus,
  ShoppingBag,
  StickyNote,
} from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { Badge } from "@/components/ui/Badge";
import { FormError } from "@/components/ui/FormError";
import { OfferPrice, Price } from "@/components/ui/Price";
import { cn } from "@/lib/utils/cn";
import { resolveLocalizedString, type LocalizedString } from "@/types/localizedString";
import type { DeliveryRegionId } from "@/types/deliveryRegion";
import { orderEditSchema } from "@/lib/validation/order-edit.schema";
import { updateCustomerOrderAction } from "@/actions/order.actions";
import { CHECKOUT_CARD, CHECKOUT_ICON_DISC } from "./checkoutStyles";
import {
  Field,
  INPUT_CLASS,
  SectionHeading,
  SelectChevron,
  SELECT_CLASS,
  TEXTAREA_CLASS,
} from "./formControls";
import { ProductThumb } from "./ProductThumb";

/** One existing order line, as the form needs it. Prices are the order's STORED prices. */
export type OrderEditLine = {
  productId: string;
  optionKey: string | null;
  valueKey: string | null;
  name: LocalizedString;
  optionLabel: LocalizedString | null;
  thumbnail: string | null;
  unitPrice: number;
  originalPrice: number;
  wasOnSale: boolean;
  quantity: number;
  /** The most this line can be raised to: its current quantity plus what is in stock now (a UX hint — the server decides). */
  maxQuantity: number;
};

export type OrderEditRegion = { id: DeliveryRegionId; name: LocalizedString };
export type OrderEditLocation = { id: string; name: LocalizedString };

const STEP =
  "grid size-8 place-items-center rounded-md border border-hairline-strong bg-white text-text-primary outline-none transition-colors hover:bg-brand-cream focus-visible:ring-2 focus-visible:ring-brand-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white";

const ACTION_CODES: Record<string, string> = {
  NOT_EDITABLE: "notEditable",
  NOT_FOUND: "notFound",
  INSUFFICIENT_STOCK: "insufficientStock",
  NOT_AVAILABLE: "notAvailable",
  INVALID_OPTION: "invalidOption",
  INVALID_LINE: "invalidLine",
  EMPTY_ORDER: "invalidLine",
  RATE_LIMITED: "rateLimited",
  UNAUTHENTICATED: "signIn",
};

const lineId = (line: Pick<OrderEditLine, "productId" | "optionKey" | "valueKey">) =>
  `${line.productId}::${line.optionKey ?? ""}::${line.valueKey ?? ""}`;

/**
 * The customer's Edit Order form: change quantities, remove lines, and update the phone, delivery
 * place, address and notes of their own order. Everything shown is the order's stored data; the
 * totals here are a preview computed from the STORED unit prices — `updateCustomerOrderAction`
 * re-checks the owner, the current status and the stock, and recomputes the total itself.
 * Nothing price-like is ever sent: only which lines remain, their quantities and the delivery fields.
 */
export function OrderEditForm({
  locale,
  orderNumber,
  lines,
  phone: initialPhone,
  regionId: initialRegionId,
  locationId: initialLocationId,
  fullAddress: initialAddress,
  notes: initialNotes,
  regions,
  locationsByRegion,
}: {
  locale: string;
  orderNumber: string;
  lines: OrderEditLine[];
  phone: string;
  regionId: string;
  locationId: string;
  fullAddress: string;
  notes: string;
  regions: OrderEditRegion[];
  locationsByRegion: Record<string, OrderEditLocation[]>;
}) {
  const t = useTranslations("OrderEdit");
  const tCheckout = useTranslations("Checkout");
  const tCommon = useTranslations("Common");
  const tCart = useTranslations("Cart");
  const tConfirmation = useTranslations("OrderConfirmation");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // A synchronous lock: a second click in the same tick must not start a second save.
  const submitting = useRef(false);

  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((line) => [lineId(line), line.quantity])),
  );
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [lastItemNotice, setLastItemNotice] = useState(false);
  const [phone, setPhone] = useState(initialPhone);
  const [regionId, setRegionId] = useState(initialRegionId);
  const [locationId, setLocationId] = useState(initialLocationId);
  const [fullAddress, setFullAddress] = useState(initialAddress);
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState<string | null>(null);

  const remaining = lines.filter((line) => !removed.has(lineId(line)));
  const subtotal = remaining.reduce(
    (sum, line) => sum + line.unitPrice * quantities[lineId(line)],
    0,
  );
  const units = remaining.reduce((sum, line) => sum + quantities[lineId(line)], 0);
  const locations = locationsByRegion[regionId] ?? [];

  function setQuantity(line: OrderEditLine, next: number) {
    const clamped = Math.min(Math.max(next, 1), line.maxQuantity);
    setQuantities((current) => ({ ...current, [lineId(line)]: clamped }));
    setError(null);
  }

  function removeLine(line: OrderEditLine) {
    // Removing the last remaining line would leave an empty order: explain instead of deleting.
    if (remaining.length <= 1) {
      setLastItemNotice(true);
      return;
    }
    setRemoved((current) => new Set(current).add(lineId(line)));
    setLastItemNotice(false);
    setError(null);
  }

  function fieldMessage(field: unknown): string {
    switch (field) {
      case "phone":
        return tCheckout(phone.trim() ? "errors.phoneInvalid" : "errors.phoneRequired");
      case "regionId":
        return tCheckout("errors.regionRequired");
      case "locationId":
        return tCheckout("errors.locationRequired");
      case "fullAddress":
        return tCheckout("errors.addressRequired");
      case "notes":
        return tCheckout("errors.notesTooLong");
      default:
        return t("errors.generic");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);

    const parsed = orderEditSchema.safeParse({
      orderNumber,
      items: remaining.map((line) => ({
        productId: line.productId,
        optionKey: line.optionKey,
        valueKey: line.valueKey,
        quantity: quantities[lineId(line)],
      })),
      phone,
      regionId,
      locationId,
      fullAddress,
      notes: notes || null,
    });
    if (!parsed.success) {
      setError(fieldMessage(parsed.error.issues[0]?.path[0]));
      return;
    }

    submitting.current = true;
    startTransition(async () => {
      try {
        let result;
        try {
          result = await updateCustomerOrderAction(parsed.data);
        } catch {
          setError(t("errors.offline"));
          return;
        }
        if (!result.ok) {
          const code = result.error.code;
          if (code === "LOCATION_NOT_SUPPORTED") setError(tCheckout("errors.locationNotSupported"));
          else if (code === "VALIDATION_ERROR") {
            setError(fieldMessage(Object.keys(result.error.fieldErrors ?? {})[0]));
          } else setError(t(`errors.${ACTION_CODES[code] ?? "generic"}` as "errors.generic"));
          return;
        }
        router.push(`/${locale}/order-confirmation/${result.data.orderNumber}?updated=1`);
        router.refresh();
      } finally {
        submitting.current = false;
      }
    });
  }

  const isBusy = isPending;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      data-testid="order-edit-form"
      className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-5 pb-14"
    >
      <section aria-labelledby="edit-items-title" className={CHECKOUT_CARD}>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className={CHECKOUT_ICON_DISC}>
            <ShoppingBag className="size-[17px] stroke-[1.6]" />
          </span>
          <div className="min-w-0">
            <h2
              id="edit-items-title"
              className="font-display text-[1.25rem] leading-tight text-text-primary"
            >
              {t("itemsTitle")}
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-text-secondary">{t("itemsHint")}</p>
          </div>
        </div>

        <ul className="mt-4 flex flex-col divide-y divide-hairline border-y border-hairline">
          {remaining.map((line) => {
            const id = lineId(line);
            const quantity = quantities[id];
            const boughtOnSale = line.wasOnSale && line.originalPrice > line.unitPrice;
            const atMax = quantity >= line.maxQuantity;
            return (
              <li key={id} data-testid="edit-line" className="flex items-start gap-3.5 py-3.5">
                <ProductThumb src={line.thumbnail} />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] leading-snug text-text-primary">
                    {resolveLocalizedString(line.name, locale)}
                  </p>
                  {line.optionLabel ? (
                    <p className="mt-0.5 text-[0.75rem] text-text-secondary">
                      {tCart("option")}: {resolveLocalizedString(line.optionLabel, locale)}
                    </p>
                  ) : null}
                  {/* The price this line was bought at — stored, never today's price. */}
                  <p
                    className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"
                    data-testid="edit-unit-price"
                  >
                    {boughtOnSale ? (
                      <>
                        <OfferPrice
                          price={line.originalPrice}
                          effectivePrice={line.unitPrice}
                          offerStatus="ACTIVE"
                          locale={locale}
                          className="text-[0.8125rem]"
                          originalPriceLabel={tCommon("originalPrice")}
                          salePriceLabel={tCommon("salePrice")}
                        />
                        <Badge variant="gold">{tCommon("onSale")}</Badge>
                      </>
                    ) : (
                      <Price
                        minorUnits={line.unitPrice}
                        locale={locale}
                        className="text-[0.8125rem] font-normal"
                      />
                    )}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div
                      role="group"
                      aria-label={`${tCommon("quantity")}: ${resolveLocalizedString(line.name, locale)}`}
                      className="inline-flex items-center gap-2"
                    >
                      <button
                        type="button"
                        className={STEP}
                        aria-label={t("decrease")}
                        disabled={isBusy || quantity <= 1}
                        onClick={() => setQuantity(line, quantity - 1)}
                      >
                        <Minus aria-hidden="true" className="size-3.5 stroke-[1.8]" />
                      </button>
                      <output
                        data-testid="edit-quantity"
                        aria-live="polite"
                        className="min-w-6 text-center text-[0.9375rem] tabular-nums text-text-primary"
                      >
                        {quantity}
                      </output>
                      <button
                        type="button"
                        className={STEP}
                        aria-label={t("increase")}
                        disabled={isBusy || atMax}
                        onClick={() => setQuantity(line, quantity + 1)}
                      >
                        <Plus aria-hidden="true" className="size-3.5 stroke-[1.8]" />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => removeLine(line)}
                      className="text-[0.75rem] text-text-secondary underline-offset-2 outline-none hover:text-[#b0493f] hover:underline focus-visible:ring-2 focus-visible:ring-brand-gold"
                    >
                      {t("remove")}
                    </button>
                  </div>
                  {atMax ? (
                    <p className="mt-1.5 text-[0.75rem] text-text-secondary lining-nums">
                      {t("onlyAvailable", { count: line.maxQuantity })}
                    </p>
                  ) : null}
                </div>
                <Price
                  minorUnits={line.unitPrice * quantity}
                  locale={locale}
                  className="shrink-0 text-[0.9375rem]"
                />
              </li>
            );
          })}
        </ul>

        {lastItemNotice ? (
          <p
            role="alert"
            data-testid="last-item-notice"
            className="mt-3 rounded-lg border border-brand-gold/40 bg-brand-cream/60 px-3.5 py-2.5 text-[0.8125rem] leading-snug text-text-primary"
          >
            {t("lastItem")}{" "}
            <Link
              href="/contact"
              className="font-medium text-brand-burgundy underline underline-offset-2"
            >
              {t("contactUs")}
            </Link>
          </p>
        ) : null}

        <dl className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-[0.875rem]">
            <dt className="text-text-secondary">
              {tConfirmation("subtotal")}
              <span className="ms-2 text-[0.75rem] lining-nums">({units})</span>
            </dt>
            <dd>
              <Price
                minorUnits={subtotal}
                locale={locale}
                className="text-[0.875rem] font-normal"
              />
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-hairline pt-3.5">
            <dt className="font-display text-[1.25rem] leading-none text-text-primary">
              {tConfirmation("total")}
            </dt>
            <dd>
              <Price minorUnits={subtotal} locale={locale} className="text-[1.25rem]" />
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="edit-delivery-title"
        className={cn(CHECKOUT_CARD, "flex flex-col gap-3.5")}
      >
        <SectionHeading
          id="edit-delivery-title"
          icon={MapPin}
          title={tCheckout("deliveryInfo")}
          hint={tCheckout("deliveryHint")}
        />

        <Field label={tCheckout("phoneLabel")} icon={Phone} required>
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

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label={tCheckout("regionLabel")} icon={MapPin} required>
            <select
              className={SELECT_CLASS}
              value={regionId}
              onChange={(e) => {
                setRegionId(e.target.value);
                setLocationId("");
              }}
              disabled={isBusy}
              required
            >
              <option value="">{tCheckout("regionPlaceholder")}</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {resolveLocalizedString(region.name, locale)}
                </option>
              ))}
            </select>
            <SelectChevron />
          </Field>

          <Field label={tCheckout("cityLabel")} icon={Building2} required>
            <select
              className={SELECT_CLASS}
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              disabled={isBusy || !regionId}
              required
            >
              <option value="">{tCheckout("cityPlaceholder")}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {resolveLocalizedString(location.name, locale)}
                </option>
              ))}
            </select>
            <SelectChevron />
          </Field>
        </div>

        <Field label={tCheckout("addressLabel")} icon={House} required iconAtTop>
          <textarea
            rows={2}
            className={cn(TEXTAREA_CLASS, "min-h-[4.25rem]")}
            placeholder={tCheckout("addressPlaceholder")}
            value={fullAddress}
            onChange={(e) => setFullAddress(e.target.value)}
            disabled={isBusy}
            required
          />
        </Field>

        <Field label={tCheckout("notesLabel")} icon={StickyNote} iconAtTop>
          <textarea
            rows={2}
            className={cn(TEXTAREA_CLASS, "min-h-[3.75rem]")}
            placeholder={tCheckout("notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isBusy}
          />
        </Field>
      </section>

      <div className="flex flex-col gap-3">
        <FormError message={error} />
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:justify-center">
          {/* Cancel = leave the editor, nothing saved. It is NOT cancelling the order. */}
          <Link
            href={`/order-confirmation/${orderNumber}`}
            data-testid="edit-cancel"
            aria-disabled={isBusy || undefined}
            className="inline-flex h-[46px] items-center justify-center rounded-lg border border-hairline-strong bg-white px-8 text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-text-primary outline-none transition-colors hover:bg-brand-cream focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 rtl:text-[0.875rem] rtl:normal-case rtl:tracking-normal"
          >
            {t("cancel")}
          </Link>
          <button
            type="submit"
            data-testid="edit-save"
            disabled={isBusy}
            className="inline-flex h-[46px] items-center justify-center rounded-lg bg-brand-burgundy px-8 text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-text-on-dark shadow-[0_10px_22px_-14px_rgba(16,28,54,0.75)] outline-none transition-colors hover:bg-brand-burgundy-light focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 rtl:text-[0.875rem] rtl:normal-case rtl:tracking-normal"
          >
            {isBusy ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </form>
  );
}
