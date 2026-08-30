import { z } from "zod";

/** Shared primitives reused across every domain schema. */

export const nonEmptyString = z.string().trim().min(1, "This field is required.");

export const nonNegativeInt = z.number().int().nonnegative();

export const positiveNumber = z.number().positive();

export const stableId = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-zA-Z0-9_-]+$/, "Must be a stable identifier (letters, numbers, - or _).");

/**
 * The discriminated result shape every Server Action returns
 * (contracts/server-actions.md, Constitution Principle 14) — never a
 * thrown Firestore/Admin SDK error, stack trace, or error code surfaced
 * directly to the client (Constitution Principle 15).
 */
export type ActionError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError<T = never>(
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  return { ok: false, error: { code, message, fieldErrors } };
}

/** Flattens a ZodError into the `fieldErrors` shape used by ActionError. */
export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const { fieldErrors } = error.flatten();
  return fieldErrors as Record<string, string[]>;
}

export function actionValidationError<T = never>(error: z.ZodError): ActionResult<T> {
  return actionError("VALIDATION_ERROR", "Please check the highlighted fields.", zodFieldErrors(error));
}
