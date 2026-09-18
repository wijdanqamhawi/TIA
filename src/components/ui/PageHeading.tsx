import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";

export type PageHeadingProps = {
  title: string;
  /** Optional small gold kicker above the title (already localized by the caller). */
  eyebrow?: string;
  /** Optional supporting line below the gold rule (already localized by the caller). */
  description?: string;
  className?: string;
};

/**
 * The shared storefront page header — eyebrow, display title, gold rule.
 *
 * Cart, Wishlist, Shop, Checkout and Account each previously repeated the
 * same bare `<h1 className="mb-6 text-center font-display text-3xl">`,
 * so the five pages drifted apart in spacing and none of them carried any
 * brand treatment. Composing it once means every page opens with the same
 * editorial gesture, and the heading level/text stay exactly as they were.
 */
export function PageHeading({ title, eyebrow, description, className }: PageHeadingProps) {
  return (
    <header className={cn("flex flex-col items-center gap-4 text-center", className)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="font-display text-4xl font-light text-text-primary sm:text-5xl md:text-[3.25rem]">
        {title}
      </h1>
      <hr className="rule-accent" aria-hidden="true" />
      {description ? (
        <p className="max-w-xl text-sm leading-relaxed text-text-primary/65 sm:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export type SectionHeadingProps = {
  title: string;
  eyebrow?: string;
  className?: string;
};

/**
 * The in-page equivalent of `PageHeading` for homepage merchandising rows
 * (New Arrivals, Best Sellers, Special Offers, Shop by Category). Renders
 * an `<h2>`, so the document outline is unchanged from the plain headings
 * these replace.
 */
export function SectionHeading({ title, eyebrow, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3.5 text-center", className)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="font-display text-3xl font-light text-text-primary sm:text-4xl md:text-[2.75rem]">
        {title}
      </h2>
    </div>
  );
}

export type RowHeadingProps = {
  title: string;
  /** Optional "See All" affordance rendered on the opposite side. */
  actionLabel?: string;
  actionHref?: string;
  className?: string;
};

/**
 * A left-aligned editorial row heading with an optional "See All" on the
 * opposite side — the composition used by Best Sellers, New In and
 * Special Offers. Positioning is logical (`justify-between` in a row that
 * follows writing direction), so the action lands on the correct side
 * under Arabic RTL with no per-locale override.
 */
export function RowHeading({ title, actionLabel, actionHref, className }: RowHeadingProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <h2 className="font-display text-3xl font-light text-text-primary sm:text-4xl md:text-[2.75rem]">
        {title}
      </h2>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="link-underline pb-1.5 text-[0.625rem] font-medium uppercase tracking-[0.2em] text-text-primary/75 transition-colors hover:text-text-primary focus-visible:outline-none rtl:text-xs rtl:normal-case rtl:tracking-normal"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
