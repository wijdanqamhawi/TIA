"use client";

import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";

export type BilingualValue = { en: string; ar: string | null };

/**
 * Paired English/Arabic input (T142) — every bilingual admin field (product
 * name/description/material, category name/description, showcase title/
 * subtitle/cta, option/value labels) uses this so the "— English" / "—
 * Arabic" labeling pattern never drifts between forms. English is always
 * required (LocalizedString's fallback language); Arabic is optional and
 * may be entered later without blocking a save (spec FR-074/FR-084).
 */
export function BilingualField({
  label,
  value,
  onChange,
  multiline = false,
  errorEn,
  errorAr,
  required = true,
}: {
  label: string;
  value: BilingualValue;
  onChange: (value: BilingualValue) => void;
  multiline?: boolean;
  errorEn?: string | null;
  errorAr?: string | null;
  required?: boolean;
}) {
  const sharedClass =
    "block w-full min-h-11 rounded-md border bg-brand-ivory px-3 py-2 text-text-primary placeholder:text-text-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy border-border-luxury";

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-text-primary">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-text-primary/70">{label} — English</span>
          {multiline ? (
            <textarea
              className={sharedClass}
              rows={3}
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
              required={required}
            />
          ) : (
            <Input
              value={value.en}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
              required={required}
              invalid={Boolean(errorEn)}
            />
          )}
          <FormError message={errorEn} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm" dir="rtl">
          <span className="text-text-primary/70" dir="ltr">
            {label} — Arabic
          </span>
          {multiline ? (
            <textarea
              className={sharedClass}
              rows={3}
              value={value.ar ?? ""}
              onChange={(e) => onChange({ ...value, ar: e.target.value === "" ? null : e.target.value })}
            />
          ) : (
            <Input
              value={value.ar ?? ""}
              onChange={(e) => onChange({ ...value, ar: e.target.value === "" ? null : e.target.value })}
              invalid={Boolean(errorAr)}
            />
          )}
          <FormError message={errorAr} />
        </label>
      </div>
    </fieldset>
  );
}
