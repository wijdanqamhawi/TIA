import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "./LanguageSwitcher";

/**
 * The deep-navy announcement bar above the header, per the approved
 * reference: three zones on one 36px line —
 *
 *   start  — a short brand line
 *   centre — the brand statement, with a champagne spark and the italic
 *            champagne clause
 *   end    — the EN | AR switch
 *
 * The three zones sit on a `1fr auto 1fr` grid so the centre statement stays
 * truly centred whatever the side zones hold (in LTR and RTL alike). The
 * delivery-location shortcut is intentionally not on this bar: the location
 * is chosen at checkout.
 *
 * ── A NOTE ON THE START ZONE ─────────────────────────────────────────────
 * The reference reads "Free shipping on orders over $70". That is a
 * commercial promise this store has not made, and inventing one would put
 * a false offer in front of customers, so the slot carries the brand's own
 * existing motto instead. Swap in a real shipping key whenever the store
 * defines one.
 *
 * Below `lg` only the centre statement is kept: three zones cannot share a
 * 36px line on a phone without becoming unreadable.
 */
export async function AnnouncementBar({ locale }: { locale: string }) {
  const [tHome, tSplash] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Splash" }),
  ]);

  return (
    <div className="bg-brand-burgundy text-text-on-dark">
      <div className="container-luxury grid h-9 grid-cols-[1fr_auto_1fr] items-center gap-4">
        <p className="col-start-1 row-start-1 hidden justify-self-start text-[0.6875rem] text-text-on-dark/75 lg:block rtl:text-xs">
          {tSplash("motto")}
        </p>

        <p className="col-start-2 row-start-1 flex min-w-0 items-center gap-2 truncate text-[0.6875rem] text-text-on-dark/90 rtl:text-xs">
          <span className="truncate">{tHome("statementTitle")}</span>
          <span aria-hidden="true" className="shrink-0 text-brand-gold">
            <svg viewBox="0 0 24 24" className="size-2.5" fill="currentColor">
              <path d="M12 0 C12.6 7.4 16.6 11.4 24 12 C16.6 12.6 12.6 16.6 12 24 C11.4 16.6 7.4 12.6 0 12 C7.4 11.4 11.4 7.4 12 0Z" />
            </svg>
          </span>
          <span className="truncate italic text-brand-gold-muted rtl:not-italic">{tHome("statementSubtitle")}</span>
        </p>

        <div className="col-start-3 row-start-1 hidden justify-self-end lg:block">
          <LanguageSwitcher className="text-text-on-dark [&>button]:min-h-9 [&>button]:text-[0.625rem]" />
        </div>
      </div>
    </div>
  );
}
