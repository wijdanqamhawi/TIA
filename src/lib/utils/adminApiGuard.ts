import "server-only";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";

/**
 * The Route Handler counterpart of the `guardAdmin()` pattern already used
 * by every admin Server Action (e.g. `delivery-location.actions.ts`). A
 * Route Handler is not wrapped by `admin/layout.tsx`'s guard (layouts don't
 * wrap Route Handlers in the App Router, research.md §46), so every export
 * route calls this independently before touching Firestore or generating
 * any file (T306). Returns `null` when the caller is a verified admin, or a
 * safe, generic 401/403 JSON `Response` otherwise — never a partial file
 * (contracts/route-handlers.md "Admin — Data Export").
 */
export async function requireAdminForRoute(): Promise<Response | null> {
  try {
    await requireAdmin();
    return null;
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return Response.json({ error: "UNAUTHENTICATED", message: "Authentication required." }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return Response.json(
        { error: "FORBIDDEN", message: "You do not have permission to perform this action." },
        { status: 403 },
      );
    }
    throw err;
  }
}
