"use client";

import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { cn } from "@/lib/utils/cn";

export type BilingualValue = { en: string; ar: string | null };

/**
 * Optional presentation for a form that restyles the paired inputs (the
 * admin product form). Every field is optional and, when omitted, the
 * original look and "— English" / "— Arabic" labels are used unchanged.
 */
export type BilingualFieldAppearance = {
  /** Full label text for each input (defaults to "{label} — English" / "{label} — Arabic"). */
  labelEn?: string;
  labelAr?: string;
  placeholderEn?: string;
  placeholderAr?: string;
  legendClassName?: string;
  gridClassName?: string;
  inputLabelClassName?: string;
  /** Replaces the default input/textarea styling; plain elements are rendered so no default sizing leaks in. */
  fieldClassName?: string;
  /** Extra classes for just the English / Arabic element (e.g. placeholder direction on the other language's page). */
  fieldClassNameEn?: string;
  fieldClassNameAr?: string;
  textareaRows?: number;
};

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
  appearance,
}: {
  label: string;
  value: BilingualValue;
  onChange: (value: BilingualValue) => void;
  multiline?: boolean;
  errorEn?: string | null;
  errorAr?: string | null;
  required?: boolean;
  appearance?: BilingualFieldAppearance;
}) {
  const sharedClass =
    "block w-full min-h-11 rounded-md border bg-brand-ivory px-3 py-2 text-text-primary placeholder:text-text-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy border-border-luxury";
  const custom = appearance?.fieldClassName;
  const rows = appearance?.textareaRows ?? 3;

  function field(lang: "en" | "ar") {
    const current = lang === "en" ? value.en : (value.ar ?? "");
    const update = (next: string) =>
      onChange(
        lang === "en" ? { ...value, en: next } : { ...value, ar: next === "" ? null : next },
      );
    const invalid = Boolean(lang === "en" ? errorEn : errorAr);
    const placeholder = lang === "en" ? appearance?.placeholderEn : appearance?.placeholderAr;
    const isRequired = lang === "en" ? required : undefined;
    // With a custom appearance the English input is pinned LTR, so it types naturally on an Arabic page too.
    const dir = appearance ? (lang === "en" ? "ltr" : "rtl") : undefined;
    const extra = lang === "en" ? appearance?.fieldClassNameEn : appearance?.fieldClassNameAr;

    if (multiline) {
      return (
        <textarea
          className={custom ? cn(custom, extra, invalid && "border-red-600") : sharedClass}
          rows={rows}
          dir={dir}
          value={current}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          onChange={(e) => update(e.target.value)}
          required={isRequired}
        />
      );
    }
    if (custom) {
      return (
        <input
          className={cn(custom, extra, invalid && "border-red-600")}
          dir={dir}
          value={current}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          onChange={(e) => update(e.target.value)}
          required={isRequired}
        />
      );
    }
    return (
      <Input
        value={current}
        placeholder={placeholder}
        onChange={(e) => update(e.target.value)}
        required={isRequired}
        invalid={invalid}
      />
    );
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={appearance?.legendClassName ?? "text-sm font-medium text-text-primary"}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </legend>
      <div className={appearance?.gridClassName ?? "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className={appearance?.inputLabelClassName ?? "text-text-primary/70"}>
            {appearance?.labelEn ?? `${label} — English`}
          </span>
          {field("en")}
          <FormError message={errorEn} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm" dir="rtl">
          <span
            className={appearance?.inputLabelClassName ?? "text-text-primary/70"}
            dir={appearance ? "auto" : "ltr"}
          >
            {appearance?.labelAr ?? `${label} — Arabic`}
          </span>
          {field("ar")}
          <FormError message={errorAr} />
        </label>
      </div>
    </fieldset>
  );
}
