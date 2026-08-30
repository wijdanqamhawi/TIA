import "server-only";
import { cookies } from "next/headers";
import { LOCATION_COOKIE_NAME, decodeLocationSelection, type LocationSelection } from "./location-selection";

/**
 * Reads the current request's persisted location selection, if any and
 * well-formed. Server Components/Server Actions only (`next/headers`
 * `cookies()`); the client reads/writes the same cookie directly via
 * `document.cookie` where it needs to reflect or change the current
 * selection in the UI (`LocationSelector`'s trigger label,
 * `LocationSelectorDialog`'s selection handler) — see
 * `location-selection.ts` for the shared, non-server-only encode/decode
 * helpers both sides use.
 */
export async function readLocationSelection(): Promise<LocationSelection | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCATION_COOKIE_NAME)?.value;
  if (!raw) return null;
  return decodeLocationSelection(raw);
}
