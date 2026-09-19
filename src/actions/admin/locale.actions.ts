"use server";

import { cookies } from "next/headers";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";
import { ADMIN_LOCALE_COOKIE, isAdminLocale } from "@/lib/i18n/admin";
import { actionError, actionOk, type ActionResult } from "@/lib/validation/common";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Stores the admin dashboard language (EN/AR) for this browser. */
export async function setAdminLocaleAction(locale: unknown): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthenticatedError || err instanceof ForbiddenError) {
      return actionError("FORBIDDEN", "You do not have permission to perform this action.");
    }
    throw err;
  }

  if (!isAdminLocale(locale)) return actionError("VALIDATION_ERROR", "Unsupported language.");

  (await cookies()).set(ADMIN_LOCALE_COOKIE, locale, {
    path: "/admin",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return actionOk(null);
}
