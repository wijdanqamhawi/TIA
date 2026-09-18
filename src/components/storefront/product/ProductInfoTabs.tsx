export type ProductTab = {
  id: string;
  label: string;
  /** Copy rendered beneath the header row. Omit for a label that only points elsewhere. */
  body?: string;
  /** Anchor target for a label whose copy already lives elsewhere on the page. */
  href?: string;
};

/**
 * The horizontal information header beneath the main product area, matching
 * the approved reference: a row of serif labels over a hairline, the first
 * carrying the champagne underline, with the content beneath.
 *
 * ── ONLY REAL SECTIONS ───────────────────────────────────────────────────
 * The reference shows four labels — Description | Details | Shipping &
 * Returns | Reviews (24). Two have no data behind them at all (no review
 * collection, no per-product shipping or returns policy), so only labels
 * with real content are rendered. Nothing is invented to fill the row.
 *
 * ── WHY "DESCRIPTION" IS AN ANCHOR, NOT A PANEL ──────────────────────────
 * The product model has a single `description` field, and the reference
 * places that copy under the price. Rendering it a second time here would
 * duplicate real content on screen *and* make `getByText(description)`
 * resolve to two elements, which fails Playwright's strict mode — exactly
 * what happened when it was tried. So the label stays, preserving the
 * reference's navigation row, and points at the paragraph that already
 * exists above rather than repeating it.
 */
export function ProductInfoTabs({ tabs }: { tabs: ProductTab[] }) {
  if (tabs.length === 0) return null;

  const LABEL =
    "-mb-px shrink-0 border-b-2 pb-3 font-display text-[0.9375rem] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy";

  return (
    <section>
      {/* ── NO `overflow-x-auto` HERE ────────────────────────────────────
          It used to carry `overflow-x-auto`, which computes `overflow-y`
          to `auto` as well. The labels' `-mb-px` then overflowed the row by
          exactly 1px, so browsers with classic (non-overlay) scrollbars —
          Windows — painted a stray vertical scrollbar with up/down arrows
          at the right edge of this strip. It appears in no reference and
          scrolled nothing. The row only ever holds a couple of short
          labels, so it never needed to scroll; it simply wraps instead. */}
      <div className="flex flex-wrap gap-x-10 gap-y-2 border-b border-hairline">
        {tabs.map((tab, index) => (
          <a
            key={tab.id}
            href={tab.href ?? `#section-${tab.id}`}
            className={`${LABEL} ${
              index === 0
                ? "border-brand-gold font-medium text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <div className="pt-6">
        {tabs
          .filter((tab) => tab.body)
          .map((tab) => (
            <div key={tab.id} id={`section-${tab.id}`} className="scroll-mt-28">
              <p className="max-w-[46rem] text-[0.8125rem] leading-[1.9] text-text-secondary">{tab.body}</p>
            </div>
          ))}
      </div>
    </section>
  );
}
