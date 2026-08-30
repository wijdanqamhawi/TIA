import { z } from "zod";

/**
 * Firebase Authentication itself owns credential storage/hashing and its
 * own email-format/password-strength enforcement (research.md §8). These
 * schemas are the app's own defense-in-depth validation on top of that —
 * enforced server-side in `createSessionAction` regardless of what the
 * client already checked (Constitution Principle 13).
 */

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(120, "Name must be 120 characters or fewer.");

export const emailSchema = z.string().trim().min(1, "Email is required.").email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(4096, "Password is too long.");

export const phoneSchema = z
  .string()
  .trim()
  .min(6, "Enter a valid phone number.")
  .max(20, "Enter a valid phone number.")
  .regex(/^[0-9+\-() ]+$/, "Enter a valid phone number.");

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Input to `createSessionAction` (contracts/server-actions.md). `intent`
 * is the optional guest-action-preservation string (currently only
 * `wishlist:<productId>[:<optionKey>:<valueKey>]`, research.md §7,
 * T113/T114) carried through `/login?intent=...`/`/register?intent=...` —
 * structurally validated here as plain text; its actual shape is parsed
 * and re-validated by `parseWishlistIntent` inside `createSessionAction`
 * itself, never trusted beyond that.
 */
export const createSessionInputSchema = z.object({
  idToken: z.string().min(1, "Missing ID token."),
  intent: z.string().trim().min(1).optional(),
});
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
