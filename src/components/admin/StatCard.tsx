import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { DirectionalIcon } from "@/components/ui/DirectionalIcon";
import { cn } from "@/lib/utils/cn";

type StatCardProps = {
  label: string;
  value: ReactNode;
  /** For a text value (a status, a payment method) instead of a large figure: smaller, in the page direction. */
  compact?: boolean;
  icon: LucideIcon;
  /** A short, real supporting fact shown under the figure (never a trend we can't compute). */
  note?: string;
  /** Where the arrow leads — the admin page behind this figure. */
  href?: string;
  linkLabel?: string;
  /** Icon disc colour — gold by default; soft green/red for status figures. */
  tone?: "gold" | "green" | "red" | "blue";
};

const TONE = {
  gold: { disc: "bg-brand-gold/[0.12]", icon: "text-brand-gold" },
  green: { disc: "bg-[#e6f0e9]", icon: "text-[#3f7a55]" },
  red: { disc: "bg-[#f7e8e6]", icon: "text-[#b0493f]" },
  blue: { disc: "bg-[#e8edf6]", icon: "text-[#3b5b8c]" },
} as const;

/**
 * A single dashboard statistic tile (T171): cream icon disc, slate label,
 * large navy figure and, optionally, a one-line supporting fact and a small
 * gold arrow into the page behind the figure.
 */
export function StatCard({
  label,
  value,
  compact = false,
  icon: Icon,
  note,
  href,
  linkLabel,
  tone = "gold",
}: StatCardProps) {
  return (
    <div className="relative flex min-h-[98px] items-center gap-3.5 rounded-[10px] border border-brand-gold/[0.16] bg-white px-[15px] py-[13px] shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)]">
      <span
        aria-hidden="true"
        className={cn("grid size-12 shrink-0 place-items-center rounded-full", TONE[tone].disc)}
      >
        <Icon className={cn("size-[21px] stroke-[1.8]", TONE[tone].icon)} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-[13px] leading-tight text-text-secondary">{label}</p>
        {compact ? (
          <div className="mt-1.5 min-w-0 font-display text-[20px] leading-tight text-brand-burgundy [font-family:var(--font-playfair),serif] rtl:font-body rtl:text-[17px]">
            {value}
          </div>
        ) : (
          <p
            dir="ltr"
            className="mt-1 font-display text-[28px] leading-none lining-nums tabular-nums text-brand-burgundy rtl:text-right [font-family:var(--font-playfair),serif]"
          >
            {value}
          </p>
        )}
        {note ? (
          <p className="mt-1.5 flex items-center gap-1.5 pe-9 text-[11.5px] leading-snug text-text-secondary">
            <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-brand-gold" />
            {note}
          </p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          aria-label={linkLabel}
          className="absolute bottom-[14px] end-[14px] grid size-7 place-items-center rounded-full bg-brand-gold/[0.14] text-brand-gold-ink transition-colors duration-200 hover:bg-brand-gold/30"
        >
          <DirectionalIcon icon={ArrowRight} aria-hidden="true" className="size-3.5 stroke-[1.8]" />
        </Link>
      ) : null}
    </div>
  );
}
