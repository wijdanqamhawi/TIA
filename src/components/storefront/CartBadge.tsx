/**
 * Counts above this render as "99+" so the badge never outgrows the icon.
 *
 * Declared here rather than imported from the cart service: this component
 * renders inside `MobileBottomNav`, which is a Client Component, and the
 * cart-count module is `server-only` — importing it here would pull the
 * Firebase Admin SDK into the client bundle and fail the build.
 */
const CART_BADGE_MAX = 99;

/**
 * The small champagne count that sits on the shopping-bag icon.
 *
 * Renders nothing at all when the cart is empty — an empty cart shows the
 * bare icon, not a zero. Above 99 it reads "99+" so a large cart can never
 * stretch the badge wide enough to disturb the navbar.
 *
 * Positioned absolutely against the icon control, so it adds no height and
 * cannot shift the icon. `-end-0.5` rather than `-right-0.5` keeps it on the
 * trailing corner in both writing directions.
 *
 * `aria-hidden`: the count is already announced through the link's own
 * accessible name ("Cart, 3 items"), so exposing the numeral separately
 * would make a screen reader say it twice.
 */
export function CartBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -end-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-brand-gold px-1 text-[0.625rem] font-medium leading-none text-white tabular-nums"
    >
      {count > CART_BADGE_MAX ? `${CART_BADGE_MAX}+` : count}
    </span>
  );
}
