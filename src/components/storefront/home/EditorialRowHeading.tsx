import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

/**
 * The reference's row heading, shared by "New Arrivals" and "Shop by
 * Category" so the two rows align exactly:
 *
 *   DISCOVER ——              (champagne eyebrow with a short rule)
 *   New Arrivals ——          View All →
 *
 * The serif title carries a champagne rule running off its end, and the
 * quiet "View All →" is pushed to the far end of the row, baseline-aligned
 * with the title.
 *
 * Presentational only — it renders the copy and link it is given.
 */
export function EditorialRowHeading({
  eyebrow,
  title,
  actionLabel,
  actionHref,
}: {
  eyebrow: string;
  title: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 flex items-center gap-3 font-body text-[0.625rem] font-medium uppercase tracking-[0.22em] text-brand-gold rtl:text-[0.8125rem] rtl:normal-case rtl:tracking-normal">
        {eyebrow}
        <span aria-hidden="true" className="block h-px w-8 bg-brand-gold/60" />
      </p>

      <div className="flex items-center gap-4">
        <h2 className="shrink-0 font-display text-[clamp(1.375rem,2vw,1.8125rem)] font-normal leading-none text-text-primary">
          {title}
        </h2>
        <span aria-hidden="true" className="h-px w-12 shrink-0 bg-brand-gold/60 sm:w-16" />

        <Link
          href={actionHref}
          className="group/arrow ms-auto inline-flex min-h-9 shrink-0 items-center gap-2 text-xs text-text-primary/85 transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {actionLabel}
          <ArrowRight
            aria-hidden="true"
            size={13}
            className="transition-transform duration-300 ease-luxury group-hover/arrow:translate-x-1 rtl:-scale-x-100 rtl:group-hover/arrow:-translate-x-1 motion-reduce:!translate-x-0"
          />
        </Link>
      </div>
    </div>
  );
}
