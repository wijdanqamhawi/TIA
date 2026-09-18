import { ChevronRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

export type Crumb = { label: string; href?: string };

/**
 * The quiet breadcrumb row above the product composition: Home › Shop ›
 * Category › Product, built from the product's real category relation. A
 * product whose category could not be resolved simply omits that crumb
 * rather than showing a placeholder.
 *
 * The separator is mirrored under RTL so the trail always reads with the
 * writing direction; the final crumb is plain text carrying
 * `aria-current="page"`, never a link to the page you are already on.
 */
export function ProductBreadcrumb({ crumbs, label }: { crumbs: Crumb[]; label: string }) {
  return (
    <nav aria-label={label} className="flex items-center gap-1.5 text-[0.75rem] text-text-secondary">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
            {crumb.href && !last ? (
              <Link
                href={crumb.href}
                className="transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
              >
                {crumb.label}
              </Link>
            ) : (
              <span aria-current={last ? "page" : undefined} className={last ? "text-text-primary" : undefined}>
                {crumb.label}
              </span>
            )}
            {last ? null : (
              <ChevronRight aria-hidden="true" size={12} className="text-text-secondary/70 rtl:-scale-x-100" />
            )}
          </span>
        );
      })}
    </nav>
  );
}
