import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * The compact form controls shared by the Checkout form and the Edit Order form — one 46px control,
 * a section heading with a cream icon disc, a labelled field with a leading icon — so the two pages
 * can never drift apart.
 */

/** One compact control: 46px tall, 14.5px text, a leading icon (`ps-10`), hairline border, navy focus. */
export const CONTROL =
  "block w-full rounded-lg border border-hairline-strong bg-white text-[0.90625rem] text-text-primary transition-colors " +
  "placeholder:text-text-secondary hover:border-text-primary/40 focus-visible:border-brand-burgundy " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-burgundy/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50";
export const INPUT_CLASS = `${CONTROL} h-[46px] ps-10 pe-3.5`;
export const SELECT_CLASS = `${CONTROL} h-[46px] cursor-pointer appearance-none ps-10 pe-9`;
export const TEXTAREA_CLASS = `${CONTROL} resize-y ps-10 pe-3.5 py-[0.8125rem] leading-snug`;

/** Section heading: a small cream/gold icon disc beside a serif title and a one-line hint. */
export function SectionHeading({
  id,
  icon: Icon,
  title,
  hint,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-cream text-brand-gold-ink"
      >
        <Icon className="size-[17px] stroke-[1.6]" />
      </span>
      <div className="min-w-0">
        <h2 id={id} className="font-display text-[1.25rem] leading-tight text-text-primary">
          {title}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] leading-snug text-text-secondary">{hint}</p>
      </div>
    </div>
  );
}

/** A labelled control with its leading icon; the `*` is decorative (the control itself carries `required`). */
export function Field({
  label,
  icon: Icon,
  required = false,
  iconAtTop = false,
  children,
}: {
  label: string;
  icon: LucideIcon;
  required?: boolean;
  iconAtTop?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[0.8125rem] font-medium text-text-primary">
      <span>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-[#b0493f]">
            {" "}
            *
          </span>
        ) : null}
      </span>
      <span className="relative block">
        <Icon
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute start-3.5 size-4 stroke-[1.6] text-text-secondary",
            iconAtTop ? "top-[0.9375rem]" : "top-1/2 -translate-y-1/2",
          )}
        />
        {children}
      </span>
    </label>
  );
}

export function SelectChevron() {
  return (
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 stroke-[1.6] text-text-primary"
    />
  );
}
